import { useTranslation } from 'react-i18next'
import { useHarita } from '../../durum/harita'

/** Sol üstte kamerayla dönen pusula. */
export function Pusula() {
  const { t } = useTranslation()
  const yon = useHarita((d) => d.yon)
  return (
    <div className="absolute top-3 left-4 select-none" title={t('harita.pusula')}>
      <div className="relative size-[44px]" style={{ transform: `rotate(${-yon}deg)` }}>
        <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
          {t('harita.kuzey')}
        </span>
        <svg viewBox="0 0 44 44" className="size-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <circle cx="22" cy="22" r="20.5" fill="#3a3f47" fillOpacity="0.82" stroke="#f3f1ea" strokeWidth="1.6" />
          <path d="M22 7 30 31 22 26 14 31z" fill="#ffffff" />
          <path d="M22 7 22 26 14 31z" fill="#d9dde3" />
        </svg>
      </div>
    </div>
  )
}
