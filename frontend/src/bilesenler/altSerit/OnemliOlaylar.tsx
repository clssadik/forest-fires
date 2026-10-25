import { useTranslation } from 'react-i18next'
import { gunAySaat } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import { onemliOlaylar } from '../../veri/ornekSenaryo'
import { IkonArti } from '../ikonlar'
import { OlayIkonu } from '../OlayIkonu'

/** Önemli Olaylar listesi: gelecek olaylar soluk, tıklanınca zaman o ana atlar. */
export function OnemliOlaylar() {
  const { t } = useTranslation()
  const zaman = useZaman((d) => d.t)
  const zamanaGit = useZaman((d) => d.zamanaGit)
  // Seçili: imleçten önceki en son olay.
  const secili = onemliOlaylar.findLast((o) => o.zaman <= zaman)

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-l border-cizgi bg-olaylar">
      <header className="flex h-[44px] items-center px-3">
        <h2 className="text-[14px] font-semibold">{t('olaylar.baslik')}</h2>
        <button
          type="button"
          className="ml-auto flex items-center gap-1 rounded-[4px] border border-cizgi bg-[#e4e0d5] px-2 py-[3px] text-[12.5px] hover:bg-[#ebe7dc]"
        >
          <IkonArti boyut={12} />
          {t('olaylar.ekle')}
        </button>
      </header>
      <ul className="flex-1 overflow-y-auto pb-1">
        {onemliOlaylar.map((o) => {
          const gelecek = o.zaman > zaman
          const seciliMi = o === secili
          return (
            <li key={o.tur}>
              <button
                type="button"
                onClick={() => zamanaGit(o.zaman)}
                className={`flex h-[34px] w-full items-center gap-2 border-l-[3px] px-2.5 text-left text-[12.5px] ${
                  seciliMi ? 'border-ates bg-[#e6dccb]' : 'border-transparent hover:bg-black/[0.03]'
                } ${gelecek ? 'opacity-50' : ''}`}
              >
                <span className="grid w-4 place-items-center">
                  <OlayIkonu tur={o.tur} />
                </span>
                <span className="flex-1 truncate">{t(`olaylar.turler.${o.tur}`)}</span>
                <span className="shrink-0 text-[12px] text-[#4d483f]">{gunAySaat(o.zaman)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
