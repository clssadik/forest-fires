import { useTranslation } from 'react-i18next'
import { gunAy, saat } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'

const DAKIKA = 60_000
const SAAT = 3_600_000

/** Haritanın sağ üstündeki saat, kutusuz: büyük ince saat, altında gün ve tutuşmadan bu yana geçen süre. */
export function Saat({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const an = Math.floor(zaman / DAKIKA) * DAKIKA
  const saatSonra = Math.max(Math.round((an - veri.tutusmaMs) / SAAT), 0)
  return (
    <div className="pointer-events-none absolute top-3 right-5 z-30 text-right whitespace-nowrap text-white select-none [text-shadow:0_1px_4px_rgba(0,0,0,0.65)]">
      <div className="text-[26px] leading-[30px] font-light tracking-[0.02em] tabular-nums">{saat(an)}</div>
      <div className="text-[11.5px] leading-4 text-white/80 tabular-nums">
        {gunAy(an)} · <span title={t('olayDuzeni.sureAciklama')}>{t('olayDuzeni.saatSayaci', { saat: saatSonra })}</span>
      </div>
    </div>
  )
}
