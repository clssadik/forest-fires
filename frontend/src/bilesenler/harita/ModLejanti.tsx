import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gercekAlanaUlasti } from '../../olay/api'
import { useKatmanlar, type GorunumModu } from '../../durum/katmanlar'
import type { OlayVerisi } from '../../olay/veri'
import { HATA_RENKLERI, ORTU_RENKLERI, RAMPALAR } from '../../sahne/tematikRenkler'

function Siniflar({ siniflar }: { siniflar: { etiket: string; renk: string }[] }) {
  return (
    <ul>
      {siniflar.map((s) => (
        <li key={s.etiket} className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-[3px] ring-1 ring-white/20" style={{ background: s.renk }} />
          {s.etiket}
        </li>
      ))}
    </ul>
  )
}

function Rampa({ renkler, etiketler }: { renkler: string[]; etiketler: string[] }) {
  return (
    <div className="w-[216px]">
      <div aria-hidden className="h-2 rounded-[3px] ring-1 ring-white/20" style={{ background: `linear-gradient(90deg, ${renkler.join(', ')})` }} />
      <div className="mt-1 flex justify-between gap-2 text-[11.5px] leading-4 text-white/85">
        {etiketler.map((e) => (
          <span key={e} className="whitespace-nowrap">{e}</span>
        ))}
      </div>
    </div>
  )
}

/** Tematik modların renk anahtarı; çekmece kapalıyken de haritada durur. */
export function ModLejanti({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const mod = useKatmanlar((d) => d.mod)
  if (mod === 'yayilim') return null

  const m = veri.bilgi.model
  const hataAni = (model: typeof m) =>
    gercekAlanaUlasti(model.esit_alan) ? saat(model.esit_alan_esik_dk / 60) : t('sagPanel.analiz.anBitis')
  const metin = (anahtar: string) => t(`katmanlar.lejant.${mod}.${anahtar}`)
  const saat = (s: number) => t('katmanlar.lejant.saat', { saat: Math.round(s) })
  const icerik: Record<Exclude<GorunumModu, 'yayilim'>, () => ReactNode> = {
    // Renk karekökle dağıldığı için ortadaki renk en geç varışın dörtte birine düşer.
    varis: () => (
      <Rampa renkler={RAMPALAR.varis} etiketler={[metin('bas'), saat(veri.enGecVarisSaat / 4), saat(veri.enGecVarisSaat)]} />
    ),
    guven: () => <Rampa renkler={RAMPALAR.guven} etiketler={['%5', '%50', '%100']} />,
    hata: () => (
      <Siniflar
        siniflar={[
          { etiket: metin('dogru'), renk: HATA_RENKLERI.dogru },
          { etiket: metin('fazla'), renk: HATA_RENKLERI.fazla },
          { etiket: metin('kacirilan'), renk: HATA_RENKLERI.kacirilan },
        ]}
      />
    ),
    zamanFarki: () => <Rampa renkler={RAMPALAR.zamanFarki} etiketler={[metin('erken'), metin('tam'), metin('gec')]} />,
    siddet: () => <Rampa renkler={RAMPALAR.siddet} etiketler={[metin('dusuk'), metin('orta'), metin('yuksek')]} />,
    ortu: () => (
      <Siniflar siniflar={Object.entries(ORTU_RENKLERI).map(([ad, renk]) => ({ etiket: metin(ad), renk }))} />
    ),
  }

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-[8px] bg-black/70 px-3 py-2 text-[12.5px] leading-[18px] text-white ring-1 ring-white/10">
      <div className="mb-1 font-semibold">{t(`katmanlar.lejant.${mod}.baslik`, { sayi: m.calisma_sayisi, an: hataAni(m) })}</div>
      {icerik[mod]()}
    </div>
  )
}
