import { useEffect } from 'react'
import { useZaman } from '../durum/zaman'

/** Oynatılırken her animasyon karesinde global zamanı ilerletir. */
export function useOynatici() {
  const oynatiliyor = useZaman((d) => d.oynatiliyor)
  useEffect(() => {
    if (!oynatiliyor) return
    let onceki = performance.now()
    let kimlik = requestAnimationFrame(function kare(simdi) {
      useZaman.getState().ilerlet(simdi - onceki)
      onceki = simdi
      kimlik = requestAnimationFrame(kare)
    })
    return () => cancelAnimationFrame(kimlik)
  }, [oynatiliyor])
}
