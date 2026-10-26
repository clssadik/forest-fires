import { create } from 'zustand'

/** Hangi ekran açık: olay (3B, şimdilik örnek veri) ya da doğrulama (2B, gerçek veri). */
export type Ekran = 'olay' | 'dogrulama'

const adrestenOku = (): Ekran => (typeof location !== 'undefined' && location.hash === '#dogrulama' ? 'dogrulama' : 'olay')

interface EkranDurumu {
  ekran: Ekran
  ekranAyarla: (ekran: Ekran) => void
}

export const useEkran = create<EkranDurumu>((set) => ({
  ekran: adrestenOku(),
  ekranAyarla: (ekran) => {
    // Adres çubuğunda tutulur: sayfa yenilenince aynı ekran açılır.
    history.replaceState(null, '', ekran === 'olay' ? location.pathname : '#dogrulama')
    set({ ekran })
  },
}))
