import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'
import { OlayIkonu } from '../OlayIkonu'

/**
 * Önemli olaylar çizelgesi (arka ucun otomatik bulduğu olaylar): dikey zaman çizgisi, her olayın
 * adı ve tarihi. Tıklanınca olay seçilir (zaman o ana atlar, kamera yerine uçar, ayrıntılar
 * haritadaki kartta); seçili olana basmak seçimi kaldırır. Seçili olay, yoksa imleçten önceki son
 * olay vurgulanır; gelecektekiler soluk.
 */
export function OnemliOlaylar({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const seciliOlay = useOlay((d) => d.seciliOlay)
  const olayaGit = useOlay((d) => d.olayaGit)
  const secili = seciliOlay ?? veri.olaylar.findLast((o) => o.zaman <= zaman)
  const liste = useRef<HTMLUListElement>(null)

  // Oynatılırken vurgulanan olay görünür kalsın.
  useEffect(() => {
    liste.current?.querySelector('[data-secili="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [secili])

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-cizgi">
      <h2 className="shrink-0 px-5 pt-4 pb-2 text-[13.5px] leading-[18px] font-semibold">{t('olaylar.baslik')}</h2>
      <ul ref={liste} className="relative flex-1 overflow-y-auto px-3 pb-3">
        {/* Dikey zaman çizgisi: ikonların ortasından geçer (12 px liste + 8 px düğme + 12 px yarım ikon). */}
        <span className="pointer-events-none absolute top-3 bottom-3 left-[31px] w-px bg-cizgi" />
        {veri.olaylar.map((o) => {
          const gelecek = o.zaman > zaman
          const seciliMi = o === secili
          return (
            <li key={`${o.tur}-${o.zaman}`} className="relative">
              <button
                type="button"
                data-secili={seciliMi}
                aria-pressed={o === seciliOlay}
                onClick={() => olayaGit(o)}
                title={t('olaylar.git')}
                className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left ${
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
                <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] font-semibold">{t(`olaylar.turler.${o.tur}`)}</span>
                <span className="shrink-0 text-[11.5px] leading-4 text-ikincil tabular-nums">{gunAySaat(o.zaman)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
