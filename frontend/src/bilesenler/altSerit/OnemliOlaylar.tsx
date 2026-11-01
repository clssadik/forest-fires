import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ay, gun, gunAy, saat } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi, OnemliOlay } from '../../olay/veri'

/**
 * Önemli olaylar ajandası (arka ucun otomatik bulduğu olaylar): solda büyük gün, yanında o günün
 * olayları ince çizgilerle ayrılmış düz satırlar olarak (ad ve saat); renk yok, yazılar beyaz.
 * Tıklanınca olay seçilir (zaman o ana atlar, kamera yerine uçar); seçili olana basmak seçimi
 * kaldırır. Seçili olayın, yoksa imleçten önceki son olayın adı soldan sağa çizilen bir
 * fosforlu kalem vurgusuyla işaretlenir.
 */
export function OnemliOlaylar({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const seciliOlay = useOlay((d) => d.seciliOlay)
  const olayaGit = useOlay((d) => d.olayaGit)
  const secili = seciliOlay ?? veri.olaylar.findLast((o) => o.zaman <= zaman)
  const liste = useRef<HTMLDivElement>(null)

  // İstanbul saatine göre günlere ayır (olaylar zaten zaman sırasında).
  const gunler = useMemo(() => {
    const gruplar: { anahtar: string; olaylar: OnemliOlay[] }[] = []
    for (const o of veri.olaylar) {
      const anahtar = gunAy(o.zaman)
      if (gruplar.at(-1)?.anahtar !== anahtar) gruplar.push({ anahtar, olaylar: [] })
      gruplar.at(-1)!.olaylar.push(o)
    }
    return gruplar
  }, [veri])

  // Oynatılırken vurgulanan olay görünür kalsın.
  useEffect(() => {
    liste.current?.querySelector('[data-secili="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [secili])

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-cizgi">
      <h2 className="shrink-0 px-5 pt-4 pb-1 text-[13.5px] leading-[18px] font-semibold">{t('olaylar.baslik')}</h2>
      <div ref={liste} className="flex-1 overflow-y-auto px-5 pb-3">
        {gunler.map((g) => {
          const ilk = g.olaylar[0].zaman
          return (
            <div key={g.anahtar} className="grid grid-cols-[40px_1fr] gap-3 border-t border-cizgi py-2.5 first:border-t-0">
              <div className="pt-0.5 text-center">
                <div className="text-[24px] leading-[26px] font-semibold tabular-nums">{gun(ilk)}</div>
                <div className="text-[11px] leading-[14px] text-silik">{ay(ilk)}</div>
              </div>
              <ul className="flex flex-col">
                {g.olaylar.map((o) => {
                  const seciliMi = o === secili
                  return (
                    <li key={`${o.tur}-${o.zaman}`} className="border-t border-white/[0.06] first:border-t-0">
                      <button
                        type="button"
                        data-secili={seciliMi}
                        aria-pressed={o === seciliOlay}
                        onClick={() => olayaGit(o)}
                        title={t('olaylar.git')}
                        className="flex w-full items-center gap-2 px-0.5 py-[7px] text-left"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-white">
                          {/* Fosforlu kalem: zemin şeridinin genişliği 0'dan %100'e geçer (soldan sağa) */}
                          <span
                            className={`-mx-1 rounded-[3px] bg-[linear-gradient(rgba(255,255,255,0.24),rgba(255,255,255,0.24))] bg-left bg-no-repeat px-1 py-px transition-[background-size] duration-500 ease-out ${
                              seciliMi ? 'bg-[length:100%_100%] font-semibold' : 'bg-[length:0%_100%]'
                            }`}
                          >
                            {t(`olaylar.turler.${o.tur}`)}
                          </span>
                        </span>
                        <span className={`shrink-0 text-[11.5px] leading-4 tabular-nums ${seciliMi ? 'font-semibold text-white' : 'text-white/75'}`}>
                          {saat(o.zaman)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
