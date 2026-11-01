import { useTranslation } from 'react-i18next'
import { useHarita } from '../../durum/harita'

/**
 * Sol üstte kamerayla dönen pusula (tıklayınca kuzey yukarı): çerçevesiz, ince bir kuzey oku ve üstünde
 * "K"; aydınlık zeminde de seçilsin diye hafif gölgeli. Döndür / eğ düğmeleri alttaki çubukta.
 */
export function Pusula() {
  const { t } = useTranslation()
  const yon = useHarita((d) => d.yon)
  const { kuzeyeDon } = useHarita.getState()
  return (
    <button
      type="button"
      onClick={kuzeyeDon}
      title={t('harita.kuzeyeDon')}
      aria-label={t('harita.kuzeyeDon')}
      className="absolute top-4 left-5 z-30 flex w-[34px] flex-col items-center gap-0.5 text-white select-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:text-white/80"
      style={{ transform: `rotate(${-yon}deg)` }}
    >
      <span className="text-[10.5px] leading-[11px] font-semibold">{t('harita.kuzey')}</span>
      <svg viewBox="0 0 16 22" className="h-[22px] w-4" fill="currentColor" aria-hidden>
        <path d="M8 0 14 22 8 17 2 22z" />
      </svg>
    </button>
  )
}
