import { useTranslation } from 'react-i18next'
import { useOlay } from '../../durum/olay'
import type { OlayVerisi } from '../../olay/veri'

/** Derece, 4 ondalık (~10 m; kaba hücre 150 m). */
const derece = (d: number) => d.toFixed(4).replace('.', ',')

/** Haritanın sağ üstünde, saatin altında, kutusuz: fare altındaki noktanın enlem ve boylamı (yalnızca yangın alanının içinde). */
export function Koordinat({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const imlec = useOlay((d) => d.imlec)
  if (!imlec || !veri.icinde(imlec.x, imlec.z)) return null
  const { enlem, boylam } = veri.konum(imlec.x, imlec.z)
  return (
    <div className="pointer-events-none absolute top-[96px] right-5 z-30 text-[16px] leading-5 font-medium whitespace-nowrap text-white tabular-nums select-none [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_0_10px_rgba(0,0,0,0.6)]">
      {t('harita.koordinat', { enlem: derece(enlem), boylam: derece(boylam) })}
    </div>
  )
}
