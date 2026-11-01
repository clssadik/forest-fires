import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  ShaderMaterial,
} from 'three'
import { useOlay } from '../durum/olay'
import { rastgeleUreteci } from '../model/gurultu'
import type { OlayVerisi } from '../olay/veri'
import { yanginUniformlari as U } from './yanginMalzemesi'

/** Noktanın araziden yüksekliği (km); eğik bakışta yamaca gömülmesin. */
const YUKSELTI = 0.025
/** Merkezden kenara dalga gibi yayılarak beliriş süresi (sn). */
const BELIRIS_SN = 1.4

const VERTEX = /* glsl */ `
uniform float uKabartma;
uniform float uZaman;
uniform float uBaslangic;
uniform float uOlcek;
uniform float uOrto;
attribute float aGecikme;
attribute float aRastgele;
varying float vGuc;
varying float vRastgele;
void main() {
  vec3 p = position;
  p.y *= uKabartma;
  // Merkezden kenara doğru belirir, kısa bir parlamayla oturur
  float yas = uZaman - uBaslangic - aGecikme * ${BELIRIS_SN.toFixed(1)};
  float beliris = smoothstep(0.0, 0.35, yas);
  float parlama = exp(-max(yas, 0.0) * 3.0) * step(0.0, yas);
  vGuc = beliris + parlama * 1.6;
  vRastgele = aRastgele;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uOlcek * (1.0 + parlama * 0.8) / mix(-mv.z, 1.0, uOrto);
}`

const FRAGMENT = /* glsl */ `
uniform float uZaman;
uniform float uGorunur;
uniform float uGece;
varying float vGuc;
varying float vRastgele;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  // Sıcak beyaz çekirdek, kızıl turuncu yumuşak hale (FIRMS haritalarındaki sıcak nokta)
  float cekirdek = exp(-d * d * 22.0);
  // Önceden çarpılmış renk: gece eklemeli parlar, gündüz zemini örter (aydınlık zemine eklenen
  // turuncu beyaza kaçıyordu). Gündüz hale daha güçlü ve koyu bir kenarla zeminden ayrılır.
  float gunduz = 1.0 - uGece;
  float hale = exp(-d * d * 5.0) * mix(0.28, 0.6, gunduz);
  float titreme = 0.75 + 0.25 * sin(uZaman * (2.2 + vRastgele * 2.0) + vRastgele * 40.0);
  vec3 renk = mix(vec3(0.95, 0.25, 0.06), vec3(1.0, 0.72, 0.38), cekirdek);
  float guc = (cekirdek * 0.9 + hale) * titreme * vGuc * uGorunur;
  float kenar = smoothstep(0.55, 0.8, d) * (1.0 - smoothstep(0.8, 1.0, d)) * 0.35 * gunduz * vGuc * uGorunur;
  float ortu = min(guc * (1.0 + gunduz * 1.5), 1.0) * gunduz;
  gl_FragColor = vec4(renk * guc * mix(1.25, 1.0, uGece), max(ortu, kenar));
}`

/**
 * Seçili uydu geçişinin bu geçişte ilk kez gördüğü FIRMS pikselleri, haritada parlayan sıcak
 * noktalar olarak: her kaba hücre bir nokta. Seçilince merkezden kenara dalga gibi belirir,
 * sonra hafifçe titreşir; seçim kalkınca söner.
 */
export function GecisNoktalari({ veri }: { veri: OlayVerisi }) {
  const olay = useOlay((d) => d.seciliOlay)
  const aralik = olay ? veri.gecisAraligi(olay) : null
  const alt = aralik?.[0]
  const ust = aralik?.[1]

  const geometri = useMemo(() => {
    if (alt === undefined || ust === undefined) return null
    const xs: number[] = []
    const zs: number[] = []
    for (let i = 0; i < veri.satir; i++)
      for (let j = 0; j < veri.sutun; j++) {
        const { x, z } = veri.hucreKonumu(i, j)
        const f = veri.firmsSaat(x, z)
        if (f > alt && f <= ust) {
          xs.push(x)
          zs.push(z)
        }
      }
    const n = xs.length
    if (!n) return null
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const mz = zs.reduce((a, b) => a + b, 0) / n
    const uzak = xs.map((x, k) => Math.hypot(x - mx, zs[k] - mz))
    const enUzak = Math.max(...uzak, 1e-3)
    const rastgele = rastgeleUreteci(Math.round(ust * 100))
    const konum = new Float32Array(n * 3)
    const gecikme = new Float32Array(n)
    const tohum = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      // Hücre içinde hafif sapma: kaba ızgaranın düzgün dizisi görünmesin
      const x = xs[k] + (rastgele() - 0.5) * veri.hucreKm * 0.7
      const z = zs[k] + (rastgele() - 0.5) * veri.hucreKm * 0.7
      konum.set([x, veri.araziY(x, z) + YUKSELTI, z], k * 3)
      gecikme[k] = (uzak[k] / enUzak) * (0.85 + rastgele() * 0.15)
      tohum[k] = rastgele()
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(konum, 3))
    g.setAttribute('aGecikme', new BufferAttribute(gecikme, 1))
    g.setAttribute('aRastgele', new BufferAttribute(tohum, 1))
    return g
  }, [veri, alt, ust])

  const malzeme = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uKabartma: U.uKabartma,
          uZaman: U.uZaman,
          uBaslangic: { value: 0 },
          uOlcek: { value: 1 },
          uOrto: { value: 0 },
          uGorunur: { value: 0 },
          uGece: U.uGece,
        },
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
      }),
    [],
  )

  // Yeni geçiş seçilince dalga baştan başlar.
  const sonGeometri = useRef<BufferGeometry | null>(null)
  useFrame(({ size, camera, gl }, dt) => {
    if (geometri !== sonGeometri.current) {
      sonGeometri.current = geometri
      malzeme.uniforms.uBaslangic.value = U.uZaman.value
      malzeme.uniforms.uGorunur.value = 0
    }
    // Nokta (hale dahil) hücre boyunun ~1,3 katı: perspektifte uzaklıkla küçülür, 2B'de km başına piksel = zoom.
    const oran = gl.getPixelRatio()
    const persp = camera instanceof PerspectiveCamera
    malzeme.uniforms.uOrto.value = persp ? 0 : 1
    malzeme.uniforms.uOlcek.value = persp
      ? (veri.hucreKm * 1.3 * size.height * oran) / (2 * Math.tan((camera.fov * Math.PI) / 360))
      : veri.hucreKm * 1.3 * camera.zoom * oran
    const g = malzeme.uniforms.uGorunur
    g.value += ((geometri ? 1 : 0) - g.value) * Math.min(dt * 8, 1)
  })

  if (!geometri) return null
  return <points geometry={geometri} material={malzeme} frustumCulled={false} renderOrder={5} />
}
