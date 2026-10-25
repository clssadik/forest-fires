import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoyut } from '../../kancalar/useBoyut'
import { IkonUcNokta } from '../ikonlar'
import type { GrafikTemasi } from './grafikTemalari'

/**
 * Hafif SVG çizgi/alan grafiği. İmleçten sonraki kısım soluk ve kesikli
 * çizilir (docs/02 §5.5). Eksenler sayısaldır; zaman grafikleri için x
 * Unix milisaniyesi, profil için km kullanılır.
 */

interface Ozellikler {
  baslik: ReactNode
  veri: { x: number; y: number }[]
  xAlan: [number, number]
  yAlan: [number, number]
  xTikler: { x: number; etiket: string }[]
  yTikler: { y: number; etiket: string }[]
  imlec: number
  tema: GrafikTemasi
  /** İmlecin grafikle kesiştiği yerde kırmızı nokta (profil). */
  kirmiziNokta?: boolean
}

const SOL = 46
const SAG = 12
const UST = 6
const ALT = 18

export function CizgiGrafigi({ baslik, veri, xAlan, yAlan, xTikler, yTikler, imlec, tema, kirmiziNokta }: Ozellikler) {
  const { t } = useTranslation()
  const [ref, { gen, yuk }] = useBoyut<HTMLDivElement>()
  const kimlik = useId().replace(/:/g, '')

  const ic = { gen: Math.max(gen - SOL - SAG, 1), yuk: Math.max(yuk - UST - ALT, 1) }
  const px = (x: number) => SOL + ((x - xAlan[0]) / (xAlan[1] - xAlan[0])) * ic.gen
  const py = (y: number) => UST + (1 - (y - yAlan[0]) / (yAlan[1] - yAlan[0])) * ic.yuk

  const cizgi = veri.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join('')
  const alan = veri.length ? `${cizgi}L${px(veri.at(-1)!.x)},${py(yAlan[0])}L${px(veri[0].x)},${py(yAlan[0])}Z` : ''
  const ix = Math.min(Math.max(px(imlec), SOL), SOL + ic.gen)
  const iy = py(degerAl(veri, imlec))

  return (
    <div className="flex min-w-0 flex-1 flex-col border-r border-cizgi px-3 pt-1.5 pb-1 last:border-r-0">
      <div className="flex h-[20px] items-center">
        <h3 className="text-[12.5px] font-medium">{baslik}</h3>
        <button type="button" className="ml-auto grid size-5 place-items-center rounded text-soluk hover:bg-black/5" title={t('grafikler.secenekler')}>
          <IkonUcNokta boyut={13} />
        </button>
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        {gen > 0 && (
          <svg width={gen} height={yuk} className="absolute inset-0 overflow-visible text-[10.5px]">
            <defs>
              <clipPath id={`gecmis-${kimlik}`}>
                <rect x={0} y={0} width={ix} height={yuk} />
              </clipPath>
              <clipPath id={`gelecek-${kimlik}`}>
                <rect x={ix} y={0} width={gen} height={yuk} />
              </clipPath>
            </defs>
            {/* Eksenler */}
            <line x1={SOL} x2={SOL} y1={UST} y2={UST + ic.yuk} stroke="#8a8375" />
            <line x1={SOL} x2={SOL + ic.gen} y1={UST + ic.yuk} y2={UST + ic.yuk} stroke="#8a8375" />
            {yTikler.map(({ y, etiket }) => (
              <text key={y} x={SOL - 6} y={py(y)} textAnchor="end" dominantBaseline="middle" fill="#2f2c27">
                {etiket}
              </text>
            ))}
            {xTikler.map(({ x, etiket }) => (
              <text key={x} x={px(x)} y={yuk - 3} textAnchor="middle" fill="#2f2c27">
                {etiket}
              </text>
            ))}
            {/* Gelecek: soluk + kesikli */}
            <g clipPath={`url(#gelecek-${kimlik})`}>
              <path d={alan} fill={tema.gelecekDolgu} opacity={0.75} />
              <path d={cizgi} fill="none" stroke={tema.gelecekCizgi} strokeWidth={1.3} strokeDasharray="3 3" />
            </g>
            {/* Geçmiş */}
            <g clipPath={`url(#gecmis-${kimlik})`}>
              <path d={alan} fill={tema.dolgu} opacity={0.9} />
              <path d={cizgi} fill="none" stroke={tema.cizgi} strokeWidth={1.6} />
            </g>
            {/* İmleç */}
            <line x1={ix} x2={ix} y1={UST} y2={UST + ic.yuk} stroke="#3d3a33" strokeWidth={1.5} />
            {[UST, UST + ic.yuk].map((y) => (
              <circle key={y} cx={ix} cy={y} r={3.2} fill="#f3f0e8" stroke="#3d3a33" strokeWidth={1.3} />
            ))}
            {kirmiziNokta ? (
              <circle cx={ix} cy={iy} r={4.5} fill="#d4472a" stroke="#f3f0e8" strokeWidth={1.2} />
            ) : (
              <circle cx={ix} cy={iy} r={3.2} fill="#f3f0e8" stroke="#3d3a33" strokeWidth={1.3} />
            )}
          </svg>
        )}
      </div>
    </div>
  )
}

/** Doğrusal ara değer. */
function degerAl(veri: { x: number; y: number }[], x: number) {
  if (!veri.length) return 0
  if (x <= veri[0].x) return veri[0].y
  for (let i = 1; i < veri.length; i++) {
    if (x <= veri[i].x) {
      const a = veri[i - 1]
      const b = veri[i]
      return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
    }
  }
  return veri.at(-1)!.y
}
