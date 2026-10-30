import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi, yuzdeBicim } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'
import { CizgiGrafigi } from '../altSerit/CizgiGrafigi'
import { TEMALAR } from '../altSerit/grafikTemalari'
import { OnemliOlaylar } from '../altSerit/OnemliOlaylar'

/**
 * Olay ekranının sağ sütunu: bitişteki doğruluk, yükseklik profili ve önemli olaylar. Seçili an ve
 * o ana kadarki alanlar alttaki zaman panelinde olduğu için burada tekrarlanmaz. Tek boşluk ölçeği:
 * bölümler 20 px yan, 16 px dikey boşlukla.
 */
export function AnSutunu({ veri }: { veri: OlayVerisi }) {
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-cizgi bg-panel [&>*:first-child]:border-t-0">
      <Dogruluk veri={veri} />
      <Profil veri={veri} />
      <OnemliOlaylar veri={veri} />
    </aside>
  )
}

/** Bitişteki doğruluk: model ve aynı alanlı daire yan yana çubuklarla; geçip geçmediği rozette. */
function Dogruluk({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const m = veri.bilgi.model
  if (m.bitis_dice === null) return null
  const daire = m.daire_dice
  const iyi = daire !== null && m.bitis_dice > daire
  return (
    <section className="shrink-0 border-t border-cizgi px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h2 title={t('olayDuzeni.dogrulukAciklama')} className="cursor-help text-[13.5px] leading-[18px] font-semibold">
          {t('olayDuzeni.dogruluk')}
        </h2>
        {daire !== null && (
          <span
            className={`rounded-full px-2.5 py-1 text-[11.5px] leading-4 font-semibold ${
              iyi ? 'bg-yesil/15 text-yesil' : 'bg-ates/15 text-ates-acik'
            }`}
          >
            {t(iyi ? 'olayDuzeni.dahaIyi' : 'olayDuzeni.dahaZayif')}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2.5">
        <Cubuk etiket={t('olayDuzeni.buModel')} oran={m.bitis_dice} renk="bg-ates-acik" guclu />
        {daire !== null && <Cubuk etiket={t('olayDuzeni.daire')} oran={daire} renk="bg-ikincil/50" aciklama={t('olayDuzeni.daireAciklama')} />}
      </div>
    </section>
  )
}

function Cubuk({ etiket, oran, renk, guclu, aciklama }: { etiket: string; oran: number; renk: string; guclu?: boolean; aciklama?: string }) {
  return (
    <div title={aciklama} className="grid grid-cols-[84px_1fr_40px] items-center gap-3">
      <span className={`text-[12.5px] leading-4 ${guclu ? 'font-medium' : 'text-ikincil'}`}>{etiket}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-yuzey-acik">
        <span className={`block h-full rounded-full ${renk}`} style={{ width: `${Math.min(Math.max(oran, 0), 1) * 100}%` }} />
      </span>
      <span className={`text-right text-[13.5px] leading-4 tabular-nums ${guclu ? 'font-semibold' : 'text-ikincil'}`}>{yuzdeBicim(oran)}</span>
    </div>
  )
}

/** Ana yayılım ekseni boyunca yükseklik; imleç cephenin eksende vardığı yer. */
function Profil({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const km = Math.max(veri.bilgi.eksen?.uzunluk_km ?? 1, 1)
  const noktalar = useMemo(() => veri.profil.map((p) => ({ x: p.km, y: p.hM })), [veri])
  const [alt, ust] = useMemo<[number, number]>(() => {
    const ys = noktalar.map((p) => p.y)
    if (!ys.length) return [0, 100]
    const a = Math.floor(Math.min(...ys) / 100) * 100
    return [a, Math.max(Math.ceil(Math.max(...ys) / 100) * 100, a + 100)]
  }, [noktalar])
  if (!noktalar.length) return null
  const adim = km > 30 ? 10 : 5
  const tikSayisi = Math.floor(km / adim) + 1
  return (
    <section className="flex shrink-0 flex-col border-t border-cizgi px-5 pt-4 pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[13.5px] leading-[18px] font-semibold">{t('olayDuzeni.profil')}</h2>
        <span className="text-[12px] leading-4 text-ikincil">{t('olayDuzeni.profilAlt', { km: sayi(km, 1) })}</span>
      </div>
      <div className="mt-2 flex h-[92px]">
        <CizgiGrafigi
          veri={noktalar}
          xAlan={[0, km]}
          yAlan={[alt, ust]}
          xTikler={Array.from({ length: tikSayisi }, (_, i) => ({
            x: i * adim,
            etiket: i === tikSayisi - 1 ? `${i * adim} km` : String(i * adim),
          }))}
          yTikler={[alt, ust].map((y) => ({ y, etiket: `${sayi(y)} m` }))}
          imlec={veri.eksendeCepheKm(zaman)}
          tema={TEMALAR.profil}
          kirmiziNokta
        />
      </div>
    </section>
  )
}
