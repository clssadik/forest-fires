import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { yuzdeBicim } from '../../bicim'
import { useOlay } from '../../durum/olay'
import type { OlayVerisi } from '../../olay/veri'
import { OnemliOlaylar } from '../altSerit/OnemliOlaylar'

/**
 * Sağ çekmecenin Özet sekmesi: bitişteki doğruluk ve önemli olaylar. Yalnızca sayılar ve kısa adlar;
 * açıklamalar ipucunda. Seçili an ve o ana kadarki alanlar alttaki zaman panelinde olduğu için burada
 * tekrarlanmaz. Tek boşluk ölçeği: bölümler 20 px yan, 16 px dikey boşlukla.
 */
export function OzetSekmesi({ veri }: { veri: OlayVerisi }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col [&>*:first-child]:border-t-0">
      <Dogruluk veri={veri} />
      <OnemliOlaylar veri={veri} />
    </div>
  )
}

/** Radar çiziminin ölçüleri (viewBox birimi). */
const GEN = 304
const YUK = 212
const MERKEZ = { x: GEN / 2, y: 112 }
const YARICAP = 76
const HALKALAR = [1 / 3, 2 / 3, 1]

/** Eksenin ucundaki nokta: 0. eksen tepede, saat yönünde eşit aralıklı. */
function uc(i: number, n: number, oran: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
  return { x: MERKEZ.x + Math.cos(a) * YARICAP * oran, y: MERKEZ.y + Math.sin(a) * YARICAP * oran }
}

const cokgen = (oranlar: number[]) =>
  oranlar.map((o, i) => uc(i, oranlar.length, o)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/**
 * Bitişteki doğruluk: başlıkta Sørensen, altında beş ölçütün radarı (Sørensen, yakalama,
 * isabet, ±12 saat içinde varış, eşit alanda şekil). Fare bir eksenin diliminin üstüne gelince eksen
 * vurgulanır; ölçütün adı, değeri ve kısa açıklaması haritanın sağında, saatin altında görünür (açılır pencere yok).
 */
function Dogruluk({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const [secili, setSecili] = useState<number | null>(null)
  const radarEkseniAyarla = useOlay((d) => d.radarEkseniAyarla)
  // Sekme kapanınca haritadaki açıklama asılı kalmasın.
  useEffect(() => () => radarEkseniAyarla(null), [radarEkseniAyarla])
  const m = veri.bilgi.model
  if (m.bitis_dice === null || !m.bitis) return null
  const eksenler = [
    { ad: 'sorensen', oran: m.bitis_dice },
    { ad: 'yakalama', oran: m.bitis.duyarlilik },
    { ad: 'isabet', oran: m.bitis.isabet },
    ...(m.zaman ? [{ ad: 'zaman', oran: m.zaman.oran_12_saat_icinde }] : []),
    { ad: 'sekil', oran: m.esit_alan_iou },
  ]
  const sec = (i: number | null) => {
    setSecili(i)
    radarEkseniAyarla(i === null ? null : eksenler[i])
  }
  const n = eksenler.length
  const vurgu = secili !== null ? eksenler[secili] : null
  return (
    <section className="shrink-0 border-t border-cizgi px-5 py-4">
      <div className="flex items-baseline justify-between">
        <h2 title={t('olayDuzeni.dogrulukAciklama')} className="text-[13.5px] leading-[18px] font-semibold">
          {t('olayDuzeni.dogruluk')}
        </h2>
        <span className="text-[18px] leading-6 font-semibold tabular-nums">{yuzdeBicim(m.bitis_dice)}</span>
      </div>
      <svg
        viewBox={`0 0 ${GEN} ${YUK}`}
        className="mt-1 w-full"
        role="img"
        aria-label={t('olayDuzeni.dogruluk')}
        onMouseLeave={() => sec(null)}
      >
        <g className="fill-none stroke-yuzey-acik">
          {HALKALAR.map((h) => (
            <polygon key={h} points={cokgen(eksenler.map(() => h))} />
          ))}
          {eksenler.map((_, i) => {
            const p = uc(i, n, 1)
            return <line key={i} x1={MERKEZ.x} y1={MERKEZ.y} x2={p.x} y2={p.y} />
          })}
        </g>
        <polygon
          points={cokgen(eksenler.map((e) => Math.min(Math.max(e.oran, 0), 1)))}
          className="fill-ates/25 stroke-ates"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {vurgu && secili !== null && (
          <g className="pointer-events-none">
            <line x1={MERKEZ.x} y1={MERKEZ.y} x2={uc(secili, n, 1).x} y2={uc(secili, n, 1).y} className="stroke-metin/60" />
            <circle cx={uc(secili, n, vurgu.oran).x} cy={uc(secili, n, vurgu.oran).y} r={4} className="fill-ates stroke-zemin" strokeWidth={1.5} />
          </g>
        )}
        {eksenler.map((e, i) => {
          const p = uc(i, n, 1.24)
          const yatay = Math.abs(p.x - MERKEZ.x) < 1 ? 'middle' : p.x > MERKEZ.x ? 'start' : 'end'
          return (
            <text
              key={e.ad}
              x={p.x}
              y={p.y + 4}
              textAnchor={yatay}
              className={`pointer-events-none text-[11px] transition-colors ${secili === i ? 'fill-metin' : secili === null ? 'fill-soluk' : 'fill-silik'}`}
            >
              {t(`olayDuzeni.radar.${e.ad}`)}
            </text>
          )
        })}
        {/* Her eksenin dilimi (komşu eksenlerin ortasına kadar): fare buraya gelince eksen seçilir */}
        {eksenler.map((e, i) => {
          const a = uc(i - 0.5, n, 1.5)
          const b = uc(i + 0.5, n, 1.5)
          const c = uc(i, n, 1.5)
          return (
            <polygon
              key={e.ad}
              points={`${MERKEZ.x},${MERKEZ.y} ${a.x},${a.y} ${c.x},${c.y} ${b.x},${b.y}`}
              className="fill-transparent"
              onMouseEnter={() => sec(i)}
            />
          )
        })}
      </svg>
    </section>
  )
}
