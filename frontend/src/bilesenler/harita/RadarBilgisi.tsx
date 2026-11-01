import { useTranslation } from 'react-i18next'
import { yuzdeBicim } from '../../bicim'
import { useOlay } from '../../durum/olay'

/**
 * Özet radarında farenin üstünde durduğu ölçüt, haritanın sağında saatin altında, kutusuz: aralıklı
 * büyük harfli ad, büyük ince değer ve tek satır sade açıklama.
 */
export function RadarBilgisi() {
  const { t } = useTranslation()
  const eksen = useOlay((d) => d.radarEkseni)
  if (!eksen) return null
  return (
    <div className="pointer-events-none absolute top-[104px] right-5 z-30 max-w-[260px] text-right text-white select-none [text-shadow:0_1px_4px_rgba(0,0,0,0.75)]">
      <div className="text-[11px] leading-none tracking-[0.14em] text-white/80 uppercase">{t(`olayDuzeni.radar.${eksen.ad}`)}</div>
      <div className="mt-1.5 text-[40px] leading-none font-extralight text-ates-acik tabular-nums">{yuzdeBicim(eksen.oran)}</div>
      <div className="mt-2 text-[14px] leading-5">{t(`olayDuzeni.radar.${eksen.ad}Kisa`)}</div>
    </div>
  )
}
