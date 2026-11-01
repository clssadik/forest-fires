import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi, yuzdeBicim } from '../../bicim'
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

/** Saat farkı işaretiyle: +2,8 sa / −1,5 sa. */
const saatFarki = (s: number) => `${s >= 0 ? '+' : '−'}${sayi(Math.abs(s), 1)}`

/**
 * Bitişteki doğruluk: başlıkta Sørensen, altında beş ölçütün radarı (Sørensen, yakalama, isabet,
 * ±12 saat içinde varış, eşit alanda şekil). Fare bir eksenin diliminin üstüne gelince eksen
 * vurgulanır ve kart ölçütü bu yangının sayılarıyla açıklar; kart, eksenin karşı yarısında açılır.
 */
function Dogruluk({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const [secili, setSecili] = useState<number | null>(null)
  const m = veri.bilgi.model
  if (m.bitis_dice === null || !m.bitis) return null
  const gercekHa = m.esit_alan.dogru_ha + m.esit_alan.kacirilan_ha
  const eksenler = [
    {
      ad: 'sorensen',
      oran: m.bitis_dice,
      aciklama:
        m.daire_dice !== null
          ? t('olayDuzeni.radar.sorensenDaire', { daire: yuzdeBicim(m.daire_dice) })
          : t('olayDuzeni.radar.sorensenAciklama'),
    },
    { ad: 'yakalama', oran: m.bitis.duyarlilik, aciklama: t('olayDuzeni.radar.yakalamaAciklama', { ha: sayi(gercekHa) }) },
    { ad: 'isabet', oran: m.bitis.isabet, aciklama: t('olayDuzeni.radar.isabetAciklama', { ha: sayi(m.bitis.model_ha) }) },
    ...(m.zaman
      ? [{ ad: 'zaman', oran: m.zaman.oran_12_saat_icinde, aciklama: t('olayDuzeni.radar.zamanAciklama', { fark: saatFarki(m.zaman.ortanca_saat) }) }]
      : []),
    { ad: 'sekil', oran: m.esit_alan_iou, aciklama: t('olayDuzeni.radar.sekilAciklama') },
  ]
  const n = eksenler.length
  const kart = secili !== null ? eksenler[secili] : null
  // Üst yarıdaki eksenin kartı alta, alttakinin kartı üste: vurgulanan eksen kapanmasın.
  const kartAltta = secili !== null && uc(secili, n, 1).y <= MERKEZ.y + 1
  return (
    <section className="relative shrink-0 border-t border-cizgi px-5 py-4">
      <div className="flex items-baseline justify-between">
        <h2 title={t('olayDuzeni.dogrulukAciklama')} className="cursor-help text-[13.5px] leading-[18px] font-semibold">
          {t('olayDuzeni.dogruluk')}
        </h2>
        <span className="text-[18px] leading-6 font-semibold tabular-nums">{yuzdeBicim(m.bitis_dice)}</span>
      </div>
      <svg
        viewBox={`0 0 ${GEN} ${YUK}`}
        className="mt-1 w-full"
        role="img"
        aria-label={t('olayDuzeni.dogruluk')}
        onMouseLeave={() => setSecili(null)}
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
        {kart && secili !== null && (
          <g className="pointer-events-none">
            <line x1={MERKEZ.x} y1={MERKEZ.y} x2={uc(secili, n, 1).x} y2={uc(secili, n, 1).y} className="stroke-metin/60" />
            <circle cx={uc(secili, n, kart.oran).x} cy={uc(secili, n, kart.oran).y} r={4} className="fill-ates stroke-zemin" strokeWidth={1.5} />
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
        {/* Her eksenin dilimi (komşu eksenlerin ortasına kadar): fare buraya gelince kart açılır */}
        {eksenler.map((e, i) => {
          const a = uc(i - 0.5, n, 1.5)
          const b = uc(i + 0.5, n, 1.5)
          const c = uc(i, n, 1.5)
          return (
            <polygon
              key={e.ad}
              points={`${MERKEZ.x},${MERKEZ.y} ${a.x},${a.y} ${c.x},${c.y} ${b.x},${b.y}`}
              className="cursor-help fill-transparent"
              onMouseEnter={() => setSecili(i)}
            />
          )
        })}
      </svg>
      {kart && (
        <div
          className={`pointer-events-none absolute inset-x-5 z-10 rounded-[8px] bg-black/90 px-3 py-2.5 text-white ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.35)] ${kartAltta ? 'bottom-3' : 'top-12'}`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] leading-[18px] font-semibold">{t(`olayDuzeni.radar.${kart.ad}`)}</span>
            <span className="text-[15px] leading-5 font-semibold tabular-nums">{yuzdeBicim(kart.oran)}</span>
          </div>
          <p className="mt-1 text-[12px] leading-[17px] text-white/75">{kart.aciklama}</p>
        </div>
      )}
    </section>
  )
}
