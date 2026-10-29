import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi, yuzdeBicim } from '../../bicim'
import { useHarita } from '../../durum/harita'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'
import { CizgiGrafigi } from '../altSerit/CizgiGrafigi'
import { TEMALAR } from '../altSerit/grafikTemalari'
import { OnemliOlaylar, OlayAyrintisi } from '../altSerit/OnemliOlaylar'
import { OlayIkonu } from '../OlayIkonu'

const SAAT = 3_600_000
const DAKIKA = 60_000

/**
 * Olay ekranının sağ sütunu: imlecin durduğu an. Son olay, modelin ve FIRMS'in o ana kadarki alanı,
 * bitişteki doğruluk, yükseklik profili ve önemli olaylar listesi. Hava ve cephe hızı alttaki
 * şeritlerde.
 */
export function AnSutunu({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  // Sayılar dakikada bir yeniden çizilir; her karede değil.
  const an = useZaman((d) => Math.floor(d.t / DAKIKA) * DAKIKA)
  const zamanaGit = useZaman((d) => d.zamanaGit)
  const odaklanIste = useHarita((d) => d.odaklanIste)

  const basladi = an >= veri.tutusmaMs
  const saatSonra = Math.max(Math.round((an - veri.tutusmaMs) / SAAT), 0)
  const sonOlay = veri.olaylar.findLast((o) => o.zaman <= an)
  const m = veri.bilgi.model
  const daireyiGeciyor = m.daire_dice !== null && m.bitis_dice !== null && m.bitis_dice > m.daire_dice
  const tire = t('hava.baslamadi')

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-cizgi bg-panel">
      <div className="shrink-0 px-[18px] pt-3.5 pb-3">
        <div className="flex justify-between text-[12px] text-soluk">
          <span>{t('olayDuzeni.seciliAn')}</span>
          <span>{t('olayDuzeni.saatEtiketi', { saat: saatSonra })}</span>
        </div>
        <div className="mt-0.5 text-[22px] leading-[28px] font-semibold tracking-[-0.3px]">{gunAySaat(an)}</div>

        {sonOlay ? (
          <button
            type="button"
            onClick={() => {
              zamanaGit(sonOlay.zaman)
              if (sonOlay.x !== undefined && sonOlay.z !== undefined) odaklanIste(sonOlay.x, sonOlay.z)
            }}
            title={t('olaylar.git')}
            className="mt-3 flex w-full gap-2.5 rounded-[8px] bg-ates/10 px-3 py-2 text-left text-[12.5px] leading-[16px] shadow-[inset_2px_0_0_var(--color-ates)] hover:bg-ates/15"
          >
            <span className="mt-[1px] grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-yuzey">
              <OlayIkonu tur={sonOlay.tur} boyut={13} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] text-soluk">
                {t('olayDuzeni.sonOlay')} ·{' '}
                {t('olaylar.saat', {
                  saat: sayi((sonOlay.zaman - veri.tutusmaMs) / SAAT, 1),
                })}{' '}
                · {gunAySaat(sonOlay.zaman)}
              </span>
              <span className="block font-semibold">{t(`olaylar.turler.${sonOlay.tur}`)}</span>
              <OlayAyrintisi olay={sonOlay} />
            </span>
          </button>
        ) : (
          <p className="mt-3 text-[12px] text-soluk">{t('olayDuzeni.olayYok')}</p>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Sayi etiket={t('olayDuzeni.modelAlani')} renk="bg-ates-acik">
            {basladi ? sayi(veri.yananAlanHa(an)) : tire}
            <Birim>ha</Birim>
          </Sayi>
          <Sayi etiket={t('olayDuzeni.firmsGordugu')} renk="bg-sari">
            {basladi ? sayi(veri.firmsAlanHa(an)) : tire}
            <Birim>ha</Birim>
          </Sayi>
        </div>

        <div className="mt-3 border-t border-cizgi pt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-soluk">{t('olayDuzeni.uyum')}</span>
            <span className="text-[22px] leading-[26px] font-semibold">{m.bitis_dice === null ? '—' : yuzdeBicim(m.bitis_dice)}</span>
          </div>
          {m.daire_dice !== null && m.bitis_dice !== null && (
            <div className={`text-right text-[12px] ${daireyiGeciyor ? 'text-yesil' : 'text-ates-acik'}`}>
              {t(daireyiGeciyor ? 'olayDuzeni.daireGeciyor' : 'olayDuzeni.daireGecemiyor', { deger: yuzdeBicim(m.daire_dice) })}
            </div>
          )}
        </div>
      </div>

      <Profil veri={veri} />
      <OnemliOlaylar veri={veri} />
    </aside>
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
  return (
    <div className="flex h-[118px] shrink-0 flex-col border-t border-cizgi pt-1.5 [&>div]:px-[14px]">
      <CizgiGrafigi
        baslik={
          <>
            {t('olayDuzeni.profil')} <span className="text-soluk">· {t('olayDuzeni.profilAlt', { km: sayi(km, 1) })}</span>
          </>
        }
        veri={noktalar}
        xAlan={[0, km]}
        yAlan={[alt, ust]}
        xTikler={Array.from({ length: Math.floor(km / adim) + 1 }, (_, i) => ({
          x: i * adim,
          etiket: String(i * adim),
        }))}
        yTikler={[alt, ust].map((y) => ({ y, etiket: sayi(y) }))}
        imlec={veri.eksendeCepheKm(zaman)}
        tema={TEMALAR.profil}
        kirmiziNokta
        seceneksiz
      />
    </div>
  )
}

function Sayi({ etiket, renk, children }: { etiket: string; renk: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] text-soluk">
        <span className={`size-2 rounded-[2px] ${renk}`} />
        {etiket}
      </div>
      <div className="text-[21px] leading-[27px] font-semibold tracking-[-0.3px] whitespace-nowrap">{children}</div>
    </div>
  )
}

const Birim = ({ children }: { children: ReactNode }) => <span className="ml-1 text-[12px] font-medium text-soluk">{children}</span>
