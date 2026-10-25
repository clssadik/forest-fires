import type { OlayTuru } from '../veri/ornekSenaryo'
import { IkonAlev, IkonDaire, IkonKare, IkonKumSaati, IkonUcgen } from './ikonlar'

/** Önemli olay türlerinin simgeleri (liste ve zaman çubuğunda ortak). */
export function OlayIkonu({ tur, boyut = 15 }: { tur: OlayTuru; boyut?: number }) {
  switch (tur) {
    case 'tutusma':
      return <IkonDaire boyut={boyut} className="text-ates" />
    case 'hizliBuyume':
      return <IkonAlev boyut={boyut} className="text-[#e5532c]" />
    case 'sicramaAtesi':
      return <IkonUcgen boyut={boyut} className="text-[#c9873f]" />
    case 'sirtGecisi':
      return <IkonKumSaati boyut={boyut - 2} className="text-[#7b766c]" />
    case 'kontrolAltinda':
      return <IkonKare boyut={boyut - 1} className="text-[#7d9cc4]" />
  }
}
