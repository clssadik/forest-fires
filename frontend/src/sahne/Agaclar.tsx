import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Fog, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { rastgeleUreteci } from '../model/gurultu'
import { ORMAN_YOGUNLUGU, sahneY, type OlayVerisi } from '../olay/veri'
import { agacGeometrisi, basitAgacGeometrisi, type AgacTuru } from './agacGeometrisi'
import type { Cevre } from './cevre'
import { agacGolgelendirici, YANMADI_SAAT } from './yanginMalzemesi'

/**
 * WorldCover orman ve maki hücrelerine serpilmiş ağaçlar (örneklenmiş çizim): kızılçam,
 * yükseklerde servi/göknar, makilikte çalı. Ölçek stilize: ağaçlar görünür olsun diye
 * gerçeğinden büyüktür; konumları gerçek örtüden gelir. Karenin dışındaki çevre şeridine de
 * sahte örtü yoğunluğuna göre ağaç dikilir (onlar hiç yanmaz).
 *
 * Ağaçlar karolara bölünür: görüş alanı dışındaki ve sisin ötesindeki karolar hiç çizilmez,
 * uzak karolar basit modelle çizilir (ayrıntı düzeyi).
 */

const ICERI_ADET = 42_000
const DISARI_ADET = 26_000
/** Çevrede ağaç dikilen şeridin genişliği (km); ötesini sis ve zemin benekleri taşır. */
const DISARI_SERIT_KM = 14
/** Karo kenarı (km). */
const KARO_KM = 10
/** Bu uzaklıktan (km, karonun en yakın noktası) ötedeki karolar basit modelle çizilir. */
const AYRINTI_KM = 7

interface Ornekler {
  matrisler: Matrix4[]
  renkler: Color[]
  toa: number[]
}

const TURLER: AgacTuru[] = ['cam', 'servi', 'maki']
const TON = ['#ffffff', '#e8efe0', '#f4f0dc', '#d9e2cf', '#fff6e4'].map((c) => new Color(c))

/** Yoğunluk ve yükseklikten tür seçimi. */
function turSec(yogunluk: number, hM: number, r: () => number): AgacTuru {
  if (yogunluk < 0.8) return r() < 0.68 ? 'maki' : 'cam'
  if (hM > 900 && r() < 0.55) return 'servi'
  return r() < 0.2 ? 'servi' : 'cam'
}

export function Agaclar({ veri, cevre, gorunur }: { veri: OlayVerisi; cevre: Cevre; gorunur: boolean }) {
  const geometriler = useMemo(() => Object.fromEntries(TURLER.map((t) => [t, agacGeometrisi(t)])), [])
  const basitler = useMemo(() => Object.fromEntries(TURLER.map((t) => [t, basitAgacGeometrisi(t)])), [])

  const ornekler = useMemo(() => {
    const r = rastgeleUreteci(2021)
    const karolar = new Map<string, Ornekler>()
    const m = new Matrix4()
    const q = new Quaternion()
    const yukari = new Vector3(0, 1, 0)
    const ekle = (x: number, y: number, z: number, yogunluk: number, hM: number, toa: number) => {
      const tur = turSec(yogunluk, hM, r)
      const s = (0.6 + r() * 0.75) * (tur === 'maki' ? 1.3 : yogunluk < 1 ? 0.75 : 1)
      q.setFromAxisAngle(yukari, r() * Math.PI * 2)
      m.compose(new Vector3(x, y - 0.01, z), q, new Vector3(s, s * (0.85 + r() * 0.4), s))
      const anahtar = `${tur}:${Math.floor(x / KARO_KM)}:${Math.floor(z / KARO_KM)}`
      let o = karolar.get(anahtar)
      if (!o) karolar.set(anahtar, (o = { matrisler: [], renkler: [], toa: [] }))
      o.matrisler.push(m.clone())
      o.renkler.push(TON[Math.floor(r() * TON.length)])
      o.toa.push(toa)
    }

    // Kare: gerçek örtü ve model varışı
    const { genislikKm: G, yukseklikKm: Y } = veri
    let adet = 0
    for (let deneme = 0; adet < ICERI_ADET && deneme < ICERI_ADET * 12; deneme++) {
      const x = (r() - 0.5) * G
      const z = (r() - 0.5) * Y
      const yogunluk = ORMAN_YOGUNLUGU[veri.ortu(x, z)]
      if (r() > yogunluk * yogunluk) continue
      const v = veri.toaSaat(x, z)
      ekle(x, veri.araziY(x, z), z, yogunluk, veri.yukseklikM(x, z), Number.isFinite(v) ? v : YANMADI_SAAT)
      adet++
    }

    // Çevre şeridi: sahte örtü yoğunluğu
    const Gd = G + 2 * DISARI_SERIT_KM
    const Yd = Y + 2 * DISARI_SERIT_KM
    adet = 0
    for (let deneme = 0; adet < DISARI_ADET && deneme < DISARI_ADET * 30; deneme++) {
      const x = (r() - 0.5) * Gd
      const z = (r() - 0.5) * Yd
      const d = cevre.uzaklik(x, z)
      if (d <= 0.05) continue
      // Uzaklaştıkça seyrelir (uzak ağaçlar sisin içinde zaten görünmez)
      if (r() > 1 - (d / DISARI_SERIT_KM) * 0.6) continue
      const p = cevre.nokta(x, z)
      if (p.su > 0.3 || r() > p.orman * p.orman) continue
      ekle(x, sahneY(p.hM), z, p.orman > 0.75 ? 1 : 0.55, p.hM, YANMADI_SAAT)
      adet++
    }
    return [...karolar.entries()].map(([anahtar, o]) => ({ anahtar, tur: anahtar.split(':')[0] as AgacTuru, o }))
  }, [veri, cevre])

  // Sisin ötesindeki karoları gizle (ağaçlar orada zaten görünmez); uzaktakiler basit modelle.
  const grup = useRef<Group>(null)
  useFrame(({ camera, scene }) => {
    const g = grup.current
    if (!g) return
    const sinir = scene.fog instanceof Fog ? scene.fog.far + KARO_KM : Infinity
    for (const karo of g.children) {
      const [ayrintili, basit] = karo.children as InstancedMesh[]
      const k = ayrintili.boundingSphere
      if (!k) continue
      const d = camera.position.distanceTo(k.center) - k.radius
      ayrintili.visible = d < AYRINTI_KM
      basit.visible = d >= AYRINTI_KM && d < sinir
    }
  })

  return (
    <group ref={grup} visible={gorunur}>
      {ornekler.map(({ anahtar, tur, o }) => (
        <group key={anahtar}>
          <AgacKumesi geometri={geometriler[tur]} ornekler={o} />
          <AgacKumesi geometri={basitler[tur]} ornekler={o} />
        </group>
      ))}
    </group>
  )
}

function AgacKumesi({ geometri, ornekler }: { geometri: ReturnType<typeof agacGeometrisi>; ornekler: Ornekler }) {
  const ref = useRef<InstancedMesh>(null)
  const { matrisler, renkler, toa } = ornekler
  // Her karonun kendi varış niteliği var: geometri kopyalanır (köşe tamponları paylaşılır)
  const kopya = useMemo(() => geometri.clone(), [geometri])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    matrisler.forEach((m, i) => {
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, renkler[i])
    })
    mesh.count = matrisler.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.geometry.setAttribute('aToa', new InstancedBufferAttribute(new Float32Array(toa), 1))
    mesh.computeBoundingSphere()
    // Salınım ve kabartma için pay
    mesh.boundingSphere?.expandByPoint(mesh.boundingSphere.center.clone().add(new Vector3(0, mesh.boundingSphere.radius * 0.1 + 0.3, 0)))
  }, [matrisler, renkler, toa])

  return (
    <instancedMesh
      ref={ref}
      args={[kopya, undefined, Math.max(matrisler.length, 1)]}
      raycast={() => null}
    >
      <meshLambertMaterial vertexColors onBeforeCompile={agacGolgelendirici} customProgramCacheKey={() => 'agac-yangin'} />
    </instancedMesh>
  )
}
