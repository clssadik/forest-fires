import { create } from 'zustand'
import * as api from '../olay/api'
import { OlayVerisi } from '../olay/veri'
import { useZaman } from './zaman'

const SAAT = 3_600_000
/** Ekran açılınca imlecin durduğu an (tutuşmadan sonra, saat). */
const ACILIS_SAAT = 24

interface OlayDurumu {
  /** Yüklenen ya da yüklenmekte olan yangın (doğrulama ekranındaki seçimle aynı). */
  ad: string | null
  yukleme: 'bos' | 'yukleniyor' | 'hazir' | 'hata'
  hata: string | null
  veri: OlayVerisi | null
  /** Fare altındaki sahne noktası (km); null = arazinin dışında. */
  imlec: { x: number; z: number } | null
  /** Yangını yükler; aynı yangın zaten yüklüyse yalnızca zaman aralığını kurar. */
  yukle: (ad: string) => Promise<void>
  zamaniKur: () => void
  imlecAyarla: (imlec: { x: number; z: number } | null) => void
}

export const useOlay = create<OlayDurumu>((set, get) => ({
  ad: null,
  yukleme: 'bos',
  hata: null,
  veri: null,
  imlec: null,

  yukle: async (ad) => {
    if (get().ad === ad && get().yukleme !== 'hata') {
      if (get().yukleme === 'hazir') get().zamaniKur()
      return
    }
    // Yükleme sürerken başka yangın seçilirse bu yüklemenin yanıtları atılır.
    const guncel = () => get().ad === ad
    set({ ad, yukleme: 'yukleniyor', hata: null, veri: null, imlec: null })
    try {
      // Bilgi uç noktası gerekirse simülasyonu çalıştırır; bantlar ondan sonra istenir.
      const bilgi = await api.olayBilgisi(ad)
      const rasterlar = await api.olayRasterlari(ad)
      if (!guncel()) return
      set({ veri: new OlayVerisi(bilgi, rasterlar), yukleme: 'hazir' })
      get().zamaniKur()
    } catch (e) {
      if (guncel()) set({ yukleme: 'hata', hata: e instanceof Error ? e.message : String(e) })
    }
  },

  zamaniKur: () => {
    const v = get().veri
    if (!v) return
    useZaman.getState().aralikAyarla(v.tutusmaMs - 2 * SAAT, v.bitisMs, v.tutusmaMs + ACILIS_SAAT * SAAT)
  },

  imlecAyarla: (imlec) => set({ imlec }),
}))
