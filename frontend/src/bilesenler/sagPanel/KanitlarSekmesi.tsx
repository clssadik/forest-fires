import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, sayi, yuzdeBicim } from '../../bicim'
import { firmsKaynakAdi, type OlayVerisi } from '../../olay/veri'
import { IkonAlev, IkonHarita, IkonKare, IkonRuzgar, IkonUcgen, IkonYaprak } from '../ikonlar'
import { Bolum } from './ortak'

const tarih = (iso: string | null) => (iso ? gunAy(Date.parse(`${iso}T12:00:00Z`)) : '—')

/** Yanma şiddeti renkleri: koyudan açığa. */
const SIDDET_RENKLERI = { yuksek: '#d4472a', orta: '#f08c2a', dusuk: '#f2c56a' } as const

/**
 * Kanıtlar sekmesi: doğrulamanın ve modelin dayandığı verilerin künyesi. Gerçek alan Analiz'de,
 * tarihler üst barda ve zaman panelinde olduğu için burada tekrarlanmaz.
 */
export function KanitlarSekmesi({ veri }: { veri: OlayVerisi }) {
  return (
    <Bolum>
      <div className="space-y-2">
        <Sentinel veri={veri} />
        <Firms veri={veri} />
        <DigerKaynaklar veri={veri} />
      </div>
    </Bolum>
  )
}

/** Kaynak kartı: ikon, ad, kaynak, sağda ana değer; altında ayrıntı. */
function KaynakKarti({
  ikon,
  baslik,
  kaynak,
  deger,
  children,
}: {
  ikon: ReactNode
  baslik: string
  kaynak: string
  deger?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-[10px] bg-yuzey p-3">
      <div className="flex items-center gap-3">
        <Ikon>{ikon}</Ikon>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-[18px] font-semibold">{baslik}</div>
          <div className="truncate text-[12px] leading-4 text-ikincil">{kaynak}</div>
        </div>
        {deger && <div className="text-[15px] leading-5 font-semibold tabular-nums">{deger}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

const Ikon = ({ children }: { children: ReactNode }) => (
  <span className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-zemin/60 text-ikincil">{children}</span>
)

const Dipnot = ({ children }: { children: ReactNode }) => (
  <p className="mt-2.5 text-[12px] leading-4 text-ikincil tabular-nums">{children}</p>
)

function Sentinel({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const s2 = veri.bilgi.kanitlar.sentinel2
  const ortak = { ikon: <IkonUcgen boyut={15} />, baslik: t('sagPanel.kanitlar.sentinel'), kaynak: t('sagPanel.kanitlar.sentinelKaynak') }
  if (!s2) return <KaynakKarti {...ortak} deger={t('sagPanel.kanitlar.yok')} />
  const sid = s2.siddet_ha ?? {}
  const parcalar = [
    { anahtar: 'yuksek', ha: sid.yuksek ?? 0 },
    { anahtar: 'orta', ha: (sid.orta_yuksek ?? 0) + (sid.orta_dusuk ?? 0) },
    { anahtar: 'dusuk', ha: sid.dusuk ?? 0 },
  ] as const

  return (
    <KaynakKarti {...ortak}>
      <div className="mb-2 text-[12px] leading-4 text-ikincil">{t('sagPanel.kanitlar.siddet')}</div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        {parcalar.map((p) => (
          <span key={p.anahtar} style={{ flexGrow: p.ha, background: SIDDET_RENKLERI[p.anahtar] }} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {parcalar.map((p) => (
          <div key={p.anahtar}>
            <div className="flex items-center gap-1.5 text-[12px] leading-4 text-ikincil">
              <span className="size-2 rounded-[2px]" style={{ background: SIDDET_RENKLERI[p.anahtar] }} />
              {t(`sagPanel.kanitlar.${p.anahtar}`)}
            </div>
            <div className="mt-0.5 text-[12.5px] leading-4 font-medium tabular-nums">{t('sagPanel.kanitlar.ha', { deger: sayi(p.ha) })}</div>
          </div>
        ))}
      </div>
      <Dipnot>
        {t('sagPanel.kanitlar.sentinelTarih', {
          once: tarih(s2.once.ana_tarih),
          sonra: tarih(s2.sonra.ana_tarih),
        })}
      </Dipnot>
    </KaynakKarti>
  )
}

function Firms({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const firms = veri.bilgi.kanitlar.firms
  const ortak = { ikon: <IkonAlev boyut={15} />, baslik: t('sagPanel.kanitlar.firms'), kaynak: t('sagPanel.kanitlar.firmsKaynak') }
  if (!firms) return <KaynakKarti {...ortak} deger={t('sagPanel.kanitlar.yok')} />

  return (
    <KaynakKarti {...ortak} deger={sayi(firms.toplam)}>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(firms.kaynaklar).map(([kod, n]) => (
          <span key={kod} className="rounded-[6px] bg-zemin/60 px-2 py-1 text-[12px] leading-4 tabular-nums">
            <span className="text-ikincil">{firmsKaynakAdi(kod)}</span> <span className="font-medium">{sayi(n)}</span>
          </span>
        ))}
      </div>
      <Dipnot>
        {t('sagPanel.kanitlar.firmsGordu', { oran: yuzdeBicim(firms.gordugu_ha / veri.bilgi.gercek_ha) })}
      </Dipnot>
    </KaynakKarti>
  )
}

/** Hava, yükseklik, bitki örtüsü ve ızgara: tek kartta satırlar; sağda çözünürlük. */
function DigerKaynaklar({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const k = veri.bilgi.kanitlar
  const satirlar: { ikon: ReactNode; baslik: string; kaynak: string; deger: string }[] = [
    {
      ikon: <IkonRuzgar boyut={15} />,
      baslik: t('sagPanel.kanitlar.hava'),
      kaynak: t('sagPanel.kanitlar.havaKaynak', { nokta: k.hava.nokta_sayisi }),
      deger: t('sagPanel.kanitlar.km', { deger: k.hava.cozunurluk_km }),
    },
    {
      ikon: <IkonHarita boyut={15} />,
      baslik: t('sagPanel.kanitlar.dem'),
      kaynak: t('sagPanel.kanitlar.demKaynak'),
      deger: t('sagPanel.kanitlar.m', { deger: k.dem.cozunurluk_m }),
    },
    {
      ikon: <IkonYaprak boyut={15} />,
      baslik: t('sagPanel.kanitlar.worldcover'),
      kaynak: t('sagPanel.kanitlar.worldcoverKaynak', { yil: k.worldcover.yil }),
      deger: t('sagPanel.kanitlar.m', { deger: k.worldcover.cozunurluk_m }),
    },
    {
      ikon: <IkonKare boyut={15} />,
      baslik: t('sagPanel.kanitlar.izgara'),
      kaynak: t('sagPanel.kanitlar.izgaraKaynak', { satir: sayi(k.izgara.satir), sutun: sayi(k.izgara.sutun) }),
      deger: t('sagPanel.kanitlar.m', { deger: k.izgara.cozunurluk_m }),
    },
  ]
  return (
    <ul className="divide-y divide-white/[0.06] rounded-[10px] bg-yuzey px-3">
      {satirlar.map((s) => (
        <li key={s.baslik} className="flex items-center gap-3 py-3">
          <Ikon>{s.ikon}</Ikon>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] leading-[18px] font-semibold">{s.baslik}</div>
            <div className="truncate text-[12px] leading-4 text-ikincil">{s.kaynak}</div>
          </div>
          <div className="text-[12.5px] leading-4 font-medium tabular-nums">{s.deger}</div>
        </li>
      ))}
    </ul>
  )
}
