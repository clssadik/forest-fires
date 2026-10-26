import type { OlayTuru } from '../olay/api'
import { IkonAlev, IkonDaire, IkonHedef, IkonUcgen } from './ikonlar'

/** Önemli olay türlerinin simgeleri (liste ve zaman çubuğunda ortak). */
export function OlayIkonu({ tur, boyut = 15 }: { tur: OlayTuru; boyut?: number }) {
  switch (tur) {
    case 'tutusma':
      return <IkonDaire boyut={boyut} className="text-ates" />
    case 'uyduGecisi':
      return <IkonHedef boyut={boyut - 1} className="text-[#5b7fa8]" />
    case 'hizliBuyume':
      return <IkonAlev boyut={boyut} className="text-[#e5532c]" />
    case 'sirtaUlasma':
      return <IkonUcgen boyut={boyut} className="text-[#7b766c]" />
  }
}
