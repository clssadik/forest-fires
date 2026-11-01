import { useTranslation } from 'react-i18next'
import { gunAySaat } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'
import { IkonDuraklat, IkonOynat } from '../ikonlar'

const DAKIKA = 60_000
const SAAT = 3_600_000

/** Haritanın sağ üstündeki saat: oynat/duraklat, seçili an ve tutuşmadan bu yana geçen süre. */
export function Saat({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const oynatiliyor = useZaman((d) => d.oynatiliyor)
  const oynatDuraklat = useZaman((d) => d.oynatDuraklat)
  const an = Math.floor(zaman / DAKIKA) * DAKIKA
  const saatSonra = Math.max(Math.round((an - veri.tutusmaMs) / SAAT), 0)
  const etiket = t(oynatiliyor ? 'zaman.duraklat' : 'zaman.oynat')
  return (
    <div className="absolute top-3 right-4 z-30 flex items-center gap-2.5 rounded-[10px] bg-black/85 py-1.5 pr-3.5 pl-1.5 whitespace-nowrap text-white ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm select-none">
      <button
        type="button"
        onClick={oynatDuraklat}
        title={etiket}
        aria-label={etiket}
        className="grid size-[28px] shrink-0 place-items-center rounded-[7px] bg-guclu text-zemin hover:bg-white"
      >
        {oynatiliyor ? <IkonDuraklat boyut={13} /> : <IkonOynat boyut={13} />}
      </button>
      <span className="text-[17px] leading-[20px] font-semibold tabular-nums">{gunAySaat(an)}</span>
      <span title={t('olayDuzeni.sureAciklama')} className="text-[12.5px] text-soluk tabular-nums">
        {t('olayDuzeni.saatSayaci', { saat: saatSonra })}
      </span>
    </div>
  )
}
