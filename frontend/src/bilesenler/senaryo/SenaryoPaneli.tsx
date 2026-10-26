import { useTranslation } from 'react-i18next'
import { gunAySaat, sayi } from '../../bicim'
import { tutusmaMs, useSenaryo } from '../../durum/senaryo'
import { useZaman } from '../../durum/zaman'
import { BANTLAR, BANT_RENKLERI } from '../../senaryo/boyama'
import { Kart } from '../sagPanel/Kart'

/** Harita hücresi yerde ~30 m × 30 m. */
const HUCRE_HA = 0.09
const SAAT = 3_600_000
const YONLER = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB']
/** Rüzgârın geldiği yön (derece) → "KD" gibi kısa ad. */
const yonAdi = (derece: number) => YONLER[Math.round(derece / 45) % 8]
const ha = (x: number) => `${sayi(x)} ha`

/** Senaryo ekranının sağ paneli. */
export function SenaryoPaneli() {
  const ozet = useSenaryo((d) => d.ozet)
  return (
    <aside className="flex w-[328px] shrink-0 flex-col gap-[7px] overflow-y-auto border-l border-cizgi bg-zemin p-[7px] [&>*]:shrink-0">
      <YerKarti />
      {ozet && <AlanKarti />}
      {ozet && <HavaKarti />}
      <GuvenKarti />
    </aside>
  )
}

function YerKarti() {
  const { t } = useTranslation()
  const nokta = useSenaryo((d) => d.nokta)
  const durum = useSenaryo((d) => d.durum)
  const hata = useSenaryo((d) => d.hata)
  const ozet = useSenaryo((d) => d.ozet)
  const altlik = useSenaryo((d) => d.altlik)
  const yakit = ozet ? t(`senaryo.yakitlar.${ozet.tutusma_yakiti}`) : null

  return (
    <Kart baslik={t('senaryo.yer.baslik')}>
      <div className="flex flex-col gap-2 px-3 py-2.5 text-[12.5px]">
        {!nokta && <p className="leading-[17px] text-soluk">{t('senaryo.yer.ipucu')}</p>}
        {nokta && (
          <div>
            <div className="font-medium tabular-nums">
              {sayi(nokta.enlem, 2)}° K, {sayi(nokta.boylam, 2)}° D
            </div>
            {ozet && durum === 'hazir' && (
              <div className="text-soluk">
                {t('senaryo.yer.tutusma', { zaman: gunAySaat(tutusmaMs(ozet)), yakit })}
              </div>
            )}
          </div>
        )}
        {durum === 'calisiyor' && (
          <p className="flex items-center gap-2 text-soluk">
            <span className="size-3.5 animate-spin rounded-full border-2 border-koyu/25 border-t-koyu" />
            {t('senaryo.yer.calisiyor')}
          </p>
        )}
        {durum === 'hata' && hata && <p className="text-[12px] leading-[16px] text-ates">{t(`senaryo.hatalar.${hata.tur}`)}</p>}
        {ozet && durum === 'hazir' && (
          <p className="text-[11.5px] text-soluk">
            {t('senaryo.yer.sure', { veri: sayi(ozet.sureler.veri_sn, 1), model: sayi(ozet.sureler.model_sn, 1) })}
          </p>
        )}
        {ozet && (
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={altlik}
              onChange={() => useSenaryo.getState().altlikAcKapa()}
              className="size-[14px] accent-[#3d3a33]"
            />
            {t('senaryo.yer.altlik')}
          </label>
        )}
      </div>
    </Kart>
  )
}

function AlanKarti() {
  const { t } = useTranslation()
  const ozet = useSenaryo((d) => d.ozet)!
  const anlik = useSenaryo((d) => d.anlik)
  const zaman = useZaman((d) => d.t)
  const gecen = (zaman - tutusmaMs(ozet)) / SAAT
  const son = (k: number) => ozet.buyume_ha[k].at(-1) ?? 0

  return (
    <Kart baslik={t('senaryo.alan.baslik')} ek={`${gunAySaat(zaman)} · +${sayi(gecen, 0)} ${t('dogrulama.birim.sa')}`}>
      <ul className="flex flex-col gap-1 px-3 pt-2.5 pb-1.5 text-[12.5px]">
        {[...BANTLAR].reverse().map((b) => {
          const k = BANTLAR.indexOf(b)
          return (
            <li key={b} className="flex items-center gap-2">
              <span className="size-[11px] shrink-0 rounded-[2px]" style={{ background: BANT_RENKLERI[b] }} />
              <span className="text-soluk">{t(`senaryo.bantlar.${b}`)}</span>
              <span className="ml-auto font-medium tabular-nums">{anlik ? ha(anlik[k] * HUCRE_HA) : '—'}</span>
            </li>
          )
        })}
      </ul>
      <p className="px-3 pb-2.5 text-[11.5px] leading-[15px] text-soluk">
        {t('senaryo.alan.menzil', { alt: ha(son(2)), ust: ha(son(0)), saat: ozet.saatler.at(-1) })}
        {ozet.kenar_saat !== null && (
          <span className="mt-1 block text-ates">{t('senaryo.alan.kenar', { saat: sayi(ozet.kenar_saat, 0) })}</span>
        )}
      </p>
    </Kart>
  )
}

function HavaKarti() {
  const { t } = useTranslation()
  const ozet = useSenaryo((d) => d.ozet)!
  const zaman = useZaman((d) => d.t)
  const h = ozet.hava
  const i = Math.min(Math.max(Math.round((zaman - tutusmaMs(ozet)) / SAAT), 0), h.saatler.length - 1)
  const satirlar = [0, 12, 24, 36, 48].filter((s) => s < h.saatler.length)

  return (
    <Kart baslik={t('senaryo.hava.baslik')} ek={t('senaryo.hava.kaynak')}>
      <dl className="grid grid-cols-3 gap-1 px-3 pt-2.5 pb-2 text-[12.5px]">
        <Sayi etiket={t('senaryo.hava.ruzgar')} deger={`${yonAdi(h.ruzgar_yonu[i])} ${sayi(h.ruzgar_hizi_ms[i], 1)} m/s`} />
        <Sayi etiket={t('senaryo.hava.nem')} deger={`%${sayi(h.bagil_nem[i])}`} />
        <Sayi etiket={t('senaryo.hava.sicaklik')} deger={`${sayi(h.sicaklik_c[i], 1)} °C`} />
      </dl>
      <table className="mx-3 mb-2.5 w-[calc(100%-24px)] text-[11.5px] tabular-nums">
        <tbody>
          {satirlar.map((s) => (
            <tr key={s} className={s === Math.round(i / 12) * 12 ? 'font-medium' : 'text-soluk'}>
              <td className="py-[1px]">+{s} {t('dogrulama.birim.sa')}</td>
              <td>
                <span className="inline-block" style={{ transform: `rotate(${h.ruzgar_yonu[s] + 180}deg)` }}>
                  ↑
                </span>{' '}
                {yonAdi(h.ruzgar_yonu[s])} {sayi(h.ruzgar_hizi_ms[s], 1)} m/s
              </td>
              <td>%{sayi(h.bagil_nem[s])}</td>
              <td className="text-right">{sayi(h.sicaklik_c[s], 0)} °C</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Kart>
  )
}

function GuvenKarti() {
  const { t } = useTranslation()
  return (
    <Kart baslik={t('senaryo.guven.baslik')}>
      <div className="flex flex-col gap-1.5 px-3 py-2.5 text-[12px] leading-[16px]">
        <p>{t('senaryo.guven.olcum')}</p>
        <ul className="list-disc pl-4 text-soluk">
          <li>{t('senaryo.guven.sondurme')}</li>
          <li>{t('senaryo.guven.bantlar')}</li>
          <li>{t('senaryo.guven.yon')}</li>
          <li>{t('senaryo.guven.hava')}</li>
        </ul>
      </div>
    </Kart>
  )
}

function Sayi({ etiket, deger }: { etiket: string; deger: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-soluk">{etiket}</dt>
      <dd className="font-medium tabular-nums">{deger}</dd>
    </div>
  )
}
