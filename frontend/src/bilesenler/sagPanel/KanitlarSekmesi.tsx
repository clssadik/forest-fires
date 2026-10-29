import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, sayi, yuzdeBicim } from '../../bicim'
import { firmsKaynakAdi, type OlayVerisi } from '../../olay/veri'
import { IkonAlev, IkonHarita, IkonRuzgar, IkonUcgen, IkonYaprak } from '../ikonlar'

const tarih = (iso: string | null) => (iso ? gunAy(Date.parse(`${iso}T12:00:00Z`)) : '—')

/** Kanıtlar sekmesi: doğrulamanın ve modelin dayandığı verilerin künyesi. */
export function KanitlarSekmesi({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const k = veri.bilgi.kanitlar
  const s2 = k.sentinel2
  const firms = k.firms
  const sid = s2?.siddet_ha ?? {}

  return (
    <ul className="divide-y divide-cizgi px-3 py-1 text-[12px] leading-[16px]">
      <Satir ikon={<IkonUcgen boyut={13} />} baslik={t('sagPanel.kanitlar.sentinel')}>
        {s2 ? (
          <>
            <Alt>
              {t('sagPanel.kanitlar.sentinelTarih', {
                once: tarih(s2.once.ana_tarih),
                sonra: tarih(s2.sonra.ana_tarih),
                bulut: sayi(Math.max(s2.once.en_cok_bulut, s2.sonra.en_cok_bulut)),
              })}
            </Alt>
            <div>{t('sagPanel.kanitlar.sentinelAlan', { deger: sayi(s2.yanmis_ha), esik: sayi(s2.esik, 2) })}</div>
            <Alt>
              {t('sagPanel.kanitlar.siddet', {
                yuksek: sayi(sid.yuksek ?? 0),
                orta: sayi((sid.orta_yuksek ?? 0) + (sid.orta_dusuk ?? 0)),
                dusuk: sayi(sid.dusuk ?? 0),
              })}
            </Alt>
          </>
        ) : (
          <Alt>{t('sagPanel.kanitlar.yok')}</Alt>
        )}
      </Satir>
      <Satir ikon={<IkonAlev boyut={13} />} baslik={t('sagPanel.kanitlar.firms')}>
        {firms ? (
          <>
            <div>{t('sagPanel.kanitlar.firmsToplam', { deger: sayi(firms.toplam) })}</div>
            <Alt>
              {Object.entries(firms.kaynaklar)
                .map(([kod, n]) => `${firmsKaynakAdi(kod)} ${sayi(n)}`)
                .join(' · ')}
            </Alt>
            <Alt>
              {t('sagPanel.kanitlar.firmsGordu', {
                deger: sayi(firms.gordugu_ha),
                oran: yuzdeBicim(firms.gordugu_ha / veri.bilgi.gercek_ha),
              })}
            </Alt>
          </>
        ) : (
          <Alt>{t('sagPanel.kanitlar.yok')}</Alt>
        )}
      </Satir>
      <Satir ikon={<IkonRuzgar boyut={13} />} baslik={t('sagPanel.kanitlar.hava')}>
        <Alt>{t('sagPanel.kanitlar.havaAlt', { km: k.hava.cozunurluk_km, nokta: k.hava.nokta_sayisi })}</Alt>
      </Satir>
      <Satir ikon={<IkonHarita boyut={13} />} baslik={t('sagPanel.kanitlar.dem')}>
        <Alt>{t('sagPanel.kanitlar.demAlt', { m: k.dem.cozunurluk_m })}</Alt>
      </Satir>
      <Satir ikon={<IkonYaprak boyut={13} />} baslik={t('sagPanel.kanitlar.worldcover', { yil: k.worldcover.yil })}>
        <Alt>{t('sagPanel.kanitlar.worldcoverAlt', { m: k.worldcover.cozunurluk_m })}</Alt>
      </Satir>
      <Satir baslik={t('sagPanel.kanitlar.izgara')}>
        <Alt>
          {t('sagPanel.kanitlar.izgaraAlt', {
            m: k.izgara.cozunurluk_m,
            satir: sayi(k.izgara.satir),
            sutun: sayi(k.izgara.sutun),
          })}
        </Alt>
      </Satir>
    </ul>
  )
}

function Satir({ ikon, baslik, children }: { ikon?: ReactNode; baslik: string; children: ReactNode }) {
  return (
    <li className="py-2">
      <div className="flex items-center gap-1.5 font-semibold">
        {ikon && <span className="text-soluk">{ikon}</span>}
        {baslik}
      </div>
      {children}
    </li>
  )
}

const Alt = ({ children }: { children: ReactNode }) => <div className="text-soluk">{children}</div>
