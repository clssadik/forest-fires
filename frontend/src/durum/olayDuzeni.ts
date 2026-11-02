import { create } from 'zustand'

/**
 * Olay ekranının yerleşimi: sağdaki çekmecede hangi sekmenin açık olduğu (yoksa null). Bu
 * tarayıcıda (localStorage) hatırlanır; depolama kapalıysa varsayılanla açılır. Alttaki zaman
 * şeritleri her zaman açıktır, seçenek değildir.
 */
export const CEKMECELER = ['ozet', 'katmanlar', 'analiz'] as const
export type Cekmece = (typeof CEKMECELER)[number]

const ANAHTAR = 'orman.olayDuzeni'
export const VARSAYILAN_CEKMECE: Cekmece | null = 'ozet'

export function cekmeceOku(depo: Storage | undefined = globalThis.localStorage): Cekmece | null {
  try {
    const ham = JSON.parse(depo?.getItem(ANAHTAR) ?? 'null') as { cekmece?: unknown } | null
    if (!ham || typeof ham !== 'object' || !('cekmece' in ham)) return VARSAYILAN_CEKMECE
    // Kanıtlar ve Notlar sekmeleri Analiz'e katıldı; eski kayıt Analiz'i açar.
    if (ham.cekmece === 'kanitlar' || ham.cekmece === 'notlar') return 'analiz'
    if (ham.cekmece === null || CEKMECELER.includes(ham.cekmece as Cekmece)) return ham.cekmece as Cekmece | null
    return VARSAYILAN_CEKMECE
  } catch {
    return VARSAYILAN_CEKMECE
  }
}

function cekmeceYaz(cekmece: Cekmece | null, depo: Storage | undefined = globalThis.localStorage) {
  try {
    depo?.setItem(ANAHTAR, JSON.stringify({ cekmece }))
  } catch {
    // Depolama kapalı: yerleşim yalnızca bu oturumda geçerli.
  }
}

interface OlayDuzeniDurumu {
  cekmece: Cekmece | null
  /** Aynı sekmeye yeniden basılırsa çekmece kapanır. */
  cekmeceDegistir: (cekmece: Cekmece) => void
  cekmeceKapat: () => void
}

export const useOlayDuzeni = create<OlayDuzeniDurumu>((set, get) => ({
  cekmece: cekmeceOku(),
  cekmeceDegistir: (cekmece) => {
    set((d) => ({ cekmece: d.cekmece === cekmece ? null : cekmece }))
    cekmeceYaz(get().cekmece)
  },
  cekmeceKapat: () => {
    set({ cekmece: null })
    cekmeceYaz(null)
  },
}))
