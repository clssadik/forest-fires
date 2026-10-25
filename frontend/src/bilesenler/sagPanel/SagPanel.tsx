import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HavaPaneli } from './HavaPaneli'
import { KatmanListesi } from './KatmanListesi'
import { OlayOzeti } from './OlayOzeti'

const SEKMELER = ['katmanlar', 'analiz', 'kanitlar', 'notlar'] as const
type Sekme = (typeof SEKMELER)[number]

/** Sağ panel (Olay kipi): sekmeli katman kartı + olay özeti + hava kartı. */
export function SagPanel() {
  const { t } = useTranslation()
  const [sekme, setSekme] = useState<Sekme>('katmanlar')

  return (
    <aside className="flex w-[312px] shrink-0 flex-col gap-[7px] overflow-y-auto border-l border-cizgi bg-zemin p-[7px]">
      <section className="overflow-hidden rounded-[5px] bg-panel shadow-[0_0_0_1px_rgba(120,110,90,0.12)]">
        <div role="tablist" className="flex bg-panel-baslik px-1 pt-1">
          {SEKMELER.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sekme === s}
              onClick={() => setSekme(s)}
              className={`relative h-[33px] flex-1 rounded-t-[4px] text-[13.5px] ${
                sekme === s ? 'bg-panel font-semibold' : 'text-[#4d483f] hover:text-metin'
              }`}
            >
              {t(`sagPanel.sekmeler.${s}`)}
              {sekme === s && <span className="absolute inset-x-3 bottom-1 h-[2px] rounded bg-metin/80" />}
            </button>
          ))}
        </div>
        {sekme === 'katmanlar' ? (
          <KatmanListesi />
        ) : (
          <p className="px-4 py-6 text-center text-[12.5px] text-soluk">{t('sagPanel.yakinda')}</p>
        )}
      </section>
      <OlayOzeti />
      <HavaPaneli />
    </aside>
  )
}
