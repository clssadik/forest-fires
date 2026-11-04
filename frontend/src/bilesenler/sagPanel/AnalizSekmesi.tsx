import { useTranslation } from 'react-i18next'
import { gunAy, sayi, yuzdeBicim } from '../../bicim'
import { gercekAlanaUlasti } from '../../dogrulama/api'
import type { OlayVerisi } from '../../olay/veri'
import { HATA_RENKLERI } from '../../sahne/tematikRenkler'
import { Bolum, SayiKarti } from './ortak'

type Model = OlayVerisi['bilgi']['model']

const tarih = (iso: string | null | undefined) => (iso ? gunAy(Date.parse(`${iso}T12:00:00Z`)) : '—')

/**
 * Analiz sekmesi: yanan alan, modelin nerede yanıldığı, ne kadar geç kaldığı ve dayandığı veriler.
 * Doğruluk ölçütleri Özet'te, haritadaki karşılıkları Katmanlar'da olduğu için tekrarlanmaz.
 */
export function AnalizSekmesi({ veri }: { veri: OlayVerisi }) {
  const m = veri.bilgi.model
  return (
    <>
      <Bitis veri={veri} />
      <HataDagilimi m={m} />
      {m.zaman && <ZamanFarki zaman={m.zaman} />}
      <Veriler veri={veri} />
    </>
  )
}

function Bitis({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const b = veri.bilgi.model.bitis
  return (
    <Bolum baslik={t('sagPanel.analiz.bitisBaslik')}>
      <div className="grid grid-cols-2 gap-2">
        {b && <SayiKarti etiket={t('sagPanel.analiz.model')} deger={t('sagPanel.analiz.hektar', { deger: sayi(b.model_ha) })} />}
        <SayiKarti etiket={t('sagPanel.analiz.gercek')} deger={t('sagPanel.analiz.hektar', { deger: sayi(veri.bilgi.gercek_ha) })} />
      </div>
    </Bolum>
  )
}

/** Hata katmanının sayısal karşılığı; aynı anda ölçülür, an başlığın sağında. */
function HataDagilimi({ m }: { m: Model }) {
  const { t } = useTranslation()
  const parcalar = [
    { anahtar: 'dogru', ha: m.esit_alan.dogru_ha },
    { anahtar: 'fazla', ha: m.esit_alan.yanlis_alarm_ha },
    { anahtar: 'kacirilan', ha: m.esit_alan.kacirilan_ha },
  ] as const
  const toplam = parcalar.reduce((a, p) => a + p.ha, 0) || 1

  return (
    <Bolum
      baslik={t('sagPanel.analiz.hataBaslik')}
      sag={
        <span className="text-[12px] leading-[18px] text-ikincil tabular-nums">
          {gercekAlanaUlasti(m.esit_alan)
            ? t('sagPanel.analiz.anSaat', { saat: sayi(m.esit_alan_esik_dk / 60) })
            : t('sagPanel.analiz.anBitis')}
        </span>
      }
    >
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {parcalar.map((p) => (
          <span key={p.anahtar} style={{ flexGrow: p.ha, background: HATA_RENKLERI[p.anahtar] }} />
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {parcalar.map((p) => (
          <li key={p.anahtar} title={t('sagPanel.analiz.hektar', { deger: sayi(p.ha) })} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: HATA_RENKLERI[p.anahtar] }} />
            <span className="min-w-0 flex-1 text-[13px] leading-[18px] font-medium">{t(`sagPanel.analiz.${p.anahtar}`)}</span>
            <span className="text-[13px] leading-[18px] font-semibold tabular-nums">{yuzdeBicim(p.ha / toplam)}</span>
          </li>
        ))}
      </ul>
    </Bolum>
  )
}

function ZamanFarki({ zaman }: { zaman: NonNullable<Model['zaman']> }) {
  const { t } = useTranslation()
  const ortanca = sayi(Math.abs(zaman.ortanca_saat), 1)
  return (
    <Bolum
      baslik={t('sagPanel.analiz.zamanBaslik')}
      sag={<span className="text-[12px] leading-[18px] text-ikincil">{t('sagPanel.analiz.zamanSag')}</span>}
    >
      <div className="grid grid-cols-2 gap-2">
        <SayiKarti
          etiket={t('sagPanel.analiz.ortanca')}
          deger={t(zaman.ortanca_saat >= 0 ? 'sagPanel.analiz.ortancaGec' : 'sagPanel.analiz.ortancaErken', { deger: ortanca })}
        />
        <SayiKarti etiket={t('sagPanel.analiz.onIkiSaat')} deger={yuzdeBicim(zaman.oran_12_saat_icinde)} />
      </div>
    </Bolum>
  )
}

/** Doğrulamanın ve modelin dayandığı veriler: ad ve kaynak. */
function Veriler({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const { sentinel2, firms, hava, dem, worldcover, izgara } = veri.bilgi.kanitlar
  const a = 'sagPanel.analiz'
  const satirlar = [
    {
      ad: t(`${a}.yanikAlan`),
      deger: sentinel2
        ? t(`${a}.yanikAlanDeger`, { once: tarih(sentinel2.once.ana_tarih), sonra: tarih(sentinel2.sonra.ana_tarih) })
        : t(`${a}.yok`),
    },
    { ad: t(`${a}.tespitler`), deger: firms ? t(`${a}.tespitlerDeger`, { sayi: sayi(firms.toplam) }) : t(`${a}.yok`) },
    { ad: t(`${a}.hava`), deger: t(`${a}.havaDeger`, { deger: hava.cozunurluk_km }) },
    { ad: t(`${a}.yukseklik`), deger: t(`${a}.yukseklikDeger`, { deger: dem.cozunurluk_m }) },
    { ad: t(`${a}.ortu`), deger: t(`${a}.ortuDeger`, { yil: worldcover.yil, deger: worldcover.cozunurluk_m }) },
    { ad: t(`${a}.izgara`), deger: t(`${a}.izgaraDeger`, { deger: izgara.cozunurluk_m }) },
  ]
  return (
    <Bolum baslik={t(`${a}.veriBaslik`)}>
      <ul className="space-y-2">
        {satirlar.map((s) => (
          <li key={s.ad} className="flex items-baseline justify-between gap-3 text-[13px] leading-[18px]">
            <span className="shrink-0 text-ikincil">{s.ad}</span>
            <span className="min-w-0 truncate text-right font-medium tabular-nums">{s.deger}</span>
          </li>
        ))}
      </ul>
    </Bolum>
  )
}
