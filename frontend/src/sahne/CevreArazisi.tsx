import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color } from 'three'
import { yumusakBasamak } from '../model/gurultu'
import { sahneY, type OlayVerisi } from '../olay/veri'
import { AraziMalzemesi, ORTU_RENGI, zeminRengi } from './Arazi'
import type { Cevre, CevreOrgusu } from './cevre'
import { ARAZI_NITELIKLERI, YANMADI_SAAT } from './yanginMalzemesi'

/**
 * Karenin dışındaki sahte çevre arazisi (yalnızca görünüm). Örgü kenarda gerçek arazinin
 * köşelerinden geçer ve bir hücre içeri taşıp gerçek arazinin biraz altında kalır: dikişte
 * boşluk görünmez. Aynı malzemeyle boyanır; yangın katmanları burada hiçbir şey çizmez.
 */

/** İçeri taşan eteğin üstteki örgünün ne kadar altında kalacağı (sahne birimi). */
const ETEK_ALTI = 0.03
/** Uzak örgünün eteği kaba olduğu için ince örgünün vadilerinden taşmasın diye çok daha derinde. */
const UZAK_ETEK_ALTI = 0.8
const KAYA = new Color('#9a9488')

export function CevreArazisi({ veri, cevre }: { veri: OlayVerisi; cevre: Cevre }) {
  const yakin = useMemo(() => orguKur(veri, cevre, cevre.yakin, ETEK_ALTI), [veri, cevre])
  const uzak = useMemo(() => orguKur(veri, cevre, cevre.uzak, UZAK_ETEK_ALTI), [veri, cevre])
  return (
    <>
      <mesh geometry={yakin} raycast={() => null}>
        <AraziMalzemesi geri />
      </mesh>
      <mesh geometry={uzak} raycast={() => null}>
        <AraziMalzemesi geri />
      </mesh>
    </>
  )
}

/** Delikli dikdörtgen örgü: sahte yükseklik, renk, normal ve arazi gölgelendiricisinin nitelikleri. */
function orguKur(veri: OlayVerisi, cevre: Cevre, orgu: CevreOrgusu, etekAlti: number) {
  const { xs, zs, delikX, delikZ } = orgu
  const nx = xs.length
  const nz = zs.length
  const n = nx * nz
  const konum = new Float32Array(n * 3)
  const renk = new Float32Array(n * 3)
  const normal = new Float32Array(n * 3)
  const suDizi = new Float32Array(n)
  const ormanDizi = new Float32Array(n)
  const hDizi = new Float32Array(n)
  const c = new Color()
  const sahte = new Color()

  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nx; j++) {
      const k = i * nx + j
      const p = cevre.nokta(xs[j], zs[i])
      hDizi[k] = p.hM
      suDizi[k] = p.su
      ormanDizi[k] = p.orman
    }
  }
  const yAl = (k: number) => {
    const y = suDizi[k] > 0.5 ? Math.max(sahneY(hDizi[k]), 0) : sahneY(hDizi[k])
    return y
  }
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nx; j++) {
      const k = i * nx + j
      const x = xs[j]
      const z = zs[i]
      const d = cevre.uzaklik(x, z)
      const ic = Math.abs(x) < delikX - 1e-6 && Math.abs(z) < delikZ - 1e-6
      konum.set([x, yAl(k) - (ic ? etekAlti : 0), z], k * 3)

      // Normal: komşu köşelerden merkezi fark (aralık eşit değil)
      const j0 = Math.max(j - 1, 0)
      const j1 = Math.min(j + 1, nx - 1)
      const i0 = Math.max(i - 1, 0)
      const i1 = Math.min(i + 1, nz - 1)
      const dydx = (yAl(i * nx + j1) - yAl(i * nx + j0)) / (xs[j1] - xs[j0])
      const dydz = (yAl(i1 * nx + j) - yAl(i0 * nx + j)) / (zs[i1] - zs[i0])
      const l = Math.hypot(dydx, 1, dydz)
      normal.set([-dydx / l, 1 / l, -dydz / l], k * 3)

      // Renk: kenarda gerçek örtünün rengi, dışarıda yoğunluktan sahte örtü
      const o = ormanDizi[k]
      const su = suDizi[k] > 0.5
      // Kıyı ovası tarla, yamaçlar kuru ot ve kaya; ormanlık yerler koyu yeşil
      sahte.copy(hDizi[k] < 120 ? ORTU_RENGI.tarim : ORTU_RENGI.ot).lerp(KAYA, yumusakBasamak(900, 1700, hDizi[k]) * 0.6)
      sahte.lerp(ORTU_RENGI.maki, yumusakBasamak(0.1, 0.5, o))
      sahte.lerp(ORTU_RENGI.orman, yumusakBasamak(0.5, 0.9, o))
      if (su) sahte.copy(ORTU_RENGI.su)
      c.copy(ORTU_RENGI[veri.ortuKenetli(x, z)]).lerp(sahte, yumusakBasamak(0, 3, d))
      const egim = (Math.atan(Math.hypot(dydx, dydz) / 2) * 180) / Math.PI // sahneY ×2 abartıyı geri al
      const ort4 = (hDizi[i * nx + j0] + hDizi[i * nx + j1] + hDizi[i0 * nx + j] + hDizi[i1 * nx + j]) / 4
      zeminRengi(c, c, hDizi[k], egim, (ort4 - hDizi[k]) * 2, su).toArray(renk, k * 3)
    }
  }

  // İçteki dörtgenler atlanır; kenar şeridi (bir dörtgen) gerçek arazinin altında etek olur.
  const icX = (j: number) => Math.abs(xs[j]) < delikX - 1e-6
  const icZ = (i: number) => Math.abs(zs[i]) < delikZ - 1e-6
  const indis: number[] = []
  for (let i = 0; i < nz - 1; i++) {
    for (let j = 0; j < nx - 1; j++) {
      if (icX(j) && icX(j + 1) && icZ(i) && icZ(i + 1)) {
        // Eteğin bir dörtgen içinde kalması için: komşu dörtgenlerden biri dışarıdaysa çiz
        const kenarda = !icX(j - 1) || !icX(j + 2) || !icZ(i - 1) || !icZ(i + 2)
        if (!kenarda) continue
      }
      const a = i * nx + j
      const b = a + 1
      const dd = a + nx
      const e = dd + 1
      indis.push(a, dd, b, b, dd, e)
    }
  }

  const g = new BufferGeometry()
  g.setIndex(indis)
  g.setAttribute('position', new BufferAttribute(konum, 3))
  g.setAttribute('normal', new BufferAttribute(normal, 3))
  g.setAttribute('color', new BufferAttribute(renk, 3))
  const sabit = (deger: number) => new BufferAttribute(new Float32Array(n).fill(deger), 1)
  for (const ad of ARAZI_NITELIKLERI) {
    if (ad === 'aToa') g.setAttribute(ad, sabit(YANMADI_SAAT))
    else g.setAttribute(ad, sabit(0))
  }
  g.setAttribute('aOrman', new BufferAttribute(ormanDizi, 1))
  g.setAttribute('aSu', new BufferAttribute(suDizi, 1))
  g.computeBoundingSphere()
  return g
}
