import { useTranslation } from 'react-i18next'
import { sayi, yuzdeBicim } from '../../bicim'
import { gercekAlanaUlasti } from '../../dogrulama/api'
import type { OlayVerisi } from '../../olay/veri'
import { Bolum, SayiKarti } from './ortak'

/** Hata katmanının renkleri (sahne/yanginMalzemesi.ts ile aynı). */
const HATA_RENKLERI = { dogru: '#d4472a', yanlisAlarm: '#f0b43c', kacirilan: '#455c80' } as const

type Model = OlayVerisi['bilgi']['model']

/**
 * Analiz sekmesi: yangının tamamı için doğrulama ayrıntısı. Bitişteki doğruluk ve basit daire sağ
 * sütunda olduğu için burada tekrarlanmaz; burada bitişteki alanlar, öteki sürümler, modelin
 * hatasının dağılımı ve varış zamanı farkı var.
 */
export function AnalizSekmesi({ veri }: { veri: OlayVerisi }) {
  const m = veri.bilgi.model
  return (
    <>
      <Bitis veri={veri} />
      <Surumler m={m} />
      <HataDagilimi m={m} />
      {m.zaman && <ZamanFarki zaman={m.zaman} />}
    </>
  )
}

/** Yangın sonunda model ve gerçek alan, yakalama ve isabet. */
function Bitis({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const b = veri.bilgi.model.bitis
  return (
    <Bolum baslik={t('sagPanel.analiz.bitisBaslik')}>
      <div className="grid grid-cols-2 gap-2">
        {b && <SayiKarti etiket={t('sagPanel.analiz.modelAlani')} deger={t('sagPanel.analiz.hektar', { deger: sayi(b.model_ha) })} />}
        <SayiKarti etiket={t('sagPanel.analiz.gercekAlan')} deger={t('sagPanel.analiz.hektar', { deger: sayi(veri.bilgi.gercek_ha) })} />
        {b && (
          <>
            <SayiKarti etiket={t('sagPanel.analiz.yakalama')} deger={yuzdeBicim(b.duyarlilik)} alt={t('sagPanel.analiz.yakalamaAlt')} />
            <SayiKarti etiket={t('sagPanel.analiz.isabet')} deger={yuzdeBicim(b.isabet)} alt={t('sagPanel.analiz.isabetAlt')} />
          </>
        )}
      </div>
    </Bolum>
  )
}

/** Öteki sürümlerin ve deneylerin bitişteki doğruluğu; güncel model ve basit daire sağ sütunda. */
function Surumler({ m }: { m: Model }) {
  const { t } = useTranslation()
  const deneyler = m.deneyler.filter((d) => d.ad !== m.ad && d.ad !== 'daire').sort((a, b) => b.dice - a.dice)
  if (!deneyler.length) return null

  return (
    <Bolum baslik={t('sagPanel.analiz.deneyler')}>
      <ul className="space-y-2">
        {deneyler.map((d) => (
          <li key={d.ad} className="grid grid-cols-[minmax(0,1fr)_88px_36px] items-center gap-3">
            <span className="truncate text-[12.5px] leading-4">{t(`sagPanel.analiz.deneyAdlari.${d.ad}`, { defaultValue: d.aciklama })}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-yuzey-acik">
              <span className="block h-full rounded-full bg-white/35" style={{ width: `${Math.min(Math.max(d.dice, 0), 1) * 100}%` }} />
            </span>
            <span className="text-right text-[12.5px] leading-4 tabular-nums">{yuzdeBicim(d.dice)}</span>
          </li>
        ))}
      </ul>
    </Bolum>
  )
}

/** Doğru / fazla / kaçırılan: yığılmış çubuk ve açıklamalı lejant (hektarlar ipucunda). */
function HataDagilimi({ m }: { m: Model }) {
  const { t } = useTranslation()
  const parcalar = [
    { anahtar: 'dogru', ha: m.esit_alan.dogru_ha },
    { anahtar: 'yanlisAlarm', ha: m.esit_alan.yanlis_alarm_ha },
    { anahtar: 'kacirilan', ha: m.esit_alan.kacirilan_ha },
  ] as const
  const toplam = parcalar.reduce((a, p) => a + p.ha, 0) || 1

  return (
    <Bolum
      baslik={t('sagPanel.analiz.hataBaslik')}
      alt={
        gercekAlanaUlasti(m.esit_alan)
          ? t('sagPanel.analiz.hataAlt', { saat: sayi(m.esit_alan_esik_dk / 60) })
          : t('sagPanel.analiz.hataAltDurdu')
      }
    >
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
        {parcalar.map((p) => (
          <span key={p.anahtar} style={{ flexGrow: p.ha, background: HATA_RENKLERI[p.anahtar] }} />
        ))}
      </div>
      <ul className="mt-3 space-y-2.5">
        {parcalar.map((p) => (
          <li key={p.anahtar} title={t('sagPanel.analiz.hektar', { deger: sayi(p.ha) })} className="flex items-start gap-2.5">
            <span className="mt-[3px] size-2.5 shrink-0 rounded-[3px]" style={{ background: HATA_RENKLERI[p.anahtar] }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] leading-4 font-medium">{t(`sagPanel.analiz.${p.anahtar}`)}</span>
              <span className="block text-[12px] leading-4 text-ikincil">{t(`sagPanel.analiz.${p.anahtar}Alt`)}</span>
            </span>
            <span className="text-[12.5px] leading-4 font-semibold tabular-nums">{yuzdeBicim(p.ha / toplam)}</span>
          </li>
        ))}
      </ul>
    </Bolum>
  )
}

/** Model − FIRMS varış farkının çeyrekler kutusu; sıfır çizgisi kesikli, sol erken, sağ geç. */
function ZamanFarki({ zaman }: { zaman: NonNullable<Model['zaman']> }) {
  const { t } = useTranslation()
  const sinir = Math.max(12, Math.ceil(Math.max(-zaman.ceyrek_alt_saat, zaman.ceyrek_ust_saat) / 12) * 12)
  const x = (saat: number) => ((saat + sinir) / (2 * sinir)) * 100
  const etiket = (s: number) => t('sagPanel.analiz.saatEtiket', { deger: `${s > 0 ? '+' : ''}${sayi(s)}` })
  const ortanca = sayi(Math.abs(zaman.ortanca_saat), 1)

  return (
    <Bolum baslik={t('sagPanel.analiz.zamanBaslik')} alt={t('sagPanel.analiz.zamanAlt')}>
      <div className="relative h-6">
        <span className="absolute inset-x-0 top-1/2 border-t border-cizgi" />
        <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-eksen" />
        <span
          className="absolute top-[5px] h-[14px] rounded-[3px] bg-white/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
          style={{ left: `${x(zaman.ceyrek_alt_saat)}%`, width: `${x(zaman.ceyrek_ust_saat) - x(zaman.ceyrek_alt_saat)}%` }}
        />
        <span className="absolute top-[2px] h-5 w-[2px] -translate-x-1/2 rounded-full bg-guclu" style={{ left: `${x(zaman.ortanca_saat)}%` }} />
      </div>
      <div className="mt-1 grid grid-cols-3 text-[11.5px] leading-4 text-ikincil tabular-nums">
        <span>
          {etiket(-sinir)} · {t('sagPanel.analiz.erken')}
        </span>
        <span className="text-center">0</span>
        <span className="text-right">
          {t('sagPanel.analiz.gec')} · {etiket(sinir)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SayiKarti
          etiket={t('sagPanel.analiz.ortanca')}
          deger={t(zaman.ortanca_saat >= 0 ? 'sagPanel.analiz.ortancaGec' : 'sagPanel.analiz.ortancaErken', { deger: ortanca })}
        />
        <SayiKarti etiket={t('sagPanel.analiz.onIkiSaat')} deger={yuzdeBicim(zaman.oran_12_saat_icinde)} />
      </div>
    </Bolum>
  )
}
