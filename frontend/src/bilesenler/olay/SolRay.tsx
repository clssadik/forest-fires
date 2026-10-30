import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CEKMECELER, useOlayDuzeni, type Cekmece } from '../../durum/olayDuzeni'
import type { OlayVerisi } from '../../olay/veri'
import { AnalizSekmesi } from '../sagPanel/AnalizSekmesi'
import { KanitlarSekmesi } from '../sagPanel/KanitlarSekmesi'
import { KatmanListesi } from '../sagPanel/KatmanListesi'
import { NotlarSekmesi } from '../sagPanel/NotlarSekmesi'
import { IkonBelge, IkonGrafik, IkonKapat, IkonKatman, IkonNot } from '../ikonlar'

const IKONLAR: Record<Cekmece, ReactNode> = {
  katmanlar: <IkonKatman boyut={19} />,
  analiz: <IkonGrafik boyut={19} />,
  kanitlar: <IkonBelge boyut={19} />,
  notlar: <IkonNot boyut={18} />,
}

/** Olay ekranının solundaki dar şerit: her düğme kendi çekmecesini açar, açık olana basmak kapatır. */
export function SolRay() {
  const { t } = useTranslation()
  const cekmece = useOlayDuzeni((d) => d.cekmece)
  const cekmeceDegistir = useOlayDuzeni((d) => d.cekmeceDegistir)
  return (
    <nav aria-label={t('olayDuzeni.ray')} className="flex w-[56px] shrink-0 flex-col items-center gap-1.5 border-r border-cizgi bg-panel pt-3">
      {CEKMECELER.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => cekmeceDegistir(c)}
          aria-pressed={cekmece === c}
          title={t(`sagPanel.sekmeler.${c}`)}
          aria-label={t(`sagPanel.sekmeler.${c}`)}
          className={`grid size-[40px] place-items-center rounded-[7px] ${
            cekmece === c ? 'bg-yuzey-acik text-metin' : 'text-soluk hover:bg-white/[0.06] hover:text-metin'
          }`}
        >
          {IKONLAR[c]}
        </button>
      ))}
    </nav>
  )
}

/** Raydaki düğmeyle açılan sabit çekmece; sahneyi daraltır, üstüne binmez. */
export function SolCekmece({ veri }: { veri: OlayVerisi | null }) {
  const { t } = useTranslation()
  const cekmece = useOlayDuzeni((d) => d.cekmece)
  const kapat = useOlayDuzeni((d) => d.cekmeceKapat)
  if (!cekmece) return null
  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-cizgi bg-panel">
      <header className="flex h-[52px] shrink-0 items-center border-b border-cizgi pr-3 pl-5">
        <h2 className="text-[15px] leading-5 font-semibold">{t(`sagPanel.sekmeler.${cekmece}`)}</h2>
        <button
          type="button"
          onClick={kapat}
          title={t('olayDuzeni.kapat')}
          aria-label={t('olayDuzeni.kapat')}
          className="ml-auto grid size-7 place-items-center rounded-[5px] text-soluk hover:bg-white/[0.07] hover:text-metin"
        >
          <IkonKapat boyut={15} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {cekmece === 'katmanlar' && <KatmanListesi />}
        {veri && cekmece === 'analiz' && <AnalizSekmesi veri={veri} />}
        {veri && cekmece === 'kanitlar' && <KanitlarSekmesi veri={veri} />}
        {veri && cekmece === 'notlar' && <NotlarSekmesi ad={veri.bilgi.ad} />}
      </div>
    </aside>
  )
}
