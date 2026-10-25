import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { yuzdeBicim } from '../../bicim'
import { useKatmanlar, type Katman } from '../../durum/katmanlar'
import { IkonTik } from '../ikonlar'
import { KatmanOnizleme } from './KatmanOnizleme'

/** Katmanlar sekmesi: onay kutusu, önizleme, ad, saydamlık kaydırıcısı (docs/02 §5.2). */
export function KatmanListesi() {
  const katmanlar = useKatmanlar((d) => d.katmanlar)
  return (
    <ul className="px-[9px] py-1.5">
      {katmanlar.map((k) => (
        <KatmanSatiri key={k.kimlik} katman={k} />
      ))}
    </ul>
  )
}

function KatmanSatiri({ katman }: { katman: Katman }) {
  const { t } = useTranslation()
  const degistir = useKatmanlar((d) => d.degistir)
  const opaklikAyarla = useKatmanlar((d) => d.opaklikAyarla)
  const ad = t(`katmanlar.${katman.kimlik}`)
  const soluk = !katman.acik

  return (
    <li className="flex h-[35px] items-center gap-2.5">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <input type="checkbox" className="peer sr-only" checked={katman.acik} onChange={() => degistir(katman.kimlik)} />
        <span
          className={`grid size-[15px] shrink-0 place-items-center rounded-[3px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ates/50 ${
            katman.acik ? 'border-[#55514a] bg-[#55514a] text-white' : 'border-[#b5ae9e] bg-[#e6e2d7]'
          }`}
        >
          {katman.acik && <IkonTik boyut={11} strokeWidth={3} />}
        </span>
        <KatmanOnizleme kimlik={katman.kimlik} soluk={soluk} />
        <span className={`truncate text-[13px] ${soluk ? 'text-silik' : ''}`}>{ad}</span>
      </label>
      {katman.opaklik !== null && (
        <>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(katman.opaklik * 100)}
            onChange={(e) => opaklikAyarla(katman.kimlik, Number(e.target.value) / 100)}
            aria-label={t('katmanlar.opaklik', { ad })}
            className={`kaydirici w-[42px] shrink-0 ${soluk ? 'opacity-45' : ''}`}
            style={{ '--dolu': `${katman.opaklik * 100}%` } as CSSProperties}
          />
          <span className={`w-[34px] shrink-0 text-right text-[12.5px] ${soluk ? 'text-silik' : ''}`}>
            {yuzdeBicim(katman.opaklik)}
          </span>
        </>
      )}
    </li>
  )
}
