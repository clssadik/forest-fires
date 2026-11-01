import { useTranslation } from 'react-i18next'
import { yuzdeBicim } from '../../bicim'
import { useOlay } from '../../durum/olay'

/** Değerin kabaca yorumu: 0,7 ve üstü iyi, 0,4–0,7 orta, altı zayıf. */
const yorum = (oran: number) => (oran >= 0.7 ? 'iyi' : oran >= 0.4 ? 'orta' : 'zayif')

/**
 * Özet radarında farenin üstünde durduğu ölçüt, haritanın sağında saatin altında bir kartta: ad, değer
 * ve kabaca yorumu (iyi / orta / zayıf) ve ölçütün ne anlattığı.
 */
export function RadarBilgisi() {
  const { t } = useTranslation()
  const eksen = useOlay((d) => d.radarEkseni)
  if (!eksen) return null
  return (
    <div className="pointer-events-none absolute top-[104px] right-4 z-30 w-[260px] rounded-[10px] bg-black px-4 py-3.5 text-white ring-1 ring-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.4)] select-none">
      <div className="text-[11px] leading-none tracking-[0.14em] text-white/70 uppercase">{t(`olayDuzeni.radar.${eksen.ad}`)}</div>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span className="text-[34px] leading-none font-extralight text-ates-acik tabular-nums">{yuzdeBicim(eksen.oran)}</span>
        <span className="text-[11px] leading-none tracking-[0.14em] text-white uppercase">{t(`olayDuzeni.radar.yorum.${yorum(eksen.oran)}`)}</span>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-[19px]">{t(`olayDuzeni.radar.${eksen.ad}Kisa`)}</p>
    </div>
  )
}
