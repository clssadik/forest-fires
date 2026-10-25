import { create } from 'zustand'

/** Sağ paneldeki katman listesi (bkz. docs/02 §5.2). */
export type KatmanKimligi =
  | 'arazi'
  | 'goruntu'
  | 'yanikIzi'
  | 'yayilim'
  | 'olasilik'
  | 'ruzgar'
  | 'mudahale'
  | 'yapilar'
  | 'yollar'
  | 'sinirlar'

export interface Katman {
  kimlik: KatmanKimligi
  acik: boolean
  /** 0..1; saydamlık kaydırıcısı olmayan katmanlarda null. */
  opaklik: number | null
}

export const VARSAYILAN_KATMANLAR: Katman[] = [
  { kimlik: 'arazi', acik: true, opaklik: 1 },
  { kimlik: 'goruntu', acik: true, opaklik: 1 },
  { kimlik: 'yanikIzi', acik: true, opaklik: 0.9 },
  { kimlik: 'yayilim', acik: true, opaklik: 1 },
  { kimlik: 'olasilik', acik: true, opaklik: 0.8 },
  { kimlik: 'ruzgar', acik: false, opaklik: 0.7 },
  { kimlik: 'mudahale', acik: true, opaklik: null },
  { kimlik: 'yapilar', acik: false, opaklik: null },
  { kimlik: 'yollar', acik: false, opaklik: null },
  { kimlik: 'sinirlar', acik: false, opaklik: null },
]

interface KatmanDurumu {
  katmanlar: Katman[]
  degistir: (kimlik: KatmanKimligi) => void
  opaklikAyarla: (kimlik: KatmanKimligi, opaklik: number) => void
}

export const useKatmanlar = create<KatmanDurumu>((set) => ({
  katmanlar: VARSAYILAN_KATMANLAR,
  degistir: (kimlik) =>
    set((d) => ({
      katmanlar: d.katmanlar.map((k) => (k.kimlik === kimlik ? { ...k, acik: !k.acik } : k)),
    })),
  opaklikAyarla: (kimlik, opaklik) =>
    set((d) => ({
      katmanlar: d.katmanlar.map((k) =>
        k.kimlik === kimlik && k.opaklik !== null ? { ...k, opaklik: Math.min(Math.max(opaklik, 0), 1) } : k,
      ),
    })),
}))

/** Katmanın etkin opaklığı: kapalıysa 0, kaydırıcısızsa 1. */
export const etkinOpaklik = (katmanlar: Katman[], kimlik: KatmanKimligi) => {
  const k = katmanlar.find((x) => x.kimlik === kimlik)
  if (!k || !k.acik) return 0
  return k.opaklik ?? 1
}
