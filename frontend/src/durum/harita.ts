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
}))
