import { AnimatePresence, motion, MotionConfig, useIsPresent } from 'motion/react'
import { useState, type ReactNode } from 'react'
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

const GENISLIK = 340
/** Çekmecenin kayarak açılıp kapanması ve sekme değişiminde içeriğin belirmesi. */
const ACILIS = { duration: 0.28, ease: [0.22, 1, 0.36, 1] } as const
const SEKME = { duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const

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
    <nav aria-label={t('olayDuzeni.ray')} className="relative z-30 flex w-[56px] shrink-0 flex-col items-center gap-1.5 border-l border-cizgi bg-panel pt-3">
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

/**
 * Raydaki düğmeyle açılan sabit çekmece; açıkken sahneyi daraltır, üstüne binmez. Açılırken
 * sahnenin üstünden kayarak gelir, bitince yerine oturur; kapanırken önce yerini bırakır, sonra
 * kayarak çıkar. Böylece sahne tuvali kayma boyunca her karede değil, bir kez boyutlanır (her
 * karede boyutlanınca birkaç kare siyah kalıyordu). Sekme değişince içerik yandan belirir.
 */
export function SagCekmece({ veri }: { veri: OlayVerisi | null }) {
  const cekmece = useOlayDuzeni((d) => d.cekmece)
  // Sayfa çekmece açıkken yüklenirse kayma olmaz; çekmece doğrudan yerinde başlar. İlk
  // kapanıştan sonraki her açılış kayar.
  const [yerindeBasla, setYerindeBasla] = useState(cekmece !== null)
  if (!cekmece && yerindeBasla) setYerindeBasla(false)
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence initial={false}>
        {cekmece && <CekmeceKabugu key="cekmece" cekmece={cekmece} veri={veri} yerinde={yerindeBasla} />}
      </AnimatePresence>
    </MotionConfig>
  )
}

function CekmeceKabugu({ cekmece, veri, yerinde }: { cekmece: Cekmece; veri: OlayVerisi | null; yerinde: boolean }) {
  const mevcut = useIsPresent()
  const [oturdu, setOturdu] = useState(yerinde)
  return (
    <div className="relative shrink-0" style={{ width: oturdu && mevcut ? GENISLIK : 0 }}>
      <motion.aside
        initial={{ x: GENISLIK }}
        animate={{ x: 0 }}
        exit={{ x: GENISLIK }}
        transition={ACILIS}
        onAnimationComplete={() => {
          if (mevcut) setOturdu(true)
        }}
        className="absolute inset-y-0 right-0 z-20 overflow-hidden border-l border-cizgi bg-panel"
        style={{ width: GENISLIK }}
      >
        <CekmeceIcerigi cekmece={cekmece} veri={veri} />
      </motion.aside>
    </div>
  )
}

function CekmeceIcerigi({ cekmece, veri }: { cekmece: Cekmece; veri: OlayVerisi | null }) {
  const { t } = useTranslation()
  const kapat = useOlayDuzeni((d) => d.cekmeceKapat)
  return (
    <motion.div
      key={cekmece}
      initial={{ opacity: 0, x: 14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={SEKME}
      className="flex h-full flex-col"
      style={{ width: GENISLIK }}
    >
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
    </motion.div>
  )
}
