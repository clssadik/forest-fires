import { yukseklikM } from './arazi'
import { eksenNoktasi, sonCepheMesafesiM } from './yayilim'

/** Yükseklik profili için seçili yolun uzunluğu (km): ana yayılım ekseni. */
export const PROFIL_UZUNLUK_KM = Math.ceil(sonCepheMesafesiM / 1000)

export interface ProfilNoktasi {
  km: number
  hM: number
}

/** Ana yayılım ekseni boyunca yükseklik profili. */
export function yukseklikProfili(adet = 120): ProfilNoktasi[] {
  return Array.from({ length: adet + 1 }, (_, i) => {
    const km = (i / adet) * PROFIL_UZUNLUK_KM
    const p = eksenNoktasi(km * 1000)
    return { km, hM: yukseklikM(p.x, p.z) }
  })
}
