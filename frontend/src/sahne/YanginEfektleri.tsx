import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  Color,
  CustomBlending,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three'
import { useZaman } from '../durum/zaman'
import { rastgeleUreteci } from '../model/gurultu'
import { YOK } from '../olay/api'
import { ORTU_SIRASI, sahneY, type OlayVerisi } from '../olay/veri'
import { DOKU_GURULTU_GLSL } from './gurultuDokusu'
import { yanginUniformlari as U } from './yanginMalzemesi'

/**
 * Model yangınının görsel efektleri: alevler, duman ve yangının ışığı. Her yanan hücre,
 * model varış zamanında (aToa) alev alır; yakıta göre bir süre yanar, sonra saatlerce tüter.
 * Her şey gölgelendiricide global zamanla (uT) hesaplanır: zaman kaydırıcısı ileri geri
 * oynatılınca geometri yeniden kurulmaz. Duman rüzgâr yönünde sürüklenir ve yükselir;
 * güneşle aydınlanır, altı alevle kızarır. Yalnızca 3B'de (tepeden bakışta ilan anlamsız).
 */

/** Yakıt sınıfına göre alevli yanma süresi (saat). */
const YANMA_SURESI: Record<string, number> = { orman: 1.0, maki: 0.6, ot: 0.3, tarim: 0.3, diger: 0.4, yerlesim: 0.5, su: 0 }
const HUCRE_BASINA_ALEV = 3
const DUMAN_ORANI = 0.18
const KUME_BASINA_DUMAN = 4
/** Alevli yanmadan sonra dumanın tütmeye devam ettiği süre (saat); gölgelendiricideki `aSure + 6.0` ile aynı. */
const TUTME_SAAT = 6

const ORTAK_UNIFORM = /* glsl */ `
uniform float uT;
uniform float uZaman;
uniform float uYayilim;
uniform float uKabartma;
uniform float uGorunur;
uniform vec2 uRuzgar;
uniform vec3 uGunesYonu;
uniform vec3 uIsikRengi;
uniform vec3 uOrtamRengi;
uniform float uGece;
`

const ALEV_VERTEX = /* glsl */ `
${ORTAK_UNIFORM}
attribute vec3 aMerkez;
attribute float aToa;
attribute float aSure;
attribute float aRastgele;
varying vec2 vUv;
varying float vGuc;
varying float vRastgele;
void main() {
  float yas = uT - aToa;
  // Hızlı tutuşur, yanma süresinin sonuna doğru söner
  float guc = smoothstep(-0.02, 0.06, yas) * (1.0 - smoothstep(aSure * 0.35, aSure, yas)) * uYayilim * uGorunur;
  vUv = uv;
  vGuc = guc;
  vRastgele = aRastgele;
  if (guc < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float titreme = 0.85 + 0.15 * sin(uZaman * (9.0 + aRastgele * 5.0) + aRastgele * 40.0);
  float boy = (0.12 + 0.2 * aRastgele * aRastgele) * (0.45 + 0.55 * guc) * titreme;
  vec3 merkez = aMerkez;
  merkez.y *= uKabartma;
  // Silindirik ilan: hep dik, kameraya döner
  vec3 bakis = cameraPosition - merkez;
  bakis.y = 0.0;
  vec3 sag = normalize(vec3(bakis.z, 0.0, -bakis.x) + vec3(1e-5, 0.0, 0.0));
  vec3 p = merkez + sag * position.x * boy * 0.9 + vec3(0.0, position.y * boy, 0.0);
  // Rüzgârda yatar
  p.xz += uRuzgar * position.y * position.y * boy * 0.8;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const ALEV_FRAGMENT = /* glsl */ `
${ORTAK_UNIFORM}
${DOKU_GURULTU_GLSL}
varying vec2 vUv;
varying float vGuc;
varying float vRastgele;
void main() {
  float t = uZaman * (1.4 + vRastgele * 0.6) + vRastgele * 10.0;
  float x = (vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  // İki ölçekte yukarı akan türbülans: büyük ölçek alevi büker, küçük ölçek dillere böler
  float b = dFbm(vec2(vUv.x * 2.5 + vRastgele * 20.0, y * 1.6 - t * 1.4));
  float d = dFbm(vec2(vUv.x * 6.0 + vRastgele * 7.0, y * 3.5 - t * 2.6));
  float genislik = 0.7 * sqrt(max(1.0 - y, 0.0)) + 0.05;
  float u = (x + (b - 0.5) * 1.1 * y) / genislik;
  float govde = exp(-u * u * 2.2);
  float yogun = govde * (0.25 + d * 1.5) - y * 0.85 + 0.05;
  float alev = smoothstep(-0.04, 0.45, yogun) * smoothstep(0.0, 0.08, y);
  float sicaklik = smoothstep(0.15, 0.85, yogun);
  vec3 renk = mix(vec3(0.55, 0.05, 0.0), vec3(1.0, 0.33, 0.03), smoothstep(0.0, 0.4, sicaklik));
  renk = mix(renk, vec3(1.0, 0.72, 0.28), smoothstep(0.45, 0.85, sicaklik));
  float a = alev * vGuc * 0.9;
  // Önceden çarpılmış renk: gece eklemeli (karanlıkta parlar), gündüz zemini örter; aydınlık
  // zemine eklenen turuncu beyaza kaçıp kayboluyordu.
  float ortu = (1.0 - uGece) * 0.85;
  gl_FragColor = vec4(renk * (0.45 + 0.5 * sicaklik) * a * mix(1.3, 1.0, uGece), a * ortu);
}
`

const DUMAN_VERTEX = /* glsl */ `
${ORTAK_UNIFORM}
#include <fog_pars_vertex>
attribute vec3 aMerkez;
attribute float aToa;
attribute float aSure;
attribute float aRastgele;
attribute float aFaz;
varying vec2 vUv;
varying float vAlfa;
varying float vYas;
varying float vKizil;
varying vec3 vIsikGorus;
varying float vRastgele;
void main() {
  float yas = uT - aToa;
  // Alevli yanmada yoğun, sonra saatlerce incelen tütme
  float aktif = smoothstep(-0.02, 0.15, yas) * (1.0 - smoothstep(aSure, aSure + 6.0, yas));
  float yogunluk = aktif * mix(1.0, 0.22, smoothstep(aSure * 0.5, aSure * 2.0, yas)) * uYayilim * uGorunur;
  vUv = uv;
  vRastgele = aRastgele;
  if (yogunluk < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float donem = 10.0 + 6.0 * aRastgele;
  float f = fract(uZaman / donem + aFaz);
  vYas = f;
  float alevli = smoothstep(-0.02, 0.06, yas) * (1.0 - smoothstep(aSure * 0.35, aSure, yas));
  vKizil = alevli * pow(1.0 - f, 4.0);
  // Yükselir, yukarıda rüzgârla daha çok sürüklenir, büyür
  float h = (1.4 + 1.8 * aRastgele) * pow(f, 0.75) * (0.5 + 0.5 * yogunluk);
  vec3 merkez = aMerkez;
  merkez.y *= uKabartma;
  vec3 p = merkez + vec3(0.0, 0.05 + h, 0.0);
  p.xz += uRuzgar * (0.3 + 4.5 * pow(f, 1.4));
  p.xz += vec2(sin(aRastgele * 31.0 + f * 3.0), cos(aRastgele * 17.0 + f * 2.0)) * 0.15 * f;
  float boy = (0.22 + 1.7 * f) * (0.6 + 0.8 * aRastgele);
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  // Kameranın içine giren bulut ekranı kaplamasın
  vAlfa = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.5, 1.0, f)) * yogunluk * smoothstep(boy * 0.6, boy * 2.5, -mvPosition.z);
  if (vAlfa < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float aci = aRastgele * 6.283 + f * (aRastgele - 0.5) * 2.0;
  vec2 k = mat2(cos(aci), -sin(aci), sin(aci), cos(aci)) * position.xy;
  mvPosition.xy += k * boy;
  vIsikGorus = normalize((viewMatrix * vec4(uGunesYonu, 0.0)).xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const DUMAN_FRAGMENT = /* glsl */ `
${ORTAK_UNIFORM}
${DOKU_GURULTU_GLSL}
#include <fog_pars_fragment>
varying vec2 vUv;
varying float vAlfa;
varying float vYas;
varying float vKizil;
varying vec3 vIsikGorus;
varying float vRastgele;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0) discard;
  float kenar = smoothstep(1.0, 0.15, r) * vAlfa;
  if (kenar < 0.01) discard;
  float n = dFbm(q * 1.6 + vRastgele * 13.0 + vec2(0.0, -vYas * 1.2));
  float yogun = smoothstep(0.2, 0.7, n * 0.85 + (1.0 - r) * 0.55);
  // Küre benzeri normal: güneşe bakan taraf aydınlık
  vec3 N = normalize(vec3(q + (n - 0.5) * 0.6, 0.7));
  float isik = max(dot(N, vIsikGorus), 0.0);
  vec3 taban = mix(vec3(0.16, 0.15, 0.145), vec3(0.55, 0.53, 0.5), smoothstep(0.0, 0.75, vYas));
  // Gündüz daha koyu, kahverengimsi gri: tam güneşte beyaza kaçıp yangını örtüyordu
  taban *= mix(vec3(0.62, 0.58, 0.54), vec3(1.0), uGece);
  vec3 renk = taban * (uOrtamRengi * 0.5 + uIsikRengi * (0.2 + 0.9 * isik));
  // Alttan alev ışığı
  renk += vec3(1.0, 0.35, 0.06) * vKizil * smoothstep(0.6, -0.8, q.y) * 0.8;
  // Gündüz daha ince: altındaki alevler ve tespitler görünsün
  gl_FragColor = vec4(renk, yogun * kenar * mix(0.6, 1.0, uGece));
  #include <fog_fragment>
}
`

interface Hucre {
  x: number
  y: number
  z: number
  toa: number
  sure: number
}

function yananHucreler(veri: OlayVerisi): Hucre[] {
  const h: Hucre[] = []
  const { satir, sutun, r } = veri
  for (let i = 0; i < satir; i++) {
    for (let j = 0; j < sutun; j++) {
      const k = i * sutun + j
      if (r.modelToa[k] === YOK) continue
      const { x, z } = veri.hucreKonumu(i, j)
      const ortu = ORTU_SIRASI[r.ortu[k]] ?? 'diger'
      h.push({ x, z, y: sahneY(r.yukseklik[k]), toa: r.modelToa[k] / 60, sure: YANMA_SURESI[ortu] ?? 0.5 })
    }
  }
  return h
}

/**
 * Varış zamanına göre sıralı örnekler; her karede yalnızca `uT` çevresindeki pencere
 * (o an yanan ya da tüten örnekler) GPU tamponunun başına kopyalanır ve çizilir. Böylece
 * yüz binlerce hücreden yalnızca birkaç bini işlenir. Tampon, en kalabalık pencereye göre ayrılır.
 */
class ZamanPenceresi {
  readonly geo = new InstancedBufferGeometry()
  private readonly tam: Record<string, { dizi: Float32Array; boyut: number }> = {}
  private readonly toa: Float32Array
  private lo = -1
  private hi = -1
  private readonly geri: number
  private readonly ileri: number

  constructor(
    taban: PlaneGeometry,
    nitelikler: Record<string, Float32Array>,
    boyut: Record<string, number>,
    geri: number,
    ileri: number,
  ) {
    this.geri = geri
    this.ileri = ileri
    const n = nitelikler.aToa.length
    const sira = Array.from({ length: n }, (_, i) => i).sort((a, b) => nitelikler.aToa[a] - nitelikler.aToa[b])
    for (const [ad, dizi] of Object.entries(nitelikler)) {
      const b = boyut[ad] ?? 1
      const sirali = new Float32Array(dizi.length)
      sira.forEach((eski, yeni) => sirali.set(dizi.subarray(eski * b, eski * b + b), yeni * b))
      this.tam[ad] = { dizi: sirali, boyut: b }
    }
    this.toa = this.tam.aToa.dizi
    // En kalabalık pencere (iki işaretçi)
    let kapasite = 1
    for (let i = 0, j = 0; i < n; i++) {
      while (j < n && this.toa[j] <= this.toa[i] + geri + ileri) j++
      kapasite = Math.max(kapasite, j - i)
    }
    this.geo.index = taban.index
    this.geo.setAttribute('position', taban.attributes.position)
    this.geo.setAttribute('uv', taban.attributes.uv)
    for (const [ad, { boyut: b }] of Object.entries(this.tam)) {
      this.geo.setAttribute(ad, new InstancedBufferAttribute(new Float32Array(kapasite * b), b))
    }
    this.geo.instanceCount = 0
  }

  /** İlk `toa >= deger` indeksi. */
  private ara(deger: number) {
    let a = 0
    let b = this.toa.length
    while (a < b) {
      const m = (a + b) >> 1
      if (this.toa[m] < deger) a = m + 1
      else b = m
    }
    return a
  }

  guncelle(saat: number) {
    const lo = this.ara(saat - this.geri)
    const hi = this.ara(saat + this.ileri)
    if (lo === this.lo && hi === this.hi) return
    this.lo = lo
    this.hi = hi
    for (const [ad, { dizi, boyut: b }] of Object.entries(this.tam)) {
      const a = this.geo.getAttribute(ad) as InstancedBufferAttribute
      ;(a.array as Float32Array).set(dizi.subarray(lo * b, hi * b))
      a.clearUpdateRanges()
      a.addUpdateRange(0, (hi - lo) * b)
      a.needsUpdate = true
    }
    this.geo.instanceCount = hi - lo
  }
}

/** Her saat için o saatte alevli yanan hücrelerin ağırlık merkezi ve sayısı (yangın ışığı için). */
function saatlikCephe(hucreler: Hucre[]) {
  const saatler = new Map<number, { x: number; y: number; z: number; n: number }>()
  for (const h of hucreler) {
    const s = Math.floor(h.toa)
    const e = saatler.get(s) ?? { x: 0, y: 0, z: 0, n: 0 }
    e.x += h.x
    e.y += h.y
    e.z += h.z
    e.n++
    saatler.set(s, e)
  }
  for (const e of saatler.values()) {
    e.x /= e.n
    e.y /= e.n
    e.z /= e.n
  }
  return saatler
}

export function YanginEfektleri({ veri, gorunur }: { veri: OlayVerisi; gorunur: boolean }) {
  const isik = useRef<PointLight>(null)
  const { alevler, dumanlar, cephe } = useMemo(() => {
    const r = rastgeleUreteci(77)
    const hucreler = yananHucreler(veri)
    const yari = veri.hucreKm / 2

    // Alevler
    const n = hucreler.length * HUCRE_BASINA_ALEV
    const merkez = new Float32Array(n * 3)
    const toa = new Float32Array(n)
    const sure = new Float32Array(n)
    const rast = new Float32Array(n)
    let k = 0
    for (const h of hucreler) {
      for (let a = 0; a < HUCRE_BASINA_ALEV; a++, k++) {
        const x = h.x + (r() * 2 - 1) * yari
        const z = h.z + (r() * 2 - 1) * yari
        merkez.set([x, veri.araziY(x, z) - 0.004, z], k * 3)
        toa[k] = h.toa + r() * 0.15
        sure[k] = h.sure * (0.6 + r() * 0.8)
        rast[k] = r()
      }
    }
    const alevTaban = new PlaneGeometry(1, 1)
    alevTaban.translate(0, 0.5, 0)
    const enUzunYanma = Math.max(...Object.values(YANMA_SURESI)) * 1.4
    const alevler = new ZamanPenceresi(
      alevTaban,
      { aMerkez: merkez, aToa: toa, aSure: sure, aRastgele: rast },
      { aMerkez: 3 },
      enUzunYanma,
      0.05,
    )

    // Duman: hücrelerin bir kısmı kaynak, her kaynaktan döngüde birkaç bulut
    const kaynaklar = hucreler.filter(() => r() < DUMAN_ORANI)
    const m = kaynaklar.length * KUME_BASINA_DUMAN
    const dMerkez = new Float32Array(m * 3)
    const dToa = new Float32Array(m)
    const dSure = new Float32Array(m)
    const dRast = new Float32Array(m)
    const dFaz = new Float32Array(m)
    k = 0
    for (const h of kaynaklar) {
      for (let a = 0; a < KUME_BASINA_DUMAN; a++, k++) {
        dMerkez.set([h.x + (r() * 2 - 1) * yari, h.y, h.z + (r() * 2 - 1) * yari], k * 3)
        dToa[k] = h.toa
        dSure[k] = h.sure
        dRast[k] = r()
        dFaz[k] = a / KUME_BASINA_DUMAN + r() * 0.2
      }
    }
    const dumanlar = new ZamanPenceresi(
      new PlaneGeometry(1, 1),
      { aMerkez: dMerkez, aToa: dToa, aSure: dSure, aRastgele: dRast, aFaz: dFaz },
      { aMerkez: 3 },
      enUzunYanma + TUTME_SAAT,
      0.05,
    )
    return { alevler, dumanlar, cephe: saatlikCephe(hucreler) }
  }, [veri])

  const gorunurU = useMemo(() => ({ value: 1 }), [])
  const alevMalzeme = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { ...U, uGorunur: gorunurU },
        vertexShader: ALEV_VERTEX,
        fragmentShader: ALEV_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
      }),
    [gorunurU],
  )
  const dumanMalzeme = useMemo(
    () =>
      new ShaderMaterial({
        // Sis uniform'ları kopya; yangın uniform'ları paylaşılan nesneler (her karede güncel)
        uniforms: { ...UniformsUtils.clone(UniformsLib.fog), ...U, uGorunur: gorunurU },
        vertexShader: DUMAN_VERTEX,
        fragmentShader: DUMAN_FRAGMENT,
        transparent: true,
        depthWrite: false,
        fog: true,
      }),
    [gorunurU],
  )

  useFrame((_, dt) => {
    gorunurU.value += ((gorunur ? 1 : 0) - gorunurU.value) * Math.min(dt * 6, 1)
    const saat = (useZaman.getState().t - veri.tutusmaMs) / 3_600_000
    alevler.guncelle(saat)
    dumanlar.guncelle(saat)
    // Yangın ışığı: o saatte yanan cephenin ortası, yanan hücre sayısıyla güçlenir
    const l = isik.current
    if (!l) return
    const e = cephe.get(Math.floor(saat))
    if (!e || U.uYayilim.value < 0.01) {
      l.intensity = 0
      return
    }
    l.position.set(e.x, e.y * U.uKabartma.value + 0.6, e.z)
    const titreme = 0.85 + 0.15 * Math.sin(U.uZaman.value * 11) * Math.sin(U.uZaman.value * 6.3)
    // Gece daha belirgin (gündüz güneş bastırır)
    l.intensity = Math.min(e.n / 60, 3) * (0.08 + 1.2 * U.uGece.value) * titreme * gorunurU.value
  })

  return (
    <>
      <pointLight ref={isik} color={new Color('#ff8a3a')} distance={9} decay={1.2} intensity={0} />
      <mesh geometry={dumanlar.geo} material={dumanMalzeme} frustumCulled={false} renderOrder={2} raycast={() => null} />
      <mesh geometry={alevler.geo} material={alevMalzeme} frustumCulled={false} renderOrder={3} raycast={() => null} />
    </>
  )
}
