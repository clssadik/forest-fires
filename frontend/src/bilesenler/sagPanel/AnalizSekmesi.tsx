import { useTranslation } from 'react-i18next'
import { sayi, yuzdeBicim } from '../../bicim'
import { useKatmanlar } from '../../durum/katmanlar'
import type { OlayVerisi } from '../../olay/veri'
import { IkonTik } from '../ikonlar'

/** Hata katmanının renkleri (sahne/yanginMalzemesi.ts ile aynı). */
const HATA_RENKLERI = { dogru: '#d4472a', yanlisAlarm: '#f0b43c', kacirilan: '#455c80' } as const

/**
 * Analiz sekmesi: yangının tamamı için doğrulama karnesi. Eşit alanda IoU ve baseline'larla
 * karşılaştırma, modelin hatasının dağılımı (haritada da gösterilebilir) ve varış zamanı farkı.
 */
export function AnalizSekmesi({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const { bilgi } = veri
  const m = bilgi.model
  const daireyiGeciyor = m.daire_iou !== null && m.esit_alan_iou > m.daire_iou
  const deneyler = [...m.deneyler].sort((a, b) => b.iou - a.iou)
  const enBuyuk = Math.max(...deneyler.map((d) => d.iou), m.esit_alan_iou)

  return (
    <div className="space-y-3.5 px-3 pt-2.5 pb-3 text-[12px] leading-[16px]">
      <section>
        <div className="text-soluk">{t('sagPanel.analiz.iouBaslik', { sayi: m.calisma_sayisi })}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[24px] leading-[30px] font-semibold">{ucBasamak(m.esit_alan_iou)}</span>
          {m.esit_alan_iou_sapma !== null && (
            <span className="text-soluk">{t('sagPanel.analiz.sapma', { deger: ucBasamak(m.esit_alan_iou_sapma) })}</span>
          )}
        </div>
        {m.daire_iou !== null && (
          <div className={daireyiGeciyor ? 'text-[#3f6b33]' : 'text-ates'}>
            {t(daireyiGeciyor ? 'sagPanel.analiz.daireyiGeciyor' : 'sagPanel.analiz.daireyiGecemiyor', {
              deger: ucBasamak(m.daire_iou),
            })}
          </div>
        )}
      </section>

      {deneyler.length > 0 && (
        <section>
          <h3 className="mb-1 text-soluk">{t('sagPanel.analiz.deneyler')}</h3>
          <ul className="space-y-[3px]">
            {deneyler.map((d) => {
              const guncel = d.ad === m.ad
              return (
                <li key={d.ad} className="grid grid-cols-[104px_1fr_36px] items-center gap-1.5">
                  <span className={`truncate ${guncel ? 'font-semibold' : ''}`}>
                    {t(`sagPanel.analiz.deneyAdlari.${d.ad}`, { defaultValue: d.aciklama })}
                  </span>
                  <span className="h-[7px] rounded-[1px] bg-cizgi">
                    <span
                      className={`block h-full rounded-[1px] ${guncel ? 'bg-ates' : d.ad === 'daire' ? 'bg-koyu' : 'bg-silik'}`}
                      style={{ width: `${(d.iou / enBuyuk) * 100}%` }}
                    />
                  </span>
                  <span className={`text-right tabular-nums ${guncel ? 'font-semibold' : ''}`}>{ucBasamak(d.iou)}</span>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 grid grid-cols-3 gap-1 text-center">
            <Kutucuk etiket={t('sagPanel.analiz.dice')} deger={sayi(m.esit_alan.dice, 2)} />
            <Kutucuk etiket={t('sagPanel.analiz.kappa')} deger={sayi(m.esit_alan.kappa, 2)} />
            {m.zaman && (
              <Kutucuk etiket={t('sagPanel.analiz.onIkiSaat')} deger={yuzdeBicim(m.zaman.oran_12_saat_icinde)} />
            )}
          </div>
        </section>
      )}

      <HataDagilimi veri={veri} />
      {m.zaman && <ZamanFarki zaman={m.zaman} />}

      {m.bitis && (
        <p className="text-soluk">
          {t('sagPanel.analiz.bitis', { model: sayi(m.bitis.model_ha), gercek: sayi(bilgi.gercek_ha) })}
        </p>
      )}
    </div>
  )
}

const ucBasamak = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })

function Kutucuk({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div className="rounded-[4px] bg-panel-baslik px-1 py-1">
      <div className="text-[11px] text-soluk">{etiket}</div>
      <div className="font-semibold">{deger}</div>
    </div>
  )
}

/** Doğru / yanlış alarm / kaçırılan: yığılmış çubuk + haritada gösterme düğmesi. */
function HataDagilimi({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const katman = useKatmanlar((d) => d.katmanlar.find((k) => k.kimlik === 'hata'))
  const degistir = useKatmanlar((d) => d.degistir)
  const m = veri.bilgi.model
  const parcalar = [
    { anahtar: 'dogru', ha: m.esit_alan.dogru_ha },
    { anahtar: 'yanlisAlarm', ha: m.esit_alan.yanlis_alarm_ha },
    { anahtar: 'kacirilan', ha: m.esit_alan.kacirilan_ha },
  ] as const
  const acik = katman?.acik ?? false

  return (
    <section>
      <h3 className="mb-1">
        <span className="font-semibold">{t('sagPanel.analiz.hataBaslik')}</span>{' '}
        <span className="text-soluk">{t('sagPanel.analiz.hataAlt', { saat: sayi(m.esit_alan_esik_dk / 60) })}</span>
      </h3>
      <div className="mb-1.5 flex h-[11px] overflow-hidden rounded-[2px]">
        {parcalar.map((p) => (
          <span key={p.anahtar} style={{ flexGrow: p.ha, background: HATA_RENKLERI[p.anahtar] }} />
        ))}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-[2px]">
        {parcalar.map((p) => (
          <div key={p.anahtar} className="contents">
            <dt className="flex items-center gap-1.5">
              <span className="size-[9px] rounded-[2px]" style={{ background: HATA_RENKLERI[p.anahtar] }} />
              {t(`sagPanel.analiz.${p.anahtar}`)}
            </dt>
            <dd className="text-right tabular-nums">{t('sagPanel.analiz.hektar', { deger: sayi(p.ha) })}</dd>
          </div>
        ))}
      </dl>
      <label className="mt-1.5 flex w-fit cursor-pointer items-center gap-1.5">
        <input type="checkbox" className="peer sr-only" checked={acik} onChange={() => degistir('hata')} />
        <span
          className={`grid size-[14px] place-items-center rounded-[3px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ates/50 ${
            acik ? 'border-[#55514a] bg-[#55514a] text-white' : 'border-[#b5ae9e] bg-[#e6e2d7]'
          }`}
        >
          {acik && <IkonTik boyut={10} strokeWidth={3} />}
        </span>
        {t('sagPanel.analiz.haritadaGoster')}
      </label>
    </section>
  )
}

/** Model − FIRMS varış farkının çeyrekler kutusu; sıfır çizgisi kesikli. */
function ZamanFarki({ zaman }: { zaman: NonNullable<OlayVerisi['bilgi']['model']['zaman']> }) {
  const { t } = useTranslation()
  const sinir = Math.max(12, Math.ceil(Math.max(-zaman.ceyrek_alt_saat, zaman.ceyrek_ust_saat) / 12) * 12)
  const x = (saat: number) => ((saat + sinir) / (2 * sinir)) * 100
  const etiket = (s: number) => t('sagPanel.analiz.saatEtiket', { deger: `${s > 0 ? '+' : ''}${sayi(s)}` })

  return (
    <section>
      <h3 className="mb-1.5 font-semibold">{t('sagPanel.analiz.zamanBaslik')}</h3>
      <div className="relative h-[22px]">
        <span className="absolute inset-y-0 left-1/2 border-l border-dashed border-silik" />
        <span
          className="absolute top-[4px] h-[14px] rounded-[2px] border border-soluk bg-panel-baslik"
          style={{ left: `${x(zaman.ceyrek_alt_saat)}%`, width: `${x(zaman.ceyrek_ust_saat) - x(zaman.ceyrek_alt_saat)}%` }}
        />
        <span className="absolute top-[2px] h-[18px] w-[2px] -translate-x-1/2 bg-ates" style={{ left: `${x(zaman.ortanca_saat)}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-soluk tabular-nums">
        <span>{etiket(-sinir)}</span>
        <span>0</span>
        <span>{etiket(sinir)}</span>
      </div>
      <div className="mt-1">
        {t('sagPanel.analiz.zamanOzet', {
          ortanca: `${zaman.ortanca_saat > 0 ? '+' : ''}${sayi(zaman.ortanca_saat, 1)}`,
          oran: yuzdeBicim(zaman.oran_12_saat_icinde),
        })}
      </div>
      <div className="text-[11px] text-soluk">{t('sagPanel.analiz.zamanIpucu')}</div>
    </section>
  )
}
