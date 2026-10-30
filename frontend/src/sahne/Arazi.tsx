import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color } from 'three'
import { useOlay } from '../durum/olay'
import { YOK } from '../olay/api'
import { ORMAN_YOGUNLUGU, ORTU_SIRASI, sahneY, type OlayVerisi, type OrtuSinifi } from '../olay/veri'
import { araziGolgelendirici, YANMADI_SAAT } from './yanginMalzemesi'

/** Örtü sınıfına göre zemin rengi (yangın katmanlarının önüne geçmeyecek kadar soluk). */
export const ORTU_RENGI: Record<OrtuSinifi, Color> = {
  diger: new Color('#b3a48a'),
  orman: new Color('#5d6a38'),
  maki: new Color('#858552'),
  ot: new Color('#c2b07c'),
  tarim: new Color('#c9b07e'),
  su: new Color('#3f6f80'),
  yerlesim: new Color('#a9a198'),
}
const kaya = new Color('#a39a8c')
const yuksek = new Color('#b19a7e')

/**
 * Köşe rengi: örtü, yükseklik ve eğim; vadiler biraz koyu, sırtlar biraz açık (eğrilikten
 * yaklaşık ortam kapanması). Çevre arazisi de aynı kuralla boyanır, dikiş görünmesin.
 */
export function zeminRengi(hedef: Color, ortu: Color, hM: number, egim: number, cukurlukM: number, su: boolean) {
  hedef.copy(ortu)
  if (su) return hedef
  hedef.lerp(yuksek, Math.min(Math.max((hM - 800) / 1200, 0), 1) * 0.5)
  hedef.lerp(kaya, Math.min(Math.max((egim - 25) / 20, 0), 1) * 0.5)
  return hedef.multiplyScalar(1 - Math.min(Math.max(cukurlukM / 120, -0.18), 0.3))
}

/** Çevresinin ortalamasına göre ne kadar çukurda (m; pozitif: vadi). */
export function cukurluk(yukseklikM: (x: number, z: number) => number, x: number, z: number, r = 0.45) {
  const h = yukseklikM(x, z)
  const ort = (yukseklikM(x + r, z) + yukseklikM(x - r, z) + yukseklikM(x, z + r) + yukseklikM(x, z - r)) / 4
  return ort - h
}

/** Arazi ve çevre örgüsünün ortak malzemesi (yangın ve su gölgelendiricisiyle). */
export function AraziMalzemesi({ geri = false }: { geri?: boolean }) {
  return (
    <meshStandardMaterial
      vertexColors
      roughness={1}
      metalness={0}
      polygonOffset={geri}
      polygonOffsetFactor={geri ? 2 : 0}
      polygonOffsetUnits={geri ? 4 : 0}
      onBeforeCompile={araziGolgelendirici}
      customProgramCacheKey={() => 'arazi-yangin'}
    />
  )
}

/**
 * Izgara üzerinde 3 × 3 kutu bulanıklığı (`gecis` kez). Sentinel-2 oranının tek hücrelik lekeleri
 * 0,5'in altına iner; yanık izi ve sınırı yalnızca bütünlüklü alanların çevresine çizilir.
 */
function kutuBulanikligi(a: Float32Array, satir: number, sutun: number, gecis: number) {
  let kaynak = a
  for (let g = 0; g < gecis; g++) {
    const hedef = new Float32Array(kaynak.length)
    for (let i = 0; i < satir; i++) {
      for (let j = 0; j < sutun; j++) {
        let top = 0
        let say = 0
        for (let di = -1; di <= 1; di++) {
          const ii = i + di
          if (ii < 0 || ii >= satir) continue
          for (let dj = -1; dj <= 1; dj++) {
            const jj = j + dj
            if (jj < 0 || jj >= sutun) continue
            top += kaynak[ii * sutun + jj]
            say++
          }
        }
        hedef[i * sutun + j] = top / say
      }
    }
    kaynak = hedef
  }
  return kaynak
}

/** Gerçek DEM'den arazi örgüsü; köşe başına model varışı, gerçek yanık, olasılık, FIRMS taşır. */
export function Arazi({ veri }: { veri: OlayVerisi }) {
  const imlecAyarla = useOlay((d) => d.imlecAyarla)
  const geometri = useMemo(() => {
    const { satir, sutun, r } = veri
    const n = satir * sutun
    const konum = new Float32Array(n * 3)
    const renk = new Float32Array(n * 3)
    const toa = new Float32Array(n)
    const yandi = new Float32Array(n)
    const gercek = new Float32Array(n)
    const olasilik = new Float32Array(n)
    const firms = new Float32Array(n)
    const orman = new Float32Array(n)
    const su = new Float32Array(n)
    const c = new Color()
    const yM = (x: number, z: number) => veri.yukseklikM(x, z)
    for (let i = 0; i < satir; i++) {
      for (let j = 0; j < sutun; j++) {
        const k = i * sutun + j
        const { x, z } = veri.hucreKonumu(i, j)
        const h = r.yukseklik[k]
        const ortu = ORTU_SIRASI[r.ortu[k]] ?? 'diger'
        konum.set([x, ortu === 'su' ? Math.max(sahneY(h), 0) : sahneY(h), z], k * 3)
        const { egim } = veri.egimVeBaki(x, z)
        zeminRengi(c, ORTU_RENGI[ortu], h, egim, cukurluk(yM, x, z), ortu === 'su').toArray(renk, k * 3)
        su[k] = ortu === 'su' ? 1 : 0
        const model = r.modelToa[k]
        toa[k] = model === YOK ? YANMADI_SAAT : model / 60
        yandi[k] = model === YOK ? 0 : 1
        gercek[k] = r.gercek[k] / 255
        olasilik[k] = r.olasilik[k] / 255
        firms[k] = r.firmsToa[k] === YOK ? YANMADI_SAAT : r.firmsToa[k] / 60
        orman[k] = ORMAN_YOGUNLUGU[ortu]
      }
    }
    const indis = new Uint32Array((satir - 1) * (sutun - 1) * 6)
    let p = 0
    for (let i = 0; i < satir - 1; i++) {
      for (let j = 0; j < sutun - 1; j++) {
        const a = i * sutun + j
        const b = a + 1
        const d = a + sutun
        const e = d + 1
        indis.set([a, d, b, b, d, e], p)
        p += 6
      }
    }
    const g = new BufferGeometry()
    g.setIndex(new BufferAttribute(indis, 1))
    g.setAttribute('position', new BufferAttribute(konum, 3))
    g.setAttribute('color', new BufferAttribute(renk, 3))
    g.setAttribute('aToa', new BufferAttribute(toa, 1))
    g.setAttribute('aYandi', new BufferAttribute(yandi, 1))
    g.setAttribute('aGercek', new BufferAttribute(gercek, 1))
    g.setAttribute('aGercekYumusak', new BufferAttribute(kutuBulanikligi(gercek, satir, sutun, 2), 1))
    g.setAttribute('aOlasilik', new BufferAttribute(olasilik, 1))
    g.setAttribute('aFirms', new BufferAttribute(firms, 1))
    g.setAttribute('aOrman', new BufferAttribute(orman, 1))
    g.setAttribute('aSu', new BufferAttribute(su, 1))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [veri])

  const imlec = (e: ThreeEvent<PointerEvent>) => imlecAyarla({ x: e.point.x, z: e.point.z })

  return (
    <mesh geometry={geometri} receiveShadow onPointerMove={imlec} onPointerOut={() => imlecAyarla(null)}>
      <AraziMalzemesi />
    </mesh>
  )
}
