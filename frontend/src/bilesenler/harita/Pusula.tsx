import { useTranslation } from 'react-i18next'
import { useHarita } from '../../durum/harita'

/** Sol üstte kamerayla dönen pusula (tıklayınca kuzey yukarı); döndür / eğ düğmeleri alttaki çubukta. */
export function Pusula() {
  const { t } = useTranslation()
  const yon = useHarita((d) => d.yon)
  const { kuzeyeDon } = useHarita.getState()
  return (
    // Dönen "K" harfi pusula merkezinden ~36 px uzağa kadar uzanır; üst boşluk ona göre, hangi yöne dönerse dönsün kesilmez.
    <button
      type="button"
      onClick={kuzeyeDon}
      title={t('harita.kuzeyeDon')}
      aria-label={t('harita.kuzeyeDon')}
      className="absolute top-5 left-5 z-30 size-[44px] select-none"
      style={{ transform: `rotate(${-yon}deg)` }}
    >
      <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">
        {t('harita.kuzey')}
      </span>
      <svg viewBox="0 0 44 44" className="size-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
        <circle cx="22" cy="22" r="20.5" fill="#0a0a0a" fillOpacity="0.85" stroke="#ededed" strokeWidth="1.6" />
        <path d="M22 7 30 31 22 26 14 31z" fill="#ffffff" />
        <path d="M22 7 22 26 14 31z" fill="#d9dde3" />
      </svg>
    </button>
  )
}
