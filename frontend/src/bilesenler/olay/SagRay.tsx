import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CEKMECELER, useOlayDuzeni, type Cekmece } from '../../durum/olayDuzeni'
import type { OlayVerisi } from '../../olay/veri'
import { AnalizSekmesi } from '../sagPanel/AnalizSekmesi'
import { KanitlarSekmesi } from '../sagPanel/KanitlarSekmesi'
import { KatmanListesi } from '../sagPanel/KatmanListesi'
import { NotlarSekmesi } from '../sagPanel/NotlarSekmesi'
import { OzetSekmesi } from '../sagPanel/OzetSekmesi'
import { IkonBelge, IkonBilgi, IkonGrafik, IkonKapat, IkonKatman, IkonNot } from '../ikonlar'
import { RayDugmesi } from '../RayDugmesi'

const IKONLAR: Record<Cekmece, ReactNode> = {
  ozet: <IkonBilgi boyut={19} />,
  katmanlar: <IkonKatman boyut={19} />,
  analiz: <IkonGrafik boyut={19} />,
  kanitlar: <IkonBelge boyut={19} />,
  notlar: <IkonNot boyut={18} />,
}

/** Olay ekranının sağındaki dar şerit: her düğme kendi çekmecesini açar, açık olana basmak kapatır. */
export function SagRay() {
  const { t } = useTranslation()
  const cekmece = useOlayDuzeni((d) => d.cekmece)
  const cekmeceDegistir = useOlayDuzeni((d) => d.cekmeceDegistir)
  return (
    <nav aria-label={t('olayDuzeni.ray')} className="flex w-[56px] shrink-0 flex-col items-center gap-1.5 border-l border-cizgi bg-panel pt-3">
      {CEKMECELER.map((c) => (
        <RayDugmesi
          key={c}
          ad={t(`sagPanel.sekmeler.${c}`)}
          ikon={IKONLAR[c]}
          secili={cekmece === c}
          onClick={() => cekmeceDegistir(c)}
          ipucu="sol"
        />
      ))}
    </nav>
  )
}

/** Raydaki düğmeyle açılan sabit çekmece; sahneyi daraltır, üstüne binmez. */
export function SagCekmece({ veri }: { veri: OlayVerisi | null }) {
  const { t } = useTranslation()
  const cekmece = useOlayDuzeni((d) => d.cekmece)
  const kapat = useOlayDuzeni((d) => d.cekmeceKapat)
  if (!cekmece) return null
  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-cizgi bg-panel">
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
      {/* Özet kendi listesini kaydırır (önemli olaylar kalan yüksekliği doldurur); diğerleri bütün olarak kayar. */}
      {veri && cekmece === 'ozet' ? (
        <OzetSekmesi veri={veri} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-2">
          {cekmece === 'katmanlar' && <KatmanListesi />}
          {veri && cekmece === 'analiz' && <AnalizSekmesi veri={veri} />}
          {veri && cekmece === 'kanitlar' && <KanitlarSekmesi veri={veri} />}
          {veri && cekmece === 'notlar' && <NotlarSekmesi ad={veri.bilgi.ad} />}
        </div>
      )}
    </aside>
  )
}
