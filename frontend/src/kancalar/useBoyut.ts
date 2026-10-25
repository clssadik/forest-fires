import { useEffect, useRef, useState } from 'react'

/** Bir öğenin piksel boyutunu izler (SVG grafiklerin gerilmeden çizilmesi için). */
export function useBoyut<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [boyut, setBoyut] = useState({ gen: 0, yuk: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const g = new ResizeObserver(([k]) => {
      const { width, height } = k.contentRect
      setBoyut({ gen: Math.round(width), yuk: Math.round(height) })
    })
    g.observe(el)
    return () => g.disconnect()
  }, [])
  return [ref, boyut] as const
}
