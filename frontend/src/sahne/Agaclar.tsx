import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, ConeGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { egimVeBaki, ormanYogunlugu, sahneY, yukseklikM } from '../model/arazi'
import { rastgeleUreteci } from '../model/gurultu'
import { sinirOrani, varisZamaniSaat } from '../model/yayilim'
import { agacGolgelendirici, disVarisZamani } from './yanginMalzemesi'

/**
 * Yamaçlara serpilmiş düşük poligonlu iğne yapraklılar (örneklenmiş çizim).
 * Ölçek stilize: ağaçlar görünür olsun diye gerçeğinden büyüktür.
 */

const ADET = 42_000
const BOLGE = { x0: -42, x1: 42, z0: -48, z1: 27 }

export function Agaclar({ gorunur }: { gorunur: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  const geometri = useMemo(() => {
    const g = new ConeGeometry(0.075, 0.3, 5, 1)
    g.translate(0, 0.13, 0)
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
    let deneme = 0
    while (matrisler.length < ADET && deneme < ADET * 12) {
      deneme++
      const x = BOLGE.x0 + r() * (BOLGE.x1 - BOLGE.x0)
      const z = BOLGE.z0 + r() * (BOLGE.z1 - BOLGE.z0)
      const h = yukseklikM(x, z)
      const esik = r()
      // Önce eğimsiz (üst sınır) yoğunlukla ucuz eleme, sonra gerçek eğimle.
      const ust = ormanYogunlugu(x, z, h, 0)
      if (esik > ust * ust * 1.1) continue
      const o = ormanYogunlugu(x, z, h, egimVeBaki(x, z).egim)
      if (esik > o * o * 1.1) continue
      const s = 0.6 + r() * 0.75
      q.setFromAxisAngle(yukari, r() * Math.PI * 2)
      m.compose(new Vector3(x, sahneY(h) - 0.01, z), q, new Vector3(s, s * (0.85 + r() * 0.4), s))
      toa[matrisler.length] = (() => {
        const v = varisZamaniSaat(x, z)
        return Number.isFinite(v) ? v : disVarisZamani(sinirOrani(x, z))
      })()
      matrisler.push(m.clone())
      renkler.push(palet[Math.floor(r() * palet.length)])
    }
    return { matrisler, renkler, toa: toa.slice(0, matrisler.length) }
  }, [])

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
