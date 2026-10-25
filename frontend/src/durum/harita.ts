import { create } from 'zustand'

/** Harita görünümü: kamera kipi, yakınlaştırma ve kameradan türetilen göstergeler. */
export type GorunumKipi = '2B' | '3B'

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
  kameraGuncelle: (d: { zoom: number; yon: number; pikselBasinaM: number }) => void
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
  kameraGuncelle: (d) => set(d),
}))
