import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, ConeGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { rastgeleUreteci } from '../model/gurultu'
import type { OlayVerisi } from '../olay/veri'
import { ORMAN_YOGUNLUGU } from './Arazi'
import { agacGolgelendirici, YANMADI_SAAT } from './yanginMalzemesi'

/**
 * WorldCover orman ve maki hücrelerine serpilmiş düşük poligonlu ağaçlar (örneklenmiş çizim).
 * Ölçek stilize: ağaçlar görünür olsun diye gerçeğinden büyüktür; konumları gerçek örtüden gelir.
 */

const ADET = 42_000

export function Agaclar({ veri, gorunur }: { veri: OlayVerisi; gorunur: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const geometri = useMemo(() => {
    const g = new ConeGeometry(0.06, 0.24, 5, 1)
    g.translate(0, 0.1, 0)
    return g
  }, [])

  const { matrisler, renkler, toa } = useMemo(() => {
    const r = rastgeleUreteci(2021)
    const matrisler: Matrix4[] = []
    const renkler: Color[] = []
    const toa = new Float32Array(ADET)
    const m = new Matrix4()
    const q = new Quaternion()
    const yukari = new Vector3(0, 1, 0)
    const palet = ['#2f3d22', '#3a4a29', '#44542e', '#2a3520', '#4f5a33'].map((c) => new Color(c))
    const { genislikKm: G, yukseklikKm: Y } = veri
    let deneme = 0
    while (matrisler.length < ADET && deneme < ADET * 12) {
      deneme++
      const x = (r() - 0.5) * G
      const z = (r() - 0.5) * Y
      const yogunluk = ORMAN_YOGUNLUGU[veri.ortu(x, z)]
      if (r() > yogunluk * yogunluk) continue
      const s = (0.6 + r() * 0.75) * (yogunluk < 1 ? 0.7 : 1)
      q.setFromAxisAngle(yukari, r() * Math.PI * 2)
      m.compose(new Vector3(x, veri.araziY(x, z) - 0.01, z), q, new Vector3(s, s * (0.85 + r() * 0.4), s))
      const v = veri.toaSaat(x, z)
      toa[matrisler.length] = Number.isFinite(v) ? v : YANMADI_SAAT
      matrisler.push(m.clone())
      renkler.push(palet[Math.floor(r() * palet.length)])
    }
    return { matrisler, renkler, toa: toa.slice(0, matrisler.length) }
  }, [veri])

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
    mesh.geometry.setAttribute('aToa', new InstancedBufferAttribute(toa, 1))
    mesh.computeBoundingSphere()
  }, [matrisler, renkler, toa])

  return (
    <instancedMesh ref={ref} args={[geometri, undefined, ADET]} visible={gorunur} frustumCulled={false}>
      <meshLambertMaterial flatShading onBeforeCompile={agacGolgelendirici} customProgramCacheKey={() => 'agac-yangin'} />
    </instancedMesh>
  )
}
