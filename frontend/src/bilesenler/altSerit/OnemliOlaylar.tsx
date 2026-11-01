import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, gunAyUzun, saat } from '../../bicim'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi, OnemliOlay } from '../../olay/veri'

/**
 * Önemli olaylar (arka ucun otomatik bulduğu olaylar), ince bir dikey ray üstünde: her gün büyük bir
 * tarih başlığıyla açılır, her olay raya küçük bir çentikle bağlanır. Olay adı ne olduğunu sayısız,
 * sade bir cümleyle anlatır ("Uydu yangını tespit etti"). Tıklanınca olay seçilir (zaman o
 * ana atlar, kamera yerine uçar); seçili olana basmak seçimi kaldırır. Seçili olayın, yoksa imleçten
 * önceki son olayın yazısı soldan sağa turuncuya boyanır (zemin yok).
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

  // Oynatılırken vurgulanan olay listenin ortasında kalsın (yalnızca liste kayar, sayfa değil).
  useEffect(() => {
    const kutu = liste.current
    const satir = kutu?.querySelector<HTMLElement>('[data-secili="true"]')
    if (!kutu || !satir) return
    const k = kutu.getBoundingClientRect()
    const r = satir.getBoundingClientRect()
    kutu.scrollTo({ top: kutu.scrollTop + r.top - k.top - (k.height - r.height) / 2, behavior: 'smooth' })
  }, [secili])

  return (
    <section className="flex min-h-0 flex-1 flex-col border-t border-cizgi">
      <h2 className="shrink-0 px-5 pt-4 pb-2 text-[13.5px] leading-[18px] font-semibold">{t('olaylar.baslik')}</h2>
      <div ref={liste} className="flex-1 overflow-y-auto px-5 pb-4">
        {/* Ray: sol kenarda ince çizgi; gün ve olay çentikleri ona değer */}
        <div className="ml-1 border-l border-white/20 pl-5">
          {gunler.map((g, gi) => (
            <div key={g.anahtar} className={gi ? 'mt-5' : ''}>
              <h3 className="relative text-[19px] leading-6 font-semibold text-white">
                <span aria-hidden className="absolute top-1/2 -left-5 h-px w-3 bg-white" />
                {gunAyUzun(g.olaylar[0].zaman)}
              </h3>
              <ul className="mt-1.5 flex flex-col">
                {g.olaylar.map((o) => {
                  const seciliMi = o === secili
                  return (
                    <li key={`${o.tur}-${o.zaman}`} className="relative">
                      <span
                        aria-hidden
                        className={`absolute top-1/2 -left-5 h-px w-2 transition-colors ${seciliMi ? 'bg-ates-acik' : 'bg-white/35'}`}
                      />
                      <button
                        type="button"
                        data-secili={seciliMi}
                        aria-pressed={o === seciliOlay}
                        onClick={() => olayaGit(o)}
                        title={t('olaylar.git')}
                        className="flex w-full items-baseline gap-3 py-[7px] text-left"
                      >
                        {/* Yazı rengi silmesi: yarısı turuncu yarısı beyaz, iki kat geniş zemin harflere kırpılır;
                            seçilince zemin sağdan sola kayar, turuncu harflerin üstünden soldan sağa geçer */}
                        <span
                          className={`min-w-0 flex-1 truncate bg-[linear-gradient(to_right,var(--color-ates-acik)_50%,#fff_50%)] bg-[length:200%_100%] bg-clip-text text-[14px] leading-[18px] text-transparent transition-[background-position] duration-500 ease-out ${
                            seciliMi ? 'bg-left font-semibold' : 'bg-right'
                          }`}
                        >
                          {t(`olaylar.cumleler.${o.tur}`)}
                        </span>
                        <span className={`shrink-0 text-[12.5px] leading-4 tabular-nums ${seciliMi ? 'font-semibold text-ates-acik' : 'text-white/80'}`}>
                          {saat(o.zaman)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
