import { useTranslation } from 'react-i18next'
import { useKatmanlar, type Katman } from '../../durum/katmanlar'
import { IkonTik } from '../ikonlar'
import { KatmanOnizleme } from './KatmanOnizleme'

/** Katmanlar sekmesi: onay kutusu, önizleme, ad (docs/02 §5.2). */
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
  const ad = t(`katmanlar.${katman.kimlik}`)
  const soluk = !katman.acik

  return (
    <li className="flex h-[35px] items-center">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
        <input type="checkbox" className="peer sr-only" checked={katman.acik} onChange={() => degistir(katman.kimlik)} />
        <span
          className={`grid size-[15px] shrink-0 place-items-center rounded-[3px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ates/50 ${
            katman.acik ? 'border-guclu bg-guclu text-zemin' : 'border-eksen bg-transparent'
          }`}
        >
          {katman.acik && <IkonTik boyut={11} strokeWidth={3} />}
        </span>
        <KatmanOnizleme kimlik={katman.kimlik} soluk={soluk} />
        <span className={`truncate text-[13px] ${soluk ? 'text-silik' : ''}`}>{ad}</span>
      </label>
    </li>
  )
}
