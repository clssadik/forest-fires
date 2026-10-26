import { create } from 'zustand'
import * as api from '../dogrulama/api'
import type { AnlikSayilar, Rasterlar, RenkKipi } from '../dogrulama/boyama'
import { useZaman } from './zaman'

const SAAT = 3_600_000
/** Ekran açılınca imlecin durduğu an (tutuşmadan sonra). */
const ACILIS_SAAT = 24

export type DogrulamaKatmani = 'model' | 'gercek' | 'firms' | 'altlik' | 'osm'

interface DogrulamaDurumu {
  ad: string
  yukleme: 'bos' | 'yukleniyor' | 'hazir' | 'hata'
  hata: string | null
  bilgi: api.YanginBilgisi | null
  sonuc: api.SimulasyonSonucu | null
  rasterlar: Rasterlar | null
  simulasyon: 'bos' | 'calisiyor' | 'hata'
  simulasyonHatasi: string | null
  katmanlar: Record<DogrulamaKatmani, boolean>
  renkKipi: RenkKipi
  /** Haritanın t anındaki sayımları (hücre). */
  anlik: AnlikSayilar | null
  yukle: () => Promise<void>
  simulasyonCalistir: () => Promise<void>
  katmanAcKapa: (k: DogrulamaKatmani) => void
  renkKipiAyarla: (k: RenkKipi) => void
  anlikAyarla: (s: AnlikSayilar) => void
  /** Doğrulama ekranının zaman aralığını (tutuşma → model bitişi) global zamana yazar. */
  zamaniKur: () => void
}

/** Tutuşma ve model bitiş anı (Unix ms). Rasterlardaki dakikalar tutuşmadan bu yanadır. */
export const tutusmaMs = (b: api.YanginBilgisi) => Date.parse(b.tutusma_utc)
export const bitisMs = (b: api.YanginBilgisi) => Date.parse(b.bitis_utc)

export const useDogrulama = create<DogrulamaDurumu>((set, get) => ({
  ad: 'manavgat_2021',
  yukleme: 'bos',
  hata: null,
  bilgi: null,
  sonuc: null,
  rasterlar: null,
  simulasyon: 'bos',
  simulasyonHatasi: null,
  katmanlar: { model: true, gercek: true, firms: true, altlik: true, osm: false },
  renkKipi: 'yayilim',
  anlik: null,

  yukle: async () => {
    if (get().yukleme === 'yukleniyor' || get().yukleme === 'hazir') return
    const { ad } = get()
    set({ yukleme: 'yukleniyor', hata: null })
    try {
      const bilgi = await api.yanginBilgisi(ad)
      set({ bilgi })
      get().zamaniKur()
      const [firms, gercek, sonuc] = await Promise.all([
        api.rasterGetir(ad, 'firms_varis'),
        api.rasterGetir(ad, 'gercek'),
        api.sonucGetir(ad),
      ])
      const model = sonuc ? await api.rasterGetir(ad, 'model_toa') : null
      const { genislik, yukseklik } = bilgi.harita
      set({ sonuc, rasterlar: { genislik, yukseklik, firms, gercek, model }, yukleme: 'hazir' })
    } catch (e) {
      set({ yukleme: 'hata', hata: e instanceof Error ? e.message : String(e) })
    }
  },

  simulasyonCalistir: async () => {
    const { ad, rasterlar } = get()
    if (get().simulasyon === 'calisiyor' || !rasterlar) return
    set({ simulasyon: 'calisiyor', simulasyonHatasi: null })
    try {
      const sonuc = await api.simulasyonCalistir(ad)
      const model = await api.rasterGetir(ad, 'model_toa')
      set({ sonuc, rasterlar: { ...get().rasterlar!, model }, simulasyon: 'bos' })
    } catch (e) {
      set({ simulasyon: 'hata', simulasyonHatasi: e instanceof Error ? e.message : String(e) })
    }
  },

  katmanAcKapa: (k) => set((d) => ({ katmanlar: { ...d.katmanlar, [k]: !d.katmanlar[k] } })),
  renkKipiAyarla: (renkKipi) => set({ renkKipi }),
  anlikAyarla: (anlik) => set({ anlik }),

  zamaniKur: () => {
    const { bilgi } = get()
    if (!bilgi) return
    const bas = tutusmaMs(bilgi)
    useZaman.getState().aralikAyarla(bas, bitisMs(bilgi), bas + ACILIS_SAAT * SAAT)
  },
}))
