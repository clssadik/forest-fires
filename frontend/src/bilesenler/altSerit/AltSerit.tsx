import { useOlay } from '../../durum/olay'
import { Grafikler } from './Grafikler'
import { OnemliOlaylar } from './OnemliOlaylar'
import { ZamanCubugu } from './ZamanCubugu'

/** Alt şerit: zaman çubuğu + üç grafik (solda), önemli olaylar çizelgesi (sağda). */
export function AltSerit() {
  const veri = useOlay((d) => d.veri)
  return (
    <div className="flex h-[228px] shrink-0 border-t border-cizgi bg-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <ZamanCubugu yogunluk={veri?.hizMDk ?? (() => 0)} olaylar={veri?.olaylar ?? []} />
        {veri && <Grafikler veri={veri} />}
      </div>
      {veri && <OnemliOlaylar veri={veri} />}
    </div>
  )
}
