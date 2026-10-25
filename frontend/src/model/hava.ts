import { havaParametreleri as H, olay } from '../veri/ornekSenaryo'
import { gunlukDongu, yayilmaHiziMDk } from './yayilim'

/**
 * YER TUTUCU HAVA MODELİ: günlük döngülü (sıcak/kuru/rüzgârlı öğleden sonra,
 * serin/nemli gece) değerler. Gerçek sistemde Open-Meteo saatlik serisinden
 * yangın cephesindeki hücre için okunacak.
 */

export interface HavaDurumu {
  ruzgarKmSa: number
  /** Rüzgârın geldiği yön (derece). */
  ruzgarYonu: number
  sicaklik: number
  nem: number
  yakitNemi: number
  erc: number
  /** Alev boyu aralığı (m); yangın sönmüşse null. */
  alevBoyu: [number, number] | null
}

const SAAT = 3_600_000

/** Saat başına sabit, belirlenimci küçük sapma [-1, 1]. */
const sapma = (t: number, tohum: number) => {
  const x = Math.sin(Math.floor(t / SAAT) * 12.9898 + tohum * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

export function havaDurumu(t: number): HavaDurumu {
  const c = gunlukDongu(t)
  const gun = Math.max((t - olay.baslangic) / (24 * SAAT), 0)
  // İlk günler daha sıcak ve rüzgârlı, sonra hafif serinleme.
  const egilim = Math.exp(-gun / 4)

  const sicaklik = H.ortalamaSicaklik + H.sicaklikGenligi * c + 3 * egilim - 3 + sapma(t, 1)
  const nem = Math.max(H.ortalamaNem - H.nemGenligi * c - 6 * egilim + 6 + 2 * sapma(t, 2), 5)
  const ruzgarKmSa = Math.max(
    H.ortalamaRuzgar + H.ruzgarGenligi * c + 10 * egilim - 4 + 3 * sapma(t, 3),
    3,
  )
  // Gündüz kuzey-kuzeybatı, gece kara meltemiyle kuzeye döner.
  const ruzgarYonu = (H.ruzgarYonu + 14 * c + 8 + 6 * sapma(t, 4) + 360) % 360
  const yakitNemi = Math.max(5 + 3 * (nem - 30) / 20, 2)
  const erc = Math.round(70 + 10 * c + 12 * egilim - 4 * Math.max(gun - 6, 0))

  const hiz = yayilmaHiziMDk(t)
  const alevBoyu: [number, number] | null =
    t < olay.baslangic || hiz < 0.4
      ? null
      : (() => {
          const L = 0.8 * Math.sqrt(hiz)
          return [Math.max(Math.round(L * 0.7 * 10) / 10, 0.3), Math.round(L * 1.15 * 10) / 10]
        })()

  return {
    ruzgarKmSa: Math.round(ruzgarKmSa),
    ruzgarYonu: Math.round(ruzgarYonu),
    sicaklik: Math.round(sicaklik),
    nem: Math.round(nem),
    yakitNemi: Math.round(yakitNemi),
    erc,
    alevBoyu,
  }
}

const YONLER = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB']

/** 16 yönlü pusula kısaltması (Türkçe). */
export const pusulaYonu = (derece: number) => YONLER[Math.round((((derece % 360) + 360) % 360) / 22.5) % 16]
