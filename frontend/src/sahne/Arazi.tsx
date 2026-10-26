import type { ThreeEvent } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color } from 'three'
import { useOlay } from '../durum/olay'
import { YOK } from '../olay/api'
import { ORTU_SIRASI, sahneY, type OlayVerisi, type OrtuSinifi } from '../olay/veri'
import { araziGolgelendirici, YANMADI_SAAT } from './yanginMalzemesi'

/** Örtü sınıfına göre zemin rengi (soluk; yangın katmanlarının önüne geçmesin). */
const ORTU_RENGI: Record<OrtuSinifi, Color> = {
  diger: new Color('#b8ab95'),
  orman: new Color('#6f7446'),
  maki: new Color('#8f8c5c'),
  ot: new Color('#c4b486'),
  tarim: new Color('#cdb78a'),
  su: new Color('#6f93a6'),
  yerlesim: new Color('#a9a198'),
}
const kaya = new Color('#a39a8c')
const yuksek = new Color('#b19a7e')

/** Orman yoğunluğu (bitki örtüsü benekleri ve ağaçlar için). */
export const ORMAN_YOGUNLUGU: Record<OrtuSinifi, number> = {
  diger: 0,
  orman: 1,
  maki: 0.55,
  ot: 0.1,
  tarim: 0.05,
  su: 0,
  yerlesim: 0,
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
    const c = new Color()
    for (let i = 0; i < satir; i++) {
      for (let j = 0; j < sutun; j++) {
        const k = i * sutun + j
        const { x, z } = veri.hucreKonumu(i, j)
        const h = r.yukseklik[k]
        const ortu = ORTU_SIRASI[r.ortu[k]] ?? 'diger'
        konum.set([x, ortu === 'su' ? Math.max(sahneY(h), 0) : sahneY(h), z], k * 3)
        const { egim } = veri.egimVeBaki(x, z)
        c.copy(ORTU_RENGI[ortu])
        if (ortu !== 'su') {
          c.lerp(yuksek, Math.min(Math.max((h - 800) / 1200, 0), 1) * 0.5)
          c.lerp(kaya, Math.min(Math.max((egim - 25) / 20, 0), 1) * 0.5)
        }
        c.toArray(renk, k * 3)
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
    g.setAttribute('aOlasilik', new BufferAttribute(olasilik, 1))
    g.setAttribute('aFirms', new BufferAttribute(firms, 1))
    g.setAttribute('aOrman', new BufferAttribute(orman, 1))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [veri])

  const imlec = (e: ThreeEvent<PointerEvent>) => imlecAyarla({ x: e.point.x, z: e.point.z })

  return (
    <mesh geometry={geometri} receiveShadow onPointerMove={imlec} onPointerOut={() => imlecAyarla(null)}>
      <meshStandardMaterial
        vertexColors
        roughness={1}
        metalness={0}
        onBeforeCompile={araziGolgelendirici}
        customProgramCacheKey={() => 'arazi-yangin'}
      />
    </mesh>
  )
}
