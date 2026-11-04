import { create } from 'zustand'

/**
 * Olay haritasının görünümü: birbirini dışlayan üç mod ve onların üstüne binen birkaç anahtar.
 * Aynı pikselleri boyayan katmanlar ayrı ayrı açılmaz; hangisinin görüneceğini mod belirler.
 */
export type GorunumModu = 'yayilim' | 'karsilastirma' | 'hata'
export type HaritaAnahtari = 'izokron' | 'ruzgar' | 'duman'

export const GORUNUM_MODLARI: GorunumModu[] = ['yayilim', 'karsilastirma', 'hata']
export const HARITA_ANAHTARLARI: HaritaAnahtari[] = ['izokron', 'ruzgar', 'duman']

const VARSAYILAN_ANAHTARLAR: Record<HaritaAnahtari, boolean> = { izokron: false, ruzgar: false, duman: true }

interface KatmanDurumu {
  mod: GorunumModu
  anahtarlar: Record<HaritaAnahtari, boolean>
  modSec: (mod: GorunumModu) => void
  degistir: (anahtar: HaritaAnahtari) => void
}

export const useKatmanlar = create<KatmanDurumu>((set) => ({
  mod: 'yayilim',
  anahtarlar: VARSAYILAN_ANAHTARLAR,
  modSec: (mod) => set({ mod }),
  degistir: (anahtar) => set((d) => ({ anahtarlar: { ...d.anahtarlar, [anahtar]: !d.anahtarlar[anahtar] } })),
}))

/** Sahnedeki her çizimin 0..1 gücü. */
export interface KatmanGucleri {
  yayilim: number
  olasilik: number
  izokron: number
  gercekSinir: number
  firms: number
  hata: number
  ruzgar: number
  duman: number
  agaclar: boolean
}

/** Hata modu modelin çizimlerini kapattığı için onlara bağlı anahtarlar orada etkisizdir. */
export const anahtarEtkin = (mod: GorunumModu, anahtar: HaritaAnahtari) => mod !== 'hata' || anahtar === 'ruzgar'

export function katmanGucleri(mod: GorunumModu, anahtarlar: Record<HaritaAnahtari, boolean>): KatmanGucleri {
  const model = mod !== 'hata'
  const kiyas = mod === 'karsilastirma'
  const acik = (a: HaritaAnahtari) => anahtarlar[a] && anahtarEtkin(mod, a)
  return {
    yayilim: model ? 1 : 0,
    olasilik: model ? 0.5 : 0,
    izokron: acik('izokron') ? 1 : 0,
    gercekSinir: kiyas ? 1 : 0,
    firms: kiyas ? 1 : 0,
    hata: model ? 0 : 0.85,
    ruzgar: acik('ruzgar') ? 0.7 : 0,
    duman: acik('duman') ? 1 : 0,
    agaclar: model,
  }
}
