import { baraj } from '../veri/ornekSenaryo'
import { fbm, simplexOlustur, sirtliFbm, yumusakBasamak } from './gurultu'

/**
 * YER TUTUCU: gürültüyle üretilmiş dağlık arazi. Gerçek DEM (Copernicus
 * GLO-30) arka uçtan geldiğinde `yukseklikM` bir raster örneklemesiyle
 * değiştirilecek; geri kalan her şey bu fonksiyona bağlıdır.
 *
 * Koordinatlar km: +x doğu, -z kuzey. Kuzey iç kesim dağlık (Toroslar),
 * güney kıyı düzlüğü ve deniz.
 */

export const ARAZI_BOYUT_KM = 130
/** Arazinin merkezi (z, km): kamera kuzeyden baktığı için kuzeye kaydırılmış. */
export const ARAZI_MERKEZ_Z = -14
/** Sahnede yüksekliği okunur kılmak için düşey abartı. */
export const DIKEY_ABARTI = 2.3
export const KIYI_Z = 29

const g1 = simplexOlustur(7)
const g2 = simplexOlustur(19)
const g3 = simplexOlustur(42)

/** Deniz seviyesine göre yükseklik (m). */
export function yukseklikM(x: number, z: number): number {
  const icKesim = yumusakBasamak(KIYI_Z, -40, z)
  const kiyi = yumusakBasamak(KIYI_Z - 6, KIYI_Z + 3, z)

  let h = 40 + 900 * Math.pow(icKesim, 1.15)
  h += sirtliFbm(g1, x * 0.045 + 3.1, z * 0.045 - 1.7, 5) * 1100 * (0.35 + 0.65 * icKesim)
  h += sirtliFbm(g3, x * 0.15 - 7.3, z * 0.15 + 2.2, 5) * 650 * (0.35 + 0.65 * icKesim)
  h += sirtliFbm(g2, x * 0.36 + 1.3, z * 0.36 - 4.1, 3) * 280 * (0.4 + 0.6 * icKesim)
  h += fbm(g2, x * 0.9, z * 0.9, 2) * 25
  h = h * (1 - kiyi) - 80 * kiyi
  // Kıyı çizgisine kadar kara deniz seviyesinin üstünde kalsın (iç lagünler oluşmasın).
  if (z < KIYI_Z - 1) h = Math.max(h, 6 + (KIYI_Z - 1 - z) * 5)

  // Baraj gölü çanağı
  const dx = x - baraj.x
  const dz = z - baraj.z
  const c = Math.cos(baraj.aci)
  const s = Math.sin(baraj.aci)
  const u = (dx * c - dz * s) / baraj.yaricapX
  const v = (dx * s + dz * c) / baraj.yaricapZ
  const kivrim = fbm(g3, x * 0.3, z * 0.3, 2) * 0.35
  const m = Math.exp(-Math.pow(u * u + v * v + kivrim, 1.6))
  h = h * (1 - m) + (baraj.suSeviyesiM - 90) * m

  return h
}

/** Metreden sahne birimine (km × abartı). */
export const sahneY = (hM: number) => (Math.max(hM, -60) / 1000) * DIKEY_ABARTI

/** Sahne yüksekliği (birim). */
export const araziY = (x: number, z: number) => sahneY(yukseklikM(x, z))

/** Eğim (derece) ve bakı (derece, kuzeyden saat yönünde, yamacın baktığı yön). */
export function egimVeBaki(x: number, z: number) {
  const e = 0.05
  const hx = (yukseklikM(x + e, z) - yukseklikM(x - e, z)) / (2 * e * 1000)
  const hz = (yukseklikM(x, z + e) - yukseklikM(x, z - e)) / (2 * e * 1000)
  const egim = (Math.atan(Math.hypot(hx, hz)) * 180) / Math.PI
  // Yamaç aşağı yön: (-hx, -hz); kuzey = -z
  const dogu = -hx
  const kuzey = hz
  const baki = ((Math.atan2(dogu, kuzey) * 180) / Math.PI + 360) % 360
  return { egim, baki }
}

/** Orman yoğunluğu 0..1 (yer tutucu bitki örtüsü; gerçeği ESA WorldCover). */
export function ormanYogunlugu(x: number, z: number, hM: number, egim: number) {
  const n = fbm(g2, x * 0.07 + 11, z * 0.07 - 5, 4)
  const yukseklikUygun = yumusakBasamak(20, 160, hM) * (1 - yumusakBasamak(1500, 1900, hM))
  const egimUygun = 1 - yumusakBasamak(30, 45, egim)
  return Math.min(Math.max((n * 1.5 + 0.5) * yukseklikUygun * egimUygun, 0), 1)
}
