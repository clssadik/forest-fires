import { useTranslation } from 'react-i18next'
import { saat, sayi } from '../../bicim'
import { tutusmaMs, useSenaryo } from '../../durum/senaryo'
import { useZaman } from '../../durum/zaman'
import { useBoyut } from '../../kancalar/useBoyut'
import { BANTLAR, BANT_RENKLERI } from '../../senaryo/boyama'

const SAAT = 3_600_000
const SOL = 50
const SAG = 14
const UST = 8
const ALT = 20

/** Yanan alan–zaman: üç olasılık bandı iç içe alanlar olarak. */
export function SenaryoGrafigi() {
  const { t } = useTranslation()
  const [ref, { gen, yuk }] = useBoyut<HTMLDivElement>()
  const ozet = useSenaryo((d) => d.ozet)
  const { baslangic, bitis } = useZaman()
  const imlec = useZaman((d) => d.t)

  const bas = ozet ? tutusmaMs(ozet) : baslangic
  const enBuyuk = Math.max(...(ozet?.buyume_ha[0] ?? [0]), 1)
  const yAdim = [10, 50, 100, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000].find((a) => enBuyuk / a <= 5) ?? 100_000
  const yUst = Math.ceil(enBuyuk / yAdim) * yAdim
  const ic = { gen: Math.max(gen - SOL - SAG, 1), yuk: Math.max(yuk - UST - ALT, 1) }
  const px = (x: number) => SOL + ((x - baslangic) / Math.max(bitis - baslangic, 1)) * ic.gen
  const py = (y: number) => UST + (1 - y / yUst) * ic.yuk
  const alan = (ha: number[]) => {
    const n = ozet!.saatler
    const ust = n.map((s, i) => `${i ? 'L' : 'M'}${px(bas + s * SAAT).toFixed(1)},${py(ha[i]).toFixed(1)}`).join('')
    return `${ust}L${px(bas + n.at(-1)! * SAAT).toFixed(1)},${py(0)}L${px(bas).toFixed(1)},${py(0)}Z`
  }
  const saatTikleri = ozet ? ozet.saatler.filter((s) => s % 6 === 0) : []
  const yTikler = Array.from({ length: yUst / yAdim + 1 }, (_, i) => i * yAdim)

  return (
    <div className="flex min-w-0 flex-1 flex-col px-3 pt-1.5 pb-1">
      <div className="flex h-[20px] items-center gap-4 text-[12px]">
        <h3 className="text-[12.5px] font-medium">
          {t('senaryo.grafik.baslik')} <span className="text-soluk">({t('dogrulama.birim.ha')})</span>
        </h3>
        {[...BANTLAR].reverse().map((b) => (
          <span key={b} className="flex items-center gap-1.5 text-soluk">
            <span className="size-[10px] rounded-[2px]" style={{ background: BANT_RENKLERI[b] }} />
            {t(`senaryo.bantlar.${b}Kisa`)}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        {gen > 0 && ozet && (
          <svg width={gen} height={yuk} className="absolute inset-0 text-[10.5px]">
            {yTikler.map((y) => (
              <g key={y}>
                <line x1={SOL} x2={SOL + ic.gen} y1={py(y)} y2={py(y)} stroke="#c6bfac" strokeWidth={y ? 0.6 : 1} />
                <text x={SOL - 6} y={py(y)} textAnchor="end" dominantBaseline="middle" fill="#4d483f">
                  {sayi(y)}
                </text>
              </g>
            ))}
            {saatTikleri.map((s) => (
              <text key={s} x={px(bas + s * SAAT)} y={yuk - 4} textAnchor="middle" fill="#4d483f">
                {s % 24 === 0 ? saat(bas + s * SAAT) : `+${s}`}
              </text>
            ))}
            {BANTLAR.map((b, k) => (
              <path key={b} d={alan(ozet.buyume_ha[k])} fill={BANT_RENKLERI[b]} fillOpacity={0.85} />
            ))}
            <line x1={px(imlec)} x2={px(imlec)} y1={UST} y2={UST + ic.yuk} stroke="#3d3a33" strokeWidth={1.3} />
          </svg>
        )}
        {!ozet && <p className="absolute inset-0 grid place-items-center text-[12.5px] text-soluk">{t('senaryo.grafik.bos')}</p>}
      </div>
    </div>
  )
}
