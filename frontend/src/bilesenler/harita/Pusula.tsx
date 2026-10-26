import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useHarita } from '../../durum/harita'
import { IkonDik, IkonDonSag, IkonDonSol, IkonEg } from '../ikonlar'

const DONUS_ADIMI = 45
const EGIM_ADIMI = 12

/** Sol üstte kamerayla dönen pusula (tıklayınca kuzey yukarı) ve 3B'de döndür / eğ düğmeleri. */
export function Pusula() {
  const { t } = useTranslation()
  const yon = useHarita((d) => d.yon)
  const kip = useHarita((d) => d.kip)
  const { kuzeyeDon, donmeIste } = useHarita.getState()
  return (
    <div className="absolute top-3 left-4 flex flex-col items-center gap-2 select-none">
      <button
        type="button"
        onClick={kuzeyeDon}
        title={t('harita.kuzeyeDon')}
        aria-label={t('harita.kuzeyeDon')}
        className="relative size-[44px]"
        style={{ transform: `rotate(${-yon}deg)` }}
      >
        <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
          {t('harita.kuzey')}
        </span>
        <svg viewBox="0 0 44 44" className="size-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <circle cx="22" cy="22" r="20.5" fill="#3a3f47" fillOpacity="0.82" stroke="#f3f1ea" strokeWidth="1.6" />
          <path d="M22 7 30 31 22 26 14 31z" fill="#ffffff" />
          <path d="M22 7 22 26 14 31z" fill="#d9dde3" />
        </svg>
      </button>
      {kip === '3B' && (
        <div className="grid grid-cols-2 overflow-hidden rounded-[5px] bg-[#2a2723]/80 text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <Dugme etiket={t('harita.solaDon')} onClick={() => donmeIste(-DONUS_ADIMI, 0)}>
            <IkonDonSol boyut={15} />
          </Dugme>
          <Dugme etiket={t('harita.sagaDon')} onClick={() => donmeIste(DONUS_ADIMI, 0)}>
            <IkonDonSag boyut={15} />
          </Dugme>
          <Dugme etiket={t('harita.eg')} onClick={() => donmeIste(0, EGIM_ADIMI)}>
            <IkonEg boyut={15} />
          </Dugme>
          <Dugme etiket={t('harita.dik')} onClick={() => donmeIste(0, -EGIM_ADIMI)}>
            <IkonDik boyut={15} />
          </Dugme>
        </div>
      )}
    </div>
  )
}

function Dugme({ etiket, onClick, children }: { etiket: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={etiket} aria-label={etiket} onClick={onClick} className="grid size-[26px] place-items-center hover:bg-white/15">
      {children}
    </button>
  )
}
