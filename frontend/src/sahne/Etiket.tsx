import { Html } from '@react-three/drei'
import { useEffect, useState, type ComponentProps } from 'react'

/**
 * drei `Html` sarmalayıcısı. React 19 StrictMode'da sahnenin ilk işlemesinde
 * bağlanan Html kökü ertelenmiş bir unmount ile boşaltılabiliyor. Html'i bir
 * kare sonra bağlayarak bu yarıştan kaçınırız.
 */
export function Etiket(ozellik: ComponentProps<typeof Html>) {
  const [hazir, setHazir] = useState(false)
  useEffect(() => {
    const k = requestAnimationFrame(() => setHazir(true))
    return () => cancelAnimationFrame(k)
  }, [])
  return hazir ? <Html {...ozellik} /> : null
}
