import { useTranslation } from 'react-i18next'
import { useKatmanlar } from '../../durum/katmanlar'

const RENKLER = [
  { ad: 'ortak', renk: '#d4472a' },
  { ad: 'model', renk: '#f0b43c' },
  { ad: 'gozlem', renk: '#455c80' },
]

/** Karşılaştırma ve Hata modlarının renk anahtarı; çekmece kapalıyken de haritada durur. */
export function ModLejanti() {
  const { t } = useTranslation()
  const mod = useKatmanlar((d) => d.mod)
  if (mod === 'yayilim') return null
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-[8px] bg-black/70 px-3 py-2 text-[12.5px] leading-[18px] text-white ring-1 ring-white/10">
      <div className="mb-1 font-semibold">{t(`katmanlar.lejant.${mod}.baslik`)}</div>
      <ul>
        {RENKLER.map((r) => (
          <li key={r.ad} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rounded-[3px] ring-1 ring-white/20" style={{ background: r.renk }} />
            {t(`katmanlar.lejant.${mod}.${r.ad}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
