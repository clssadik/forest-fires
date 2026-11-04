import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, sayi, yuzdeBicim } from '../../bicim'
import { gercekAlanaUlasti } from '../../dogrulama/api'
import type { OlayVerisi } from '../../olay/veri'
import { Bolum } from './ortak'

type Model = OlayVerisi['bilgi']['model']

/** Hata payları: panel renksizdir, sıra koyu griye doğru iner. */
const GRILER = ['#e8e8e8', '#8f8f8f', '#525252'] as const

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

/** Tek hizalı veri satırı: sabit yükseklik, solda ad, sağda değer. */
function Satir({ ad, deger, isaret, title }: { ad: string; deger: ReactNode; isaret?: string; title?: string }) {
  return (
    <li title={title} className="flex h-8 items-center gap-3 text-[13px] leading-[18px]">
      {isaret && <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: isaret }} />}
      <span className="shrink-0 text-ikincil">{ad}</span>
      <span className="ml-auto min-w-0 truncate text-right font-medium tabular-nums">{deger}</span>
    </li>
  )
}

const Satirlar = ({ children }: { children: ReactNode }) => <ul className="divide-y divide-white/[0.06]">{children}</ul>

const Not = ({ children }: { children: ReactNode }) => (
  <span className="text-[12px] leading-[18px] text-soluk tabular-nums">{children}</span>
)

function Bitis({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const b = veri.bilgi.model.bitis
  const hektar = (deger: number) => t('sagPanel.analiz.hektar', { deger: sayi(deger) })
  return (
    <Bolum baslik={t('sagPanel.analiz.bitisBaslik')}>
      <Satirlar>
        {b && <Satir ad={t('sagPanel.analiz.model')} deger={hektar(b.model_ha)} />}
        <Satir ad={t('sagPanel.analiz.gercek')} deger={hektar(veri.bilgi.gercek_ha)} />
        {b && (
          <Satir
            ad={t('sagPanel.analiz.oran')}
            deger={t('sagPanel.analiz.oranDeger', { deger: sayi(b.model_ha / veri.bilgi.gercek_ha, 1) })}
          />
        )}
      </Satirlar>
    </Bolum>
  )
}

/** Hata katmanının sayısal karşılığı; aynı anda ölçülür, an başlığın sağında. */
function HataDagilimi({ m }: { m: Model }) {
  const { t } = useTranslation()
  const parcalar = [
    { anahtar: 'dogru', ha: m.esit_alan.dogru_ha, gri: GRILER[0] },
    { anahtar: 'fazla', ha: m.esit_alan.yanlis_alarm_ha, gri: GRILER[1] },
    { anahtar: 'kacirilan', ha: m.esit_alan.kacirilan_ha, gri: GRILER[2] },
  ] as const
  const toplam = parcalar.reduce((a, p) => a + p.ha, 0) || 1

  return (
    <Bolum
      baslik={t('sagPanel.analiz.hataBaslik')}
      sag={
        <Not>
          {gercekAlanaUlasti(m.esit_alan)
            ? t('sagPanel.analiz.anSaat', { saat: sayi(m.esit_alan_esik_dk / 60) })
            : t('sagPanel.analiz.anBitis')}
        </Not>
      }
    >
      <div aria-hidden className="mb-1 flex h-1.5 gap-px overflow-hidden rounded-[2px]">
        {parcalar.map((p) => (
          <span key={p.anahtar} style={{ flexGrow: p.ha, background: p.gri }} />
        ))}
      </div>
      <Satirlar>
        {parcalar.map((p) => (
          <Satir
            key={p.anahtar}
            ad={t(`sagPanel.analiz.${p.anahtar}`)}
            deger={yuzdeBicim(p.ha / toplam)}
            isaret={p.gri}
            title={t('sagPanel.analiz.hektar', { deger: sayi(p.ha) })}
          />
        ))}
      </Satirlar>
    </Bolum>
  )
}

function ZamanFarki({ zaman }: { zaman: NonNullable<Model['zaman']> }) {
  const { t } = useTranslation()
  const ortanca = sayi(Math.abs(zaman.ortanca_saat), 1)
  return (
    <Bolum baslik={t('sagPanel.analiz.zamanBaslik')} sag={<Not>{t('sagPanel.analiz.zamanSag')}</Not>}>
      <Satirlar>
        <Satir
          ad={t('sagPanel.analiz.ortanca')}
          deger={t(zaman.ortanca_saat >= 0 ? 'sagPanel.analiz.ortancaGec' : 'sagPanel.analiz.ortancaErken', { deger: ortanca })}
        />
        <Satir ad={t('sagPanel.analiz.onIkiSaat')} deger={yuzdeBicim(zaman.oran_12_saat_icinde)} />
      </Satirlar>
    </Bolum>
  )
}

/** Doğrulamanın ve modelin dayandığı veriler: ad ve kaynak. */
function Veriler({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const { sentinel2, firms, hava, dem, worldcover, izgara } = veri.bilgi.kanitlar
  const a = 'sagPanel.analiz'
  return (
    <Bolum baslik={t(`${a}.veriBaslik`)}>
      <Satirlar>
        <Satir
          ad={t(`${a}.yanikAlan`)}
          deger={
            sentinel2
              ? t(`${a}.yanikAlanDeger`, { once: tarih(sentinel2.once.ana_tarih), sonra: tarih(sentinel2.sonra.ana_tarih) })
              : t(`${a}.yok`)
          }
        />
        <Satir ad={t(`${a}.tespitler`)} deger={firms ? t(`${a}.tespitlerDeger`, { sayi: sayi(firms.toplam) }) : t(`${a}.yok`)} />
        <Satir ad={t(`${a}.hava`)} deger={t(`${a}.havaDeger`, { deger: hava.cozunurluk_km })} />
        <Satir ad={t(`${a}.yukseklik`)} deger={t(`${a}.yukseklikDeger`, { deger: dem.cozunurluk_m })} />
        <Satir ad={t(`${a}.ortu`)} deger={t(`${a}.ortuDeger`, { yil: worldcover.yil, deger: worldcover.cozunurluk_m })} />
        <Satir ad={t(`${a}.izgara`)} deger={t(`${a}.izgaraDeger`, { deger: izgara.cozunurluk_m })} />
      </Satirlar>
    </Bolum>
  )
}
