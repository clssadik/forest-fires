import type { MouseEvent, ReactNode } from 'react'

/**
 * Kenar raylarındaki kare simge düğmesi. Adı üzerine gelince yanda ipucu olarak çıkar (`ipucu`:
 * sol raydan sağa, sağ raydan sola açılır); `onClick` yoksa henüz hazır olmayan öğe gibi pasiftir.
 */
export function RayDugmesi({
  ad,
  ikon,
  secili = false,
  rozet,
  ipucu,
  onClick,
  ...aria
}: {
  ad: string
  ikon: ReactNode
  secili?: boolean
  rozet?: number
  ipucu: 'sag' | 'sol'
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  'aria-haspopup'?: 'listbox' | 'dialog'
  'aria-expanded'?: boolean
}) {
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      aria-pressed={onClick && !aria['aria-haspopup'] ? secili : undefined}
      aria-label={ad}
      {...aria}
      className={`group relative grid size-[40px] shrink-0 place-items-center rounded-[7px] transition-colors duration-200 ${
        secili
          ? 'bg-yuzey-acik text-metin'
          : onClick
            ? 'text-soluk hover:bg-white/[0.06] hover:text-metin'
            : 'text-silik'
      }`}
    >
      {ikon}
      {rozet !== undefined && (
        <span className="absolute top-[3px] right-[3px] grid size-[15px] place-items-center rounded-full bg-guclu text-[9.5px] font-semibold text-zemin">
          {rozet}
        </span>
      )}
      <span
        className={`pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 rounded-[5px] border border-cizgi bg-panel-baslik px-2 py-1 text-[12.5px] whitespace-nowrap text-metin opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.6)] transition-opacity group-hover:opacity-100 ${
          ipucu === 'sag' ? 'left-full ml-2' : 'right-full mr-2'
        }`}
      >
        {ad}
      </span>
    </button>
  )
}
