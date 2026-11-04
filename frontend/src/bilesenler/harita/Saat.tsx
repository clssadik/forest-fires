import { useTranslation } from 'react-i18next'
import { gunAy, saat } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'

const DAKIKA = 60_000
const SAAT = 3_600_000
/** Derece, 4 ondalık (~10 m; kaba hücre 150 m). */
const derece = (d: number) => d.toFixed(4).replace('.', ',')

/**
 * Haritanın sağ üstündeki saat, kutusuz: üstte gün ve tutuşmadan bu yana geçen süre, ortada büyük ince
 * saat, altta fare altındaki noktanın enlem ve boylamı (yalnızca yangın alanının içinde). Koordinat satırı
 * saatin genişliğine yayılır: blok saat kadar geniş, enlem sola boylam sağa yaslı.
 */
export function Saat({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const imlec = useOlay((d) => d.imlec)
  const an = Math.floor(zaman / DAKIKA) * DAKIKA
  const saatSonra = Math.max(Math.round((an - veri.tutusmaMs) / SAAT), 0)
  const konum = imlec && veri.icinde(imlec.x, imlec.z) ? veri.konum(imlec.x, imlec.z) : null
  return (
    <div className="pointer-events-none absolute top-3 right-[calc(var(--sag-ortu,0px)+1.25rem)] z-30 transition-[right] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] w-fit text-right whitespace-nowrap text-white select-none [text-shadow:0_1px_4px_rgba(0,0,0,0.65)]">
      <div className="text-[14px] leading-5 text-white/80 tabular-nums">
        {gunAy(an)}, <span title={t('olayDuzeni.sureAciklama')}>{t('olayDuzeni.saatSayaci', { saat: saatSonra })}</span>
      </div>
      <div className="text-[56px] leading-[58px] font-extralight tracking-[0.01em] tabular-nums">{saat(an)}</div>
      {konum && (
        // w-0 + min-w-full: satır bloğu genişletmez, saatin genişliğini alır
        <div className="flex w-0 min-w-full justify-between text-[12px] leading-5 font-medium tabular-nums [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.6)]">
          <span>{t('harita.enlem', { deger: derece(konum.enlem) })}</span>
          <span>{t('harita.boylam', { deger: derece(konum.boylam) })}</span>
        </div>
      )}
    </div>
  )
}
