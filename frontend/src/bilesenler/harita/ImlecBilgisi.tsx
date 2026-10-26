import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi, yuzdeBicim } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import { pusulaYonu, type OlayVerisi } from '../../olay/veri'

const SAAT = 3_600_000

/**
 * Fare altındaki hücrenin bilgisi (sağ üst): koordinat, yükseklik, eğim, bakı, örtü,
 * modelin varışı (t anına göre), yanma olasılığı, gerçek yanmış alanın içinde mi, FIRMS ilk tespiti.
 */
export function ImlecBilgisi({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const imlec = useOlay((d) => d.imlec)
  // Varış metni saat değişince güncellenir (her karede değil).
  const saat = useZaman((d) => Math.floor((d.t - veri.tutusmaMs) / SAAT))
  if (!imlec || !veri.icinde(imlec.x, imlec.z)) return null
  const { x, z } = imlec
  const { enlem, boylam } = veri.konum(x, z)
  const { egim, baki } = veri.egimVeBaki(x, z)
  const toa = veri.toaSaat(x, z)
  const firms = veri.firmsSaat(x, z)
  const fark = toa - saat

  const varis = !Number.isFinite(toa)
    ? t('imlec.yanmiyor')
    : fark <= 0
      ? t('imlec.yandi', { saat: sayi(Math.max(-fark, 0)) })
      : t('imlec.yanacak', { saat: sayi(fark) })

  const satirlar: [string, ReactNode][] = [
    [t('imlec.koordinat'), `${sayi(enlem, 2)}° K, ${sayi(boylam, 2)}° D`],
    [t('imlec.yukseklik'), t('harita.yukseklik', { deger: sayi(Math.round(veri.yukseklikM(x, z))) })],
    [t('imlec.egimBaki'), `${sayi(egim)}° · ${egim < 2 ? t('imlec.duz') : pusulaYonu(baki)}`],
    [t('imlec.ortu'), t(`imlec.ortuler.${veri.ortu(x, z)}`)],
    [t('imlec.model'), varis],
    [t('imlec.olasilik'), yuzdeBicim(veri.olasilik(x, z))],
    [t('imlec.gercek'), veri.gercek(x, z) >= 0.5 ? t('imlec.icinde') : t('imlec.disinda')],
    [
      t('imlec.firms'),
      Number.isFinite(firms) ? gunAySaat(veri.tutusmaMs + firms * SAAT) : t('imlec.yok'),
    ],
  ]

  return (
    <div className="pointer-events-none absolute top-3 right-4 w-[236px] rounded-[5px] bg-[#2a2723]/80 px-3 py-2 text-[12px] leading-[18px] text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] backdrop-blur-sm">
      <div className="mb-1 font-semibold">{t('imlec.baslik')}</div>
      <dl className="grid grid-cols-[92px_1fr] gap-x-2">
        {satirlar.map(([etiket, deger]) => (
          <div key={etiket} className="contents">
            <dt className="text-white/65">{etiket}</dt>
            <dd className="truncate">{deger}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
