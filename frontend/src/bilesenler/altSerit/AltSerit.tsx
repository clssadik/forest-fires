import { Grafikler } from './Grafikler'
import { OnemliOlaylar } from './OnemliOlaylar'
import { ZamanCubugu } from './ZamanCubugu'

/** Alt şerit: zaman çubuğu + üç grafik (solda), önemli olaylar (sağda). */
export function AltSerit() {
  return (
    <div className="flex h-[228px] shrink-0 border-t border-cizgi bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <ZamanCubugu />
        <Grafikler />
      </div>
      <OnemliOlaylar />
    </div>
  )
}
