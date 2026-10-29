import { create } from 'zustand'

/**
 * Olay ekranının yerleşimi: soldaki çekmecede hangi sekmenin açık olduğu (yoksa null) ve alttaki
 * zaman panelinin şeritlerinin açık olup olmadığı. Bu tarayıcıda (localStorage) hatırlanır;
 * depolama kapalıysa varsayılanla açılır.
 */
export const CEKMECELER = ['katmanlar', 'analiz', 'kanitlar', 'notlar'] as const
export type Cekmece = (typeof CEKMECELER)[number]

interface Duzen {
  cekmece: Cekmece | null
  seritlerAcik: boolean
}

const ANAHTAR = 'orman.olayDuzeni'
export const VARSAYILAN_DUZEN: Duzen = { cekmece: 'katmanlar', seritlerAcik: false }

export function duzenOku(depo: Storage | undefined = globalThis.localStorage): Duzen {
  try {
    const ham = JSON.parse(depo?.getItem(ANAHTAR) ?? 'null') as Partial<Duzen> | null
    if (!ham || typeof ham !== 'object') return VARSAYILAN_DUZEN
    return {
      cekmece: ham.cekmece === null || CEKMECELER.includes(ham.cekmece as Cekmece) ? (ham.cekmece as Cekmece | null) : VARSAYILAN_DUZEN.cekmece,
      seritlerAcik: typeof ham.seritlerAcik === 'boolean' ? ham.seritlerAcik : VARSAYILAN_DUZEN.seritlerAcik,
    }
  } catch {
    return VARSAYILAN_DUZEN
  }
}

function duzenYaz(duzen: Duzen, depo: Storage | undefined = globalThis.localStorage) {
  try {
    depo?.setItem(ANAHTAR, JSON.stringify(duzen))
  } catch {
    // Depolama kapalı: yerleşim yalnızca bu oturumda geçerli.
  }
}

interface OlayDuzeniDurumu extends Duzen {
  /** Aynı sekmeye yeniden basılırsa çekmece kapanır. */
  cekmeceDegistir: (cekmece: Cekmece) => void
  cekmeceKapat: () => void
  seritleriDegistir: () => void
}

export const useOlayDuzeni = create<OlayDuzeniDurumu>((set, get) => {
  const kaydet = () => duzenYaz({ cekmece: get().cekmece, seritlerAcik: get().seritlerAcik })
  return {
    ...duzenOku(),
    cekmeceDegistir: (cekmece) => {
      set((d) => ({ cekmece: d.cekmece === cekmece ? null : cekmece }))
      kaydet()
    },
    cekmeceKapat: () => {
      set({ cekmece: null })
      kaydet()
    },
    seritleriDegistir: () => {
      set((d) => ({ seritlerAcik: !d.seritlerAcik }))
      kaydet()
    },
  }
})
