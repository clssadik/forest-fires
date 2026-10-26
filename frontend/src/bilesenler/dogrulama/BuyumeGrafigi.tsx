import { useTranslation } from 'react-i18next'
import { gunAy, sayi } from '../../bicim'
import { tutusmaMs, useDogrulama } from '../../durum/dogrulama'
import { useZaman } from '../../durum/zaman'
import { useBoyut } from '../../kancalar/useBoyut'

const SAAT = 3_600_000
const SOL = 50
const SAG = 14
const UST = 8
const ALT = 20
const MODEL = '#c9543a'
const FIRMS = '#3d3a33'

/** Yanan alan–zaman: model (topluluk) ve FIRMS'in gördüğü gerçek alan; kesikli çizgi gerçek toplam. */
export function BuyumeGrafigi() {
  const { t } = useTranslation()
  const [ref, { gen, yuk }] = useBoyut<HTMLDivElement>()
  const bilgi = useDogrulama((d) => d.bilgi)
  const sonuc = useDogrulama((d) => d.sonuc)
  const { baslangic, bitis } = useZaman()
  const imlec = useZaman((d) => d.t)

  const bas = bilgi ? tutusmaMs(bilgi) : baslangic
  const saatler = sonuc?.buyume_saatleri ?? []
  const seri = (ha: number[]) => saatler.map((s, i) => ({ x: bas + s * SAAT, y: ha[i] }))
  const model = sonuc ? seri(sonuc.buyume_ha).filter((p) => p.x <= bitis) : []
  const firms = sonuc ? seri(sonuc.firms_buyume_ha).filter((p) => p.x <= bitis) : []
  const gercek = bilgi?.gercek_ha ?? 0
  const enBuyuk = Math.max(gercek, ...model.map((p) => p.y), 1)
  const yAdim = enBuyuk > 120_000 ? 50_000 : 20_000
  const yUst = Math.ceil(enBuyuk / yAdim) * yAdim

  const ic = { gen: Math.max(gen - SOL - SAG, 1), yuk: Math.max(yuk - UST - ALT, 1) }
  const px = (x: number) => SOL + ((x - baslangic) / Math.max(bitis - baslangic, 1)) * ic.gen
  const py = (y: number) => UST + (1 - y / yUst) * ic.yuk
  const yol = (s: { x: number; y: number }[]) => s.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join('')
  const gunler: number[] = []
  for (let x = Math.ceil((baslangic + 3 * SAAT) / (24 * SAAT)) * 24 * SAAT - 3 * SAAT; x <= bitis; x += 24 * SAAT) gunler.push(x)
  const yTikler = Array.from({ length: yUst / yAdim + 1 }, (_, i) => i * yAdim)
  const ix = px(imlec)

  return (
    <div className="flex min-w-0 flex-1 flex-col px-3 pt-1.5 pb-1">
      <div className="flex h-[20px] items-center gap-4 text-[12px]">
        <h3 className="text-[12.5px] font-medium">
          {t('dogrulama.grafik.baslik')} <span className="text-soluk">({t('dogrulama.birim.ha')})</span>
        </h3>
        <Anahtar renk={MODEL} ad={t('dogrulama.grafik.model')} />
        <Anahtar renk={FIRMS} ad={t('dogrulama.grafik.firms')} />
        <Anahtar renk="#8a8375" ad={t('dogrulama.grafik.gercek', { ha: sayi(gercek) })} kesikli />
      </div>
      <div ref={ref} className="relative min-h-0 flex-1">
        {gen > 0 && (
          <svg width={gen} height={yuk} className="absolute inset-0 text-[10.5px]">
            {yTikler.map((y) => (
              <g key={y}>
                <line x1={SOL} x2={SOL + ic.gen} y1={py(y)} y2={py(y)} stroke="#c6bfac" strokeWidth={y ? 0.6 : 1} />
                <text x={SOL - 6} y={py(y)} textAnchor="end" dominantBaseline="middle" fill="#4d483f">
                  {y ? t('dogrulama.grafik.bin', { deger: sayi(y / 1000) }) : '0'}
                </text>
              </g>
            ))}
            {gunler.map((x) => (
              <text key={x} x={px(x)} y={yuk - 4} textAnchor="middle" fill="#4d483f">
                {gunAy(x)}
              </text>
            ))}
            <line x1={SOL} x2={SOL + ic.gen} y1={py(gercek)} y2={py(gercek)} stroke="#8a8375" strokeDasharray="4 3" />
            <path d={yol(firms)} fill="none" stroke={FIRMS} strokeWidth={1.6} />
            <path d={yol(model)} fill="none" stroke={MODEL} strokeWidth={2} />
            <line x1={ix} x2={ix} y1={UST} y2={UST + ic.yuk} stroke="#3d3a33" strokeWidth={1.3} />
          </svg>
        )}
        {!sonuc && (
          <p className="absolute inset-0 grid place-items-center text-[12.5px] text-soluk">{t('dogrulama.grafik.bos')}</p>
        )}
      </div>
    </div>
  )
}

function Anahtar({ renk, ad, kesikli = false }: { renk: string; ad: string; kesikli?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-soluk">
      <span className={`w-[16px] border-t-2 ${kesikli ? 'border-dashed' : ''}`} style={{ borderColor: renk }} />
      {ad}
    </span>
  )
}
