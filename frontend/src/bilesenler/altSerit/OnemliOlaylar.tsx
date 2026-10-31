import { useEffect, useRef } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi } from '../../bicim'
import { useHarita } from '../../durum/harita'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi, OnemliOlay } from '../../olay/veri'
import { OlayIkonu } from '../OlayIkonu'

/**
 * Önemli olaylar çizelgesi (arka ucun otomatik bulduğu olaylar): dikey zaman çizgisi, her olayın
 * adı, tarihi ve kısa özeti. Tıklanınca zaman o ana atlar, kamera olayın yerine uçar ve yer
 * haritada işaretlenir (aynı olaya yeniden basmak işareti kaldırır). İmleçten önceki son olay
 * vurgulanır, gelecektekiler soluk.
 */
export function OnemliOlaylar({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const zamanaGit = useZaman((d) => d.zamanaGit)
  const odaklanIste = useHarita((d) => d.odaklanIste)
  const isaretli = useOlay((d) => d.seciliOlay)
  const olaySec = useOlay((d) => d.olaySec)
  const secili = veri.olaylar.findLast((o) => o.zaman <= zaman)
  const liste = useRef<HTMLUListElement>(null)

  // Oynatılırken vurgulanan olay görünür kalsın.
  useEffect(() => {
    liste.current?.querySelector('[data-secili="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [secili])

  const git = (o: OnemliOlay) => {
    if (isaretli?.zaman === o.zaman && isaretli.tur === o.tur) {
      olaySec(null)
      return
    }
    olaySec(o)
    zamanaGit(o.zaman)
    if (o.x !== undefined && o.z !== undefined) odaklanIste(o.x, o.z)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-cizgi">
      <h2 className="shrink-0 px-5 pt-4 pb-2 text-[13.5px] leading-[18px] font-semibold">{t('olaylar.baslik')}</h2>
      <ul ref={liste} className="relative flex-1 overflow-y-auto px-3 pb-3">
        {/* Dikey zaman çizgisi: ikonların ortasından geçer (12 px liste + 8 px düğme + 12 px yarım ikon). */}
        <span className="pointer-events-none absolute top-3 bottom-3 left-[31px] w-px bg-cizgi" />
        {veri.olaylar.map((o) => {
          const gelecek = o.zaman > zaman
          const seciliMi = o === secili
          const ozet = olayOzeti(o, t)
          return (
            <li key={`${o.tur}-${o.zaman}`} className="relative">
              <button
                type="button"
                data-secili={seciliMi}
                onClick={() => git(o)}
                title={t('olaylar.git')}
                className={`flex w-full items-start gap-3 rounded-[10px] px-2 py-2 text-left ${
                  seciliMi ? 'bg-yuzey-acik' : 'hover:bg-white/[0.05]'
                } ${gelecek ? 'opacity-55' : ''}`}
              >
                <span
                  className={`relative z-10 grid size-6 shrink-0 place-items-center rounded-full ring-4 ${
                    seciliMi ? 'bg-zemin ring-yuzey-acik' : 'bg-yuzey ring-panel'
                  }`}
                >
                  <OlayIkonu tur={o.tur} boyut={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] leading-[18px] font-semibold">{t(`olaylar.turler.${o.tur}`)}</span>
                    <span className="shrink-0 text-[11.5px] leading-4 text-ikincil tabular-nums">{gunAySaat(o.zaman)}</span>
                  </span>
                  {ozet && <span className="mt-0.5 block truncate text-[12px] leading-4 text-ikincil tabular-nums">{ozet}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Olayın tek satırlık kısa özeti; tutuşmada boş. */
export function olayOzeti(olay: OnemliOlay, t: TFunction): string {
  const h = olay.ham
  if (olay.tur === 'uyduGecisi' && h?.firms_ha !== undefined && h.model_ha !== undefined)
    return t('olaylar.ozet.uyduGecisi', { firms: sayi(h.firms_ha), model: sayi(h.model_ha) })
  if (olay.tur === 'hizliBuyume' && h?.ha_sa !== undefined) return t('olaylar.ozet.hizliBuyume', { deger: sayi(h.ha_sa) })
  if (olay.tur === 'sirtaUlasma' && h?.yukseklik_m !== undefined) return t('olaylar.ozet.sirtaUlasma', { deger: sayi(h.yukseklik_m) })
  return ''
}
