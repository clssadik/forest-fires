import { create } from 'zustand'
import { ApiHatasi } from '../dogrulama/api'
import * as api from '../senaryo/api'
import type { BantSayilari, SenaryoRasterlari } from '../senaryo/boyama'
import { useZaman } from './zaman'

const SAAT = 3_600_000
/** Sonuç gelince imlecin durduğu an (tutuşmadan sonra). */
const ACILIS_SAAT = 12
/** Senaryo süresi (senaryo_modu.SURE_SA). */
const SURE_SAAT = 48

export type SenaryoHatasi = 'yanmaz' | 'veri' | 'mesgul' | 'diger'

interface SenaryoDurumu {
  /** Haritada seçilen tutuşma noktası. */
  nokta: { enlem: number; boylam: number } | null
  durum: 'bos' | 'calisiyor' | 'hazir' | 'hata'
  hata: { tur: SenaryoHatasi; mesaj: string } | null
  ozet: api.SenaryoOzeti | null
  rasterlar: SenaryoRasterlari | null
  altlik: boolean
  /** Haritanın t anındaki bant alanları (hücre). */
  anlik: BantSayilari | null
  /** Noktayı seçer ve modeli o noktada şimdi tutuşan bir yangın için çalıştırır. */
  calistir: (enlem: number, boylam: number) => Promise<void>
  altlikAcKapa: () => void
  anlikAyarla: (s: BantSayilari) => void
  /** Senaryonun zaman aralığını (tutuşma → +48 sa) global zamana yazar. */
  zamaniKur: () => void
}

export const tutusmaMs = (o: api.SenaryoOzeti) => Date.parse(o.tutusma_utc)
export const bitisMs = (o: api.SenaryoOzeti) => Date.parse(o.bitis_utc)

const hataTuru = (e: unknown): SenaryoHatasi => {
  if (!(e instanceof ApiHatasi)) return 'diger'
  if (e.durum === 422) return 'yanmaz'
  if (e.durum === 409) return 'mesgul'
  if (e.durum === 502) return 'veri'
  return 'diger'
}

export const useSenaryo = create<SenaryoDurumu>((set, get) => ({
  nokta: null,
  durum: 'bos',
  hata: null,
  ozet: null,
  rasterlar: null,
  altlik: false,
  anlik: null,

  calistir: async (enlem, boylam) => {
    if (get().durum === 'calisiyor') return
    set({ nokta: { enlem, boylam }, durum: 'calisiyor', hata: null })
    try {
      const ozet = await api.senaryoCalistir(enlem, boylam)
      const rasterlar = await api.rasterGetir(ozet)
      set({ ozet, rasterlar, durum: 'hazir' })
      get().zamaniKur()
    } catch (e) {
      // Önceki sonuç (varsa) haritada kalır; yalnızca yeni nokta başarısız oldu.
      set({ durum: 'hata', hata: { tur: hataTuru(e), mesaj: e instanceof Error ? e.message : String(e) } })
    }
  },

  altlikAcKapa: () => set((d) => ({ altlik: !d.altlik })),
  anlikAyarla: (anlik) => set({ anlik }),

  zamaniKur: () => {
    const { ozet } = get()
    // Sonuç yokken zaman çubuğu "bu saatten 48 saat sonrasına" boş bir aralık gösterir.
    const bas = ozet ? tutusmaMs(ozet) : Math.floor(Date.now() / SAAT) * SAAT
    const bitis = ozet ? bitisMs(ozet) : bas + SURE_SAAT * SAAT
    useZaman.getState().aralikAyarla(bas, bitis, ozet ? bas + ACILIS_SAAT * SAAT : bas)
  },
}))
