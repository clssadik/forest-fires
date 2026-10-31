import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { pusulaYonu, type OlayVerisi, type OnemliOlay } from '../../olay/veri'
import { OlayIkonu } from '../OlayIkonu'
import { IkonKapat } from '../ikonlar'
import { Bolum, Satir } from './ImlecBilgisi'

const SAAT = 3_600_000
/** Derece, 4 ondalık (~10 m; kaba hücre 150 m). */
const derece = (d: number) => d.toFixed(4).replace('.', ',')

/**
 * Seçilen olayın ayrıntı kartı (haritanın sol üstü, pusulanın altı): olayın kaynağı (uydu, model ya
 * da girdi), olaya özgü değerler, yeri ve o andaki hava. × ya da Esc seçimi kaldırır.
 */
export function OlayAyrintisi({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const olay = useOlay((d) => d.seciliOlay)
  const olaySec = useOlay((d) => d.olaySec)

  useEffect(() => {
    if (!olay) return
    const kacis = (e: KeyboardEvent) => e.key === 'Escape' && olaySec(null)
    document.addEventListener('keydown', kacis)
    return () => document.removeEventListener('keydown', kacis)
  }, [olay, olaySec])

  if (!olay) return null
  const yer = olay.x !== undefined && olay.z !== undefined ? { x: olay.x, z: olay.z } : null
  const hava = veri.hava(olay.zaman)
  const saatSonra = Math.round((olay.zaman - veri.tutusmaMs) / SAAT)

  return (
    <div
      role="dialog"
      aria-label={t(`olaylar.turler.${olay.tur}`)}
      className="absolute top-[84px] left-5 z-30 max-h-[calc(100%-170px)] w-[256px] overflow-y-auto rounded-[8px] bg-black/90 px-3.5 pt-2.5 pb-3 text-[12.5px] leading-[18px] text-white ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-sm"
    >
      <div className="flex items-center gap-2">
        <OlayIkonu tur={olay.tur} boyut={15} />
        <span className="text-[14px] leading-[20px] font-semibold">{t(`olaylar.turler.${olay.tur}`)}</span>
        <button
          type="button"
          onClick={() => olaySec(null)}
          title={t('olayDuzeni.kapat')}
          aria-label={t('olayDuzeni.kapat')}
          className="-mr-1.5 ml-auto grid size-6 place-items-center rounded-[5px] text-white/70 hover:bg-white/10 hover:text-white"
        >
          <IkonKapat boyut={13} />
        </button>
      </div>
      <div className="text-[11.5px] text-white/75 tabular-nums">
        {gunAySaat(olay.zaman)} · {t('olayDuzeni.saatSayaci', { saat: saatSonra })}
      </div>

      <Bolum baslik={t('olayAyrintisi.olay')}>
        <Satir etiket={t('olayAyrintisi.kaynak')}>{t(`olayAyrintisi.kaynaklar.${olay.tur}`)}</Satir>
        <OlayDegerleri olay={olay} veri={veri} />
      </Bolum>

      {yer && (
        <Bolum baslik={t('imlec.arazi')}>
          <Satir etiket={t('imlec.koordinat')}>
            {derece(veri.konum(yer.x, yer.z).enlem)}, {derece(veri.konum(yer.x, yer.z).boylam)}
          </Satir>
          <Satir etiket={t('imlec.yukseklik')}>{t('harita.yukseklik', { deger: sayi(Math.round(veri.yukseklikM(yer.x, yer.z))) })}</Satir>
          <Satir etiket={t('olayAyrintisi.egim')}>{sayi(veri.egimVeBaki(yer.x, yer.z).egim)}°</Satir>
          <Satir etiket={t('imlec.ortu')}>{t(`imlec.ortuler.${veri.ortu(yer.x, yer.z)}`)}</Satir>
        </Bolum>
      )}

      <Bolum baslik={t('olayAyrintisi.hava')}>
        <Satir etiket={t('olayDuzeni.seritler.ruzgar')}>
          {sayi(hava.ruzgarKmSa)} km/sa {pusulaYonu(hava.ruzgarYonu)}
        </Satir>
        <Satir etiket={t('olayDuzeni.seritler.sicaklik')}>{sayi(hava.sicaklik)} °C</Satir>
        <Satir etiket={t('olayDuzeni.seritler.nem')}>%{sayi(hava.nem)}</Satir>
        <Satir etiket={t('olayDuzeni.yakitNemi')}>%{sayi(hava.yakitNemi)}</Satir>
      </Bolum>
    </div>
  )
}

/** Olay türüne özgü satırlar: uyduda gözlenen ve modelin alanı, büyüme hızı ya da sırt yüksekliği. */
function OlayDegerleri({ olay, veri }: { olay: OnemliOlay; veri: OlayVerisi }) {
  const { t } = useTranslation()
  const h = olay.ham
  if (olay.tur === 'uyduGecisi' && h?.firms_ha !== undefined && h.model_ha !== undefined) {
    // Haritada mavi gösterilen pikseller: önceki geçişten bu yana yeni görülen alan.
    const onceki = veri.olaylar.findLast((o) => o.tur === 'uyduGecisi' && o.zaman < olay.zaman)?.ham?.firms_ha ?? 0
    return (
      <>
        <Satir etiket={t('olayAyrintisi.yeniTespit')}>
          <span aria-hidden className="size-[7px] rounded-full bg-ates-acik shadow-[0_0_6px_rgba(242,138,94,0.9)]" />
          {sayi(Math.max(h.firms_ha - onceki, 0))} ha
        </Satir>
        <Satir etiket={t('olayAyrintisi.uyduAlani')}>{sayi(h.firms_ha)} ha</Satir>
        <Satir etiket={t('olayAyrintisi.modelAlani')}>{sayi(h.model_ha)} ha</Satir>
      </>
    )
  }
  if (olay.tur === 'hizliBuyume' && h?.ha_sa !== undefined)
    return (
      <>
        <Satir etiket={t('olayAyrintisi.buyume')}>{sayi(h.ha_sa)} ha/sa</Satir>
        <Satir etiket={t('olayAyrintisi.modelAlani')}>{sayi(veri.yananAlanHa(olay.zaman))} ha</Satir>
      </>
    )
  if (olay.tur === 'sirtaUlasma' && h?.yukseklik_m !== undefined)
    return <Satir etiket={t('olayAyrintisi.sirt')}>{sayi(h.yukseklik_m)} m</Satir>
  return null
}
