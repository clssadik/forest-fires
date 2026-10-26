import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useHarita } from '../../durum/harita'
import { Sahne } from '../../sahne/Sahne'
import { HaritaKontrolleri } from './HaritaKontrolleri'
import { Pusula } from './Pusula'

/** Harita alanı: 3B/2B sahne ve üstündeki kontroller (docs/02 §4). */
export function Harita() {
  const { t } = useTranslation()
  const kip = useHarita((d) => d.kip)
  const ref = useRef<HTMLDivElement>(null)
  const tamEkran = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen()
  }
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-[#d6d1c3] [&_canvas]:cursor-grab [&_canvas:active]:cursor-grabbing">
      <Sahne />
      <Pusula />
      <HaritaKontrolleri tamEkran={tamEkran} />
      <p className="pointer-events-none absolute bottom-4 left-4 rounded-[4px] bg-[#2a2723]/65 px-2 py-1 text-[11.5px] text-white/90 backdrop-blur-sm">
        {t(kip === '3B' ? 'harita.ipucu3B' : 'harita.ipucu2B')}
      </p>
    </div>
  )
}
