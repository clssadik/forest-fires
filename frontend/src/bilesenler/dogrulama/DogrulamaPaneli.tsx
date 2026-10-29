import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi, yuzdeBicim } from '../../bicim'
import { gercekAlanaUlasti } from '../../dogrulama/api'
import { KARSILASTIRMA_RENKLERI, sorensen } from '../../dogrulama/boyama'
import { tutusmaMs, useDogrulama, type DogrulamaKatmani } from '../../durum/dogrulama'
import { useZaman } from '../../durum/zaman'
import { Kart } from '../sagPanel/Kart'

/** Harita hücresi yerde ~30 m × 30 m (arka uç Mercator hücresini buna göre seçer). */
const HUCRE_HA = 0.09
const SAAT = 3_600_000
const MODEL_RENGI = '#2a78d6'
const BASELINE_RENGI = '#b9cfe9'

const ha = (x: number) => `${sayi(x)} ha`
const ucBasamak = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
/** Ölçüt değeri (0–1), raporlardaki gibi üç basamak: "0,400". */
const oran = (x: number) => ucBasamak.format(x)

/** Doğrulama ekranının sağ paneli. */
export function DogrulamaPaneli() {
  return (
    <aside className="flex w-[328px] shrink-0 flex-col gap-[7px] overflow-y-auto border-l border-cizgi bg-zemin p-[7px] [&>*]:shrink-0">
      <KatmanKarti />
      <SimulasyonKarti />
      <AnlikKart />
      <SonucKarti />
      <BaselineKarti />
    </aside>
  )
}

function KatmanKarti() {
  const { t } = useTranslation()
  const katmanlar = useDogrulama((d) => d.katmanlar)
  const renkKipi = useDogrulama((d) => d.renkKipi)
  const { katmanAcKapa, renkKipiAyarla } = useDogrulama.getState()
  const sira: DogrulamaKatmani[] = ['model', 'gercek', 'firms', 'altlik', 'osm']

  return (
    <Kart baslik={t('dogrulama.katmanlar.baslik')}>
      <div className="px-3 pt-2.5">
        <div role="radiogroup" aria-label={t('dogrulama.katmanlar.renkKipi')} className="flex rounded-md bg-[#cfc9b9] p-[3px]">
          {(['yayilim', 'karsilastirma'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={renkKipi === k}
              onClick={() => renkKipiAyarla(k)}
              className={`flex-1 rounded-[5px] py-[3px] text-[12.5px] ${
                renkKipi === k ? 'bg-[#efebe0] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-soluk'
              }`}
            >
              {t(`dogrulama.katmanlar.kipler.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <ul className="px-1.5 py-1.5">
        {sira.map((k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-[5px] text-[13px] hover:bg-black/[0.03]">
              <input type="checkbox" checked={katmanlar[k]} onChange={() => katmanAcKapa(k)} className="size-[14px] accent-[#3d3a33]" />
              {t(`dogrulama.katmanlar.${k}`)}
            </label>
          </li>
        ))}
      </ul>
    </Kart>
  )
}

function SimulasyonKarti() {
  const { t } = useTranslation()
  const sonuc = useDogrulama((d) => d.sonuc)
  const simulasyon = useDogrulama((d) => d.simulasyon)
  const hata = useDogrulama((d) => d.simulasyonHatasi)
  const hazir = useDogrulama((d) => d.yukleme === 'hazir')
  const calisiyor = simulasyon === 'calisiyor'

  return (
    <Kart baslik={t('dogrulama.simulasyon.baslik')}>
      <div className="flex flex-col gap-2 px-3 py-2.5 text-[12.5px]">
        {sonuc ? (
          <div>
            <div className="font-medium">{sonuc.aciklama}</div>
            <div className="text-soluk">
              {t('dogrulama.simulasyon.ozet', {
                calisma: sonuc.calisma_sayisi,
                sure: sayi(sonuc.sure_sn, 1),
                zaman: gunAySaat(Date.parse(sonuc.olusturma_utc)),
              })}
            </div>
          </div>
        ) : (
          <p className="text-soluk">{t('dogrulama.simulasyon.yok')}</p>
        )}
        <button
          type="button"
          disabled={!hazir || calisiyor}
          onClick={() => void useDogrulama.getState().simulasyonCalistir()}
          className="flex h-[34px] items-center justify-center gap-2 rounded-[5px] bg-koyu text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[#4a463e] disabled:opacity-60"
        >
          {calisiyor && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {t(calisiyor ? 'dogrulama.simulasyon.calisiyor' : 'dogrulama.simulasyon.calistir')}
        </button>
        {calisiyor && <p className="text-[11.5px] text-soluk">{t('dogrulama.simulasyon.bekleyin')}</p>}
        {hata && <p className="text-[12px] text-ates">{hata}</p>}
      </div>
    </Kart>
  )
}

function AnlikKart() {
  const { t } = useTranslation()
  const anlik = useDogrulama((d) => d.anlik)
  const bilgi = useDogrulama((d) => d.bilgi)
  const modelVar = useDogrulama((d) => d.rasterlar?.model != null)
  const zaman = useZaman((d) => d.t)
  const gecen = bilgi ? (zaman - tutusmaMs(bilgi)) / SAAT : 0
  const o = anlik && modelVar ? sorensen(anlik) : null

  return (
    <Kart baslik={t('dogrulama.anlik.baslik')} ek={`${gunAySaat(zaman)} · +${sayi(gecen, 0)} ${t('dogrulama.birim.sa')}`}>
      <dl className="grid grid-cols-3 gap-1 px-3 pt-2.5 pb-1">
        <Sayi etiket={t('dogrulama.anlik.model')} deger={anlik && modelVar ? ha(anlik.model * HUCRE_HA) : '—'} />
        <Sayi etiket={t('dogrulama.anlik.gozlenen')} deger={anlik ? ha(anlik.gozlenen * HUCRE_HA) : '—'} />
        <Sayi etiket={t('dogrulama.anlik.sorensen')} deger={o === null ? '—' : yuzdeBicim(o)} />
      </dl>
      <p className="px-3 pb-2.5 text-[11.5px] leading-[15px] text-soluk">{t('dogrulama.anlik.aciklama')}</p>
    </Kart>
  )
}

function SonucKarti() {
  const { t } = useTranslation()
  const sonuc = useDogrulama((d) => d.sonuc)
  const bilgi = useDogrulama((d) => d.bilgi)
  if (!sonuc || !bilgi) return null
  const { esit_alan: e, bitis: b, zaman: z } = sonuc.olcutler
  const toplam = b.dogru_ha + b.yanlis_alarm_ha + b.kacirilan_ha

  return (
    <Kart baslik={t('dogrulama.sonuc.baslik')} ek={t('dogrulama.sonuc.calisma', { calisma: sonuc.calisma_sayisi })}>
      <div className="flex flex-col gap-3 px-3 py-2.5">
        <section>
          <h3 className="text-[12px] font-semibold">{t('dogrulama.sonuc.bitis', { zaman: gunAySaat(Date.parse(bilgi.bitis_utc)) })}</h3>
          <p className="text-[11.5px] leading-[15px] text-soluk">{t('dogrulama.sonuc.sorensenAciklama')}</p>
          <dl className="mt-1 grid grid-cols-3 gap-1">
            <Sayi etiket={t('dogrulama.sonuc.sorensen')} deger={yuzdeBicim(b.dice)} buyuk />
            <Sayi etiket={t('dogrulama.sonuc.duyarlilik')} deger={yuzdeBicim(b.duyarlilik)} />
            <Sayi etiket={t('dogrulama.sonuc.isabet')} deger={yuzdeBicim(b.isabet)} />
          </dl>
          <div className="mt-2 flex h-[10px] overflow-hidden rounded-[2px]" role="img" aria-label={t('dogrulama.sonuc.karisiklik')}>
            {(
              [
                ['dogru', b.dogru_ha],
                ['yanlisAlarm', b.yanlis_alarm_ha],
                ['kacirilan', b.kacirilan_ha],
              ] as const
            ).map(([k, v]) => (
              <span key={k} style={{ width: `${(v / toplam) * 100}%`, background: KARSILASTIRMA_RENKLERI[k] }} />
            ))}
          </div>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px]">
            {(
              [
                ['dogru', b.dogru_ha],
                ['yanlisAlarm', b.yanlis_alarm_ha],
                ['kacirilan', b.kacirilan_ha],
              ] as const
            ).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2">
                <span className="size-[9px] rounded-[2px]" style={{ background: KARSILASTIRMA_RENKLERI[k] }} />
                {t(`dogrulama.karisiklik.${k}`)}
                <span className="ml-auto tabular-nums">{ha(v)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11.5px] text-soluk">
            {t('dogrulama.sonuc.alanlar', { model: ha(b.model_ha), gercek: ha(b.gercek_ha) })}
          </p>
        </section>

        <section>
          <h3 className="text-[12px] font-semibold">{t('dogrulama.sonuc.esitAlan')}</h3>
          <p className="text-[11.5px] leading-[15px] text-soluk">
            {gercekAlanaUlasti(e)
              ? t('dogrulama.sonuc.esitAlanAciklama', { saat: sayi(sonuc.olcutler.esit_alan_saat, 0) })
              : t('dogrulama.sonuc.esitAlanDurdu', { ha: sayi(e.model_ha, 0) })}
          </p>
          <dl className="mt-1.5 grid grid-cols-3 gap-1">
            <Sayi etiket="IoU" deger={oran(e.iou)} />
            <Sayi etiket={t('dogrulama.sonuc.sorensen')} deger={yuzdeBicim(e.dice)} />
            <Sayi etiket="Kappa" deger={oran(e.kappa)} />
          </dl>
        </section>

        <section>
          <h3 className="text-[12px] font-semibold">{t('dogrulama.sonuc.zaman')}</h3>
          <p className="text-[12px] leading-[16px]">
            {t('dogrulama.sonuc.zamanAciklama', {
              fark: `${z.ortanca_saat >= 0 ? '+' : ''}${sayi(z.ortanca_saat, 1)}`,
              oran: yuzdeBicim(z.oran_12_saat_icinde),
            })}
          </p>
        </section>
      </div>
    </Kart>
  )
}

function BaselineKarti() {
  const { t } = useTranslation()
  const baseline = useDogrulama((d) => d.bilgi?.baseline)
  if (!baseline) return null
  const deneyler = baseline.deneyler
  const enBuyuk = Math.max(...deneyler.map((d) => d.bitis_dice))
  const modelMi = (ad: string) => ad.startsWith('model_')
  const enIyiBul = (liste: typeof deneyler) => liste.reduce((a, b) => (b.bitis_dice > a.bitis_dice ? b : a))
  const model = enIyiBul(deneyler.filter((d) => modelMi(d.ad)))
  const enIyi = enIyiBul(deneyler.filter((d) => !modelMi(d.ad)))

  return (
    <Kart baslik={t('dogrulama.baseline.baslik')} ek={t('dogrulama.baseline.olcut')}>
      <ul className="flex flex-col gap-1.5 px-3 pt-2.5 pb-1.5">
        {deneyler.map((d) => {
          return (
            <li key={d.ad} className="text-[12px]">
              <div className="flex">
                <span className={modelMi(d.ad) ? 'font-semibold' : ''}>{t(`dogrulama.baseline.adlar.${d.ad}`, d.aciklama)}</span>
                <span className="ml-auto font-medium tabular-nums">{yuzdeBicim(d.bitis_dice)}</span>
              </div>
              <div className="mt-0.5 h-[7px] rounded-[2px] bg-[#cfc9b9]/60">
                <div
                  className="h-full rounded-[2px]"
                  style={{ width: `${(d.bitis_dice / (enBuyuk * 1.05)) * 100}%`, background: modelMi(d.ad) ? MODEL_RENGI : BASELINE_RENGI }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {model && model.bitis_dice < enIyi.bitis_dice && (
        <p className="mx-3 mb-2 rounded-[4px] bg-[#e8d9c4] px-2 py-1.5 text-[11.5px] leading-[15px]">
          {t('dogrulama.baseline.gecemiyor', {
            modelAd: t(`dogrulama.baseline.adlar.${model.ad}`, model.aciklama),
            model: yuzdeBicim(model.bitis_dice),
            en: yuzdeBicim(enIyi.bitis_dice),
            ad: t(`dogrulama.baseline.adlar.${enIyi.ad}`, enIyi.aciklama).toLocaleLowerCase('tr-TR'),
          })}
        </p>
      )}
      <p className="px-3 pb-2.5 text-[11px] text-soluk">{t('dogrulama.baseline.kaynak', { calisma: baseline.calisma_sayisi })}</p>
    </Kart>
  )
}

function Sayi({ etiket, deger, buyuk = false }: { etiket: ReactNode; deger: ReactNode; buyuk?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-soluk">{etiket}</dt>
      <dd className={`tabular-nums ${buyuk ? 'text-[20px] font-semibold leading-[24px]' : 'text-[14px] font-medium leading-[20px]'}`}>
        {deger}
      </dd>
    </div>
  )
}
