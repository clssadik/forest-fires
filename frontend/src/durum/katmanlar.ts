import { create } from 'zustand'

/**
 * Olay haritasının görünümü: birbirini dışlayan modlar ve onların üstüne binen birkaç anahtar.
 * Her mod tek bir soruyu yanıtlar; aynı pikselleri boyayan çizimler birlikte açılmaz.
 */
export type GorunumModu = 'yayilim' | 'varis' | 'guven' | 'hata' | 'zamanFarki' | 'siddet' | 'ortu'
export type HaritaAnahtari = 'izokron' | 'ruzgar' | 'duman'

export const MOD_GRUPLARI: { ad: string; modlar: GorunumModu[] }[] = [
  { ad: 'model', modlar: ['yayilim', 'varis', 'guven'] },
  { ad: 'dogruluk', modlar: ['hata', 'zamanFarki'] },
  { ad: 'gercek', modlar: ['siddet', 'ortu'] },
]
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
  varis: number
  guven: number
  hata: number
  zamanFarki: number
  siddet: number
  ortu: number
  ruzgar: number
  duman: number
  agaclar: boolean
}

/** Tematik modlar yayılımın çizimlerini kapattığı için onlara bağlı anahtarlar orada etkisizdir. */
export const anahtarEtkin = (mod: GorunumModu, anahtar: HaritaAnahtari) => mod === 'yayilim' || anahtar === 'ruzgar'

const TEMATIK_GUC = 0.9

export function katmanGucleri(mod: GorunumModu, anahtarlar: Record<HaritaAnahtari, boolean>): KatmanGucleri {
  const model = mod === 'yayilim'
  const acik = (a: HaritaAnahtari) => anahtarlar[a] && anahtarEtkin(mod, a)
  const tema = (m: GorunumModu) => (mod === m ? TEMATIK_GUC : 0)
  return {
    yayilim: model ? 1 : 0,
    olasilik: model ? 0.5 : 0,
    izokron: acik('izokron') ? 1 : 0,
    varis: tema('varis'),
    guven: tema('guven'),
    hata: tema('hata'),
    zamanFarki: tema('zamanFarki'),
    siddet: tema('siddet'),
    ortu: tema('ortu'),
    ruzgar: acik('ruzgar') ? 0.7 : 0,
    duman: acik('duman') ? 1 : 0,
    agaclar: model,
  }
}
