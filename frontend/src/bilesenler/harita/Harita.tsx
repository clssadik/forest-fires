import { useRef } from 'react'
import { Sahne } from '../../sahne/Sahne'
import { HaritaKontrolleri } from './HaritaKontrolleri'
import { Pusula } from './Pusula'

/** Harita alanı: 3B/2B sahne ve üstündeki kontroller (docs/02 §4). */
export function Harita() {
  const ref = useRef<HTMLDivElement>(null)
  const tamEkran = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void ref.current?.requestFullscreen()
  }
  return (
    <div ref={ref} className="relative min-h-0 flex-1 overflow-hidden bg-[#d6d1c3]">
      <Sahne />
      <Pusula />
      <HaritaKontrolleri tamEkran={tamEkran} />
    </div>
  )
}
