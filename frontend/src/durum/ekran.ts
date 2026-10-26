import { create } from 'zustand'

/**
 * Hangi ekran açık: olay (3B, şimdilik örnek veri), doğrulama (2B, geçmiş yangınlar, gerçek
 * veri) ya da senaryo (2B, haritadan seçilen yerde şimdi çıkan bir yangın).
 */
export type Ekran = 'olay' | 'dogrulama' | 'senaryo'

const adrestenOku = (): Ekran => {
  if (typeof location === 'undefined') return 'olay'
  if (location.hash === '#dogrulama') return 'dogrulama'
  if (location.hash === '#senaryo') return 'senaryo'
  return 'olay'
}

interface EkranDurumu {
  ekran: Ekran
  ekranAyarla: (ekran: Ekran) => void
}

export const useEkran = create<EkranDurumu>((set) => ({
  ekran: adrestenOku(),
  ekranAyarla: (ekran) => {
    // Adres çubuğunda tutulur: sayfa yenilenince aynı ekran açılır.
    history.replaceState(null, '', ekran === 'olay' ? location.pathname : `#${ekran}`)
    set({ ekran })
  },
}))
