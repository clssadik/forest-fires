import { create } from 'zustand'

/**
 * Tek global zaman durumu. Harita katmanları, grafikler ve listeler bu
 * değerden türetilir (bkz. docs/02-firetrace-teknik-inceleme.md §12).
 * Zamanlar Unix milisaniyesidir.
 */
interface ZamanDurumu {
  baslangic: number
  bitis: number
  t: number
  oynatiliyor: boolean
  /** Gerçek saniye başına simülasyon dakikası. */
  hiz: number
  zamanaGit: (t: number) => void
  oynatDuraklat: () => void
  ilerlet: (gercekMs: number) => void
}

const sinirla = (t: number, alt: number, ust: number) => Math.min(Math.max(t, alt), ust)

export const useZaman = create<ZamanDurumu>((set) => ({
  baslangic: 0,
  bitis: 0,
  t: 0,
  oynatiliyor: false,
  hiz: 60,
  zamanaGit: (t) => set((d) => ({ t: sinirla(t, d.baslangic, d.bitis) })),
  oynatDuraklat: () => set((d) => ({ oynatiliyor: !d.oynatiliyor })),
  ilerlet: (gercekMs) =>
    set((d) => {
      if (!d.oynatiliyor) return d
      const t = sinirla(d.t + gercekMs * d.hiz * 60, d.baslangic, d.bitis)
      return { t, oynatiliyor: t < d.bitis }
    }),
}))
