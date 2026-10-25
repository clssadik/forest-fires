import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color } from 'three'
import { ARAZI_BOYUT_KM, ARAZI_MERKEZ_Z, ormanYogunlugu, sahneY, yukseklikM } from '../model/arazi'
import { sinirOrani, varisZamaniSaat } from '../model/yayilim'
import { araziGolgelendirici, disVarisZamani } from './yanginMalzemesi'

const BOLUM = 520

/** Yükseklik ve eğime göre sıcak bej/kahve zemin rengi. */
const kiyi = new Color('#d2b88c')
const orta = new Color('#c4a273')
const yuksek = new Color('#b19a7e')
const kaya = new Color('#a39a8c')
const yesil = new Color('#7d7a4c')

function zeminRengi(hM: number, egim: number, orman: number, hedef: Color) {
  if (hM < 400) hedef.copy(kiyi).lerp(orta, hM / 400)
  else hedef.copy(orta).lerp(yuksek, Math.min((hM - 400) / 1300, 1))
  hedef.lerp(kaya, Math.min(Math.max((egim - 22) / 25, 0), 1) * 0.6)
  hedef.lerp(yesil, orman * 0.35)
  return hedef
}

/** Prosedürel arazi örgüsü; köşe başına varış zamanı ve orman yoğunluğu taşır. */
export function Arazi() {
  const geometri = useMemo(() => {
    const n = BOLUM + 1
    const konum = new Float32Array(n * n * 3)
    const renk = new Float32Array(n * n * 3)
    const toa = new Float32Array(n * n)
    const sinir = new Float32Array(n * n)
    const orman = new Float32Array(n * n)
    const c = new Color()
    const yarim = ARAZI_BOYUT_KM / 2
    const adim = ARAZI_BOYUT_KM / BOLUM
    // Önce yükseklikler; eğim komşu köşelerden (her köşede gürültüyü yeniden hesaplamamak için).
    const yuk = new Float32Array(n * n)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) yuk[j * n + i] = yukseklikM(-yarim + i * adim, ARAZI_MERKEZ_Z - yarim + j * adim)
    const h0 = (i: number, j: number) => yuk[Math.min(Math.max(j, 0), BOLUM) * n + Math.min(Math.max(i, 0), BOLUM)]
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i
        const x = -yarim + i * adim
        const z = ARAZI_MERKEZ_Z - yarim + j * adim
        const h = yuk[k]
        const gx = (h0(i + 1, j) - h0(i - 1, j)) / (2 * adim * 1000)
        const gz = (h0(i, j + 1) - h0(i, j - 1)) / (2 * adim * 1000)
        const egim = (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI
        const o = ormanYogunlugu(x, z, h, egim)
        konum.set([x, sahneY(h), z], k * 3)
        zeminRengi(h, egim, o, c).toArray(renk, k * 3)
        const oran = sinirOrani(x, z)
        const v = varisZamaniSaat(x, z)
        toa[k] = Number.isFinite(v) ? v : disVarisZamani(oran)
        sinir[k] = oran
        orman[k] = o
      }
    }
    const indis = new Uint32Array(BOLUM * BOLUM * 6)
    let p = 0
    for (let j = 0; j < BOLUM; j++) {
      for (let i = 0; i < BOLUM; i++) {
        const a = j * n + i
        const b = a + 1
        const d = a + n
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
    g.setAttribute('aSinir', new BufferAttribute(sinir, 1))
    g.setAttribute('aOrman', new BufferAttribute(orman, 1))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [])

  return (
    <mesh geometry={geometri} receiveShadow>
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
