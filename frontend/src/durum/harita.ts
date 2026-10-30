import { create } from 'zustand'

/** Harita görünümü: kamera kipi, yakınlaştırma ve kameradan türetilen göstergeler. */
export type GorunumKipi = '2B' | '3B'

const DETAY_ANAHTARI = 'orman.detaylar'

/** Detaylar kartının açık olup olmadığı tarayıcıda hatırlanır; depolama kapalıysa açık başlar. */
function detaylarOku() {
  try {
    return globalThis.localStorage?.getItem(DETAY_ANAHTARI) !== 'kapali'
  } catch {
    return true
  }
}

function detaylarYaz(acik: boolean) {
  try {
    globalThis.localStorage?.setItem(DETAY_ANAHTARI, acik ? 'acik' : 'kapali')
  } catch {
    // Depolama kapalı: tercih yalnızca bu oturumda geçerli.
  }
}

interface HaritaDurumu {
  kip: GorunumKipi
  /** Kameranın şu anki yakınlaştırması (varsayılan uzaklığa oran). */
  zoom: number
  /** Kullanıcının menüden seçtiği hedef yakınlaştırma; kamera buna gider. */
  hedefZoom: number | null
  /** Kameranın baktığı yön (derece, kuzeyden saat yönünde). */
  yon: number
  /** Ekranda 1 pikselin karşılığı (m). */
  pikselBasinaM: number
  kipAyarla: (kip: GorunumKipi) => void
  zoomIste: (zoom: number) => void
  zoomTamamlandi: () => void
  /** Kameranın yumuşak geçişle gideceği sahne noktası (km); null = istek yok. */
  odak: { x: number; z: number } | null
  odaklanIste: (x: number, z: number) => void
  odakTamamlandi: () => void
  /** 3B döndürme isteği (derece): yatay = pusula yönünde, dikey = eğim; kuzey = kuzeyi yukarı al. */
  donme: { yatay: number; dikey: number; kuzey: boolean } | null
  donmeIste: (yatay: number, dikey: number) => void
  kuzeyeDon: () => void
  donmeTamamlandi: () => void
  kameraGuncelle: (d: { zoom: number; yon: number; pikselBasinaM: number }) => void
  /** Fare altındaki hücrenin Detaylar kartı gösterilsin mi. */
  detaylar: boolean
  detaylarAcKapat: () => void
}

export const useHarita = create<HaritaDurumu>((set) => ({
  kip: '3B',
  zoom: 1,
  hedefZoom: null,
  yon: 0,
  pikselBasinaM: 50,
  kipAyarla: (kip) => set({ kip }),
  zoomIste: (zoom) => set({ hedefZoom: zoom }),
  zoomTamamlandi: () => set({ hedefZoom: null }),
  odak: null,
  odaklanIste: (x, z) => set({ odak: { x, z } }),
  odakTamamlandi: () => set({ odak: null }),
  donme: null,
  donmeIste: (yatay, dikey) => set({ donme: { yatay, dikey, kuzey: false } }),
  kuzeyeDon: () => set({ donme: { yatay: 0, dikey: 0, kuzey: true } }),
  donmeTamamlandi: () => set({ donme: null }),
  kameraGuncelle: (d) => set(d),
  detaylar: detaylarOku(),
  detaylarAcKapat: () =>
    set((d) => {
      detaylarYaz(!d.detaylar)
      return { detaylar: !d.detaylar }
    }),
}))
