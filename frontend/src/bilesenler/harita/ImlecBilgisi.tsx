import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi, yuzdeBicim } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'

const SAAT = 3_600_000

/** Durum noktalarının renkleri: yandı, yanacak, gerçek alanın içinde, yanmıyor / dışında. */
const RENK = { yandi: '#ec5a3a', yanacak: '#f2b84a', gercek: '#e8e2d6', yok: 'rgba(255,255,255,0.28)' }

/**
 * Fare altındaki hücrenin ayrıntıları (sağ üst; sahne etiketlerinin önünde). Başlığın altında
 * koordinat; "Arazi" bölümünde yükseklik ve örtü, "Yangın" bölümünde modelin varışı (t anına göre),
 * yanma olasılığı, gerçek yanmış alanın içinde mi ve FIRMS ilk tespiti.
 */
export function ImlecBilgisi({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const imlec = useOlay((d) => d.imlec)
  // Varış metni saat değişince güncellenir (her karede değil).
  const saat = useZaman((d) => Math.floor((d.t - veri.tutusmaMs) / SAAT))
  if (!imlec || !veri.icinde(imlec.x, imlec.z)) return null
  const { x, z } = imlec
  const { enlem, boylam } = veri.konum(x, z)
  const toa = veri.toaSaat(x, z)
  const firms = veri.firmsSaat(x, z)
  const olasilik = veri.olasilik(x, z)
  const icinde = veri.gercek(x, z) >= 0.5
  const fark = toa - saat

  const [varis, varisRengi] = !Number.isFinite(toa)
    ? [t('imlec.yanmiyor'), RENK.yok]
    : fark <= 0
      ? [t('imlec.yandi', { saat: sayi(Math.max(-fark, 0)) }), RENK.yandi]
      : [t('imlec.yanacak', { saat: sayi(fark) }), RENK.yanacak]

  return (
    <div className="pointer-events-none absolute top-3 right-4 z-30 w-[256px] rounded-[8px] bg-black/80 px-3.5 pt-2.5 pb-3 text-[12.5px] leading-[18px] text-white ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="font-semibold">{t('imlec.baslik')}</div>
      <div className="text-[11.5px] text-white/50 tabular-nums">
        {sayi(enlem, 2)}° K · {sayi(boylam, 2)}° D
      </div>

      <Bolum baslik={t('imlec.arazi')}>
        <Satir etiket={t('imlec.yukseklik')}>{t('harita.yukseklik', { deger: sayi(Math.round(veri.yukseklikM(x, z))) })}</Satir>
        <Satir etiket={t('imlec.ortu')}>{t(`imlec.ortuler.${veri.ortu(x, z)}`)}</Satir>
      </Bolum>

      <Bolum baslik={t('imlec.yangin')}>
        <Satir etiket={t('imlec.model')}>
          <Nokta renk={varisRengi} />
          {varis}
        </Satir>
        <Satir etiket={t('imlec.olasilik')}>
          <span className="h-[4px] w-[44px] overflow-hidden rounded-full bg-white/15">
            <span className="block h-full rounded-full bg-ates-acik" style={{ width: `${olasilik * 100}%` }} />
          </span>
          <span className="w-[34px] text-right">{yuzdeBicim(olasilik)}</span>
        </Satir>
        <Satir etiket={t('imlec.gercek')}>
          <Nokta renk={icinde ? RENK.gercek : RENK.yok} />
          {icinde ? t('imlec.icinde') : t('imlec.disinda')}
        </Satir>
        <Satir etiket={t('imlec.firms')}>
          {Number.isFinite(firms) ? gunAySaat(veri.tutusmaMs + firms * SAAT) : <span className="text-white/40">{t('imlec.yok')}</span>}
        </Satir>
      </Bolum>
    </div>
  )
}

function Bolum({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <div className="mt-2.5 border-t border-white/10 pt-2">
      <div className="mb-1 text-[10.5px] font-semibold tracking-[0.06em] text-white/40 uppercase">{baslik}</div>
      <dl className="flex flex-col gap-[3px]">{children}</dl>
    </div>
  )
}

function Satir({ etiket, children }: { etiket: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-white/60">{etiket}</dt>
      <dd className="flex items-center gap-1.5 font-medium whitespace-nowrap tabular-nums">{children}</dd>
    </div>
  )
}

function Nokta({ renk }: { renk: string }) {
  return <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: renk }} />
}
