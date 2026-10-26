import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi } from '../../bicim'
import { useHarita } from '../../durum/harita'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi, OnemliOlay } from '../../olay/veri'
import { OlayIkonu } from '../OlayIkonu'

const SAAT = 3_600_000

/**
 * Önemli olaylar çizelgesi (arka ucun otomatik bulduğu olaylar): dikey zaman çizgisi, her olayın
 * tutuşmadan sonraki saati, adı ve bir satırlık ayrıntısı. Tıklanınca zaman o ana atlar ve
 * kamera olayın yerine uçar. İmleçten önceki son olay vurgulanır, gelecektekiler soluk.
 */
export function OnemliOlaylar({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const zamanaGit = useZaman((d) => d.zamanaGit)
  const odaklanIste = useHarita((d) => d.odaklanIste)
  const secili = veri.olaylar.findLast((o) => o.zaman <= zaman)
  const liste = useRef<HTMLUListElement>(null)

  // Oynatılırken vurgulanan olay görünür kalsın.
  useEffect(() => {
    liste.current?.querySelector('[data-secili="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [secili])

  const git = (o: OnemliOlay) => {
    zamanaGit(o.zaman)
    if (o.x !== undefined && o.z !== undefined) odaklanIste(o.x, o.z)
  }

  return (
    <aside className="flex w-[264px] shrink-0 flex-col border-l border-cizgi bg-olaylar">
      <header className="flex h-[36px] shrink-0 items-baseline gap-2 px-3 pt-2.5">
        <h2 className="text-[14px] font-semibold">{t('olaylar.baslik')}</h2>
        <span className="text-[11.5px] text-soluk">{t('olaylar.otomatik')}</span>
      </header>
      <ul ref={liste} className="relative flex-1 overflow-y-auto px-3 pb-2">
        {/* Dikey zaman çizgisi */}
        <span className="pointer-events-none absolute top-1 bottom-1 left-[21px] w-[2px] bg-cizgi" />
        {veri.olaylar.map((o) => {
          const gelecek = o.zaman > zaman
          const seciliMi = o === secili
          const saat = Math.round(((o.zaman - veri.tutusmaMs) / SAAT) * 10) / 10
          return (
            <li key={`${o.tur}-${o.zaman}`} className="relative">
              <button
                type="button"
                data-secili={seciliMi}
                onClick={() => git(o)}
                title={t('olaylar.git')}
                className={`my-[3px] flex w-full gap-2 rounded-[5px] py-1 pr-2 pl-0.5 text-left text-[12.5px] leading-[16px] ${
                  seciliMi ? 'bg-koyu text-[#efebe0]' : 'hover:bg-black/[0.04]'
                } ${gelecek ? 'opacity-50' : ''}`}
              >
                <span
                  className={`relative z-10 mt-[1px] grid size-[18px] shrink-0 place-items-center rounded-full ${
                    seciliMi ? 'bg-[#efebe0]' : 'bg-olaylar'
                  }`}
                >
                  <OlayIkonu tur={o.tur} boyut={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[11.5px] ${seciliMi ? 'text-[#c9c2b2]' : 'text-soluk'}`}>
                    {t('olaylar.saat', { saat: sayi(saat, 1) })} · {gunAySaat(o.zaman)}
                  </span>
                  <span className="block font-semibold">{t(`olaylar.turler.${o.tur}`)}</span>
                  <Ayrinti olay={o} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function Ayrinti({ olay }: { olay: OnemliOlay }) {
  const { t } = useTranslation()
  const h = olay.ham
  if (!h) return null
  let metin: string | null = null
  if (h.tur === 'uyduGecisi' && h.firms_ha !== undefined && h.model_ha !== undefined)
    metin = t('olaylar.ayrinti.uyduGecisi', { firms: sayi(h.firms_ha), model: sayi(h.model_ha) })
  else if (h.tur === 'hizliBuyume' && h.ha_sa !== undefined)
    metin = t('olaylar.ayrinti.hizliBuyume', { deger: sayi(h.ha_sa) })
  else if (h.tur === 'sirtaUlasma' && h.yukseklik_m !== undefined)
    metin = t('olaylar.ayrinti.sirtaUlasma', { deger: sayi(h.yukseklik_m) })
  return metin ? <span className="block truncate text-[11.5px] opacity-80">{metin}</span> : null
}
