import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAyYil } from '../../bicim'
import { useDogrulama } from '../../durum/dogrulama'
import * as api from '../../dogrulama/api'
import { IkonAsagi } from '../ikonlar'

/**
 * Üst bardaki olay adı. Doğrulama ekranında açılır menüdür: bölge paketi hazır olan geçmiş
 * yangınlar arasında geçiş yapar. Diğer ekranlarda yalnızca adı gösterir.
 */
export function OlaySecici({ ad, secilebilir }: { ad: string; secilebilir: boolean }) {
  const { t } = useTranslation()
  const secili = useDogrulama((d) => d.ad)
  const yanginSec = useDogrulama((d) => d.yanginSec)
  // Menü açıkken soldan konumu (px); null = kapalı. Başka ekrana geçince menü gizlenir.
  const [sol, setSol] = useState<number | null>(null)
  const acik = sol !== null && secilebilir
  const [liste, setListe] = useState<api.YanginOzeti[] | null>(null)
  const kap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    if (!liste) api.yanginListesi().then(setListe, () => setListe([]))
    const disari = (e: PointerEvent) => {
      if (!kap.current?.contains(e.target as Node)) setSol(null)
    }
    const kacis = (e: KeyboardEvent) => e.key === 'Escape' && setSol(null)
    document.addEventListener('pointerdown', disari)
    document.addEventListener('keydown', kacis)
    return () => {
      document.removeEventListener('pointerdown', disari)
      document.removeEventListener('keydown', kacis)
    }
  }, [acik, liste])

  return (
    <div ref={kap} className="ml-1">
      <button
        type="button"
        disabled={!secilebilir}
        onClick={(e) => setSol(acik ? null : e.currentTarget.getBoundingClientRect().left)}
        aria-haspopup="listbox"
        aria-expanded={acik}
        className="flex items-center gap-2 rounded px-2 py-1 font-semibold enabled:hover:bg-black/5"
        title={secilebilir ? t('ustBar.olaySecici') : undefined}
      >
        {ad}
        {secilebilir && <IkonAsagi boyut={14} />}
      </button>
      {acik && (
        // Üst bar `overflow-hidden`; menü sabit konumla bardan taşar.
        <ul
          role="listbox"
          aria-label={t('ustBar.olaySecici')}
          className="fixed top-[40px] z-50 min-w-[260px] rounded-md border border-cizgi bg-[#efebe0] py-1 shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
          style={{ left: sol ?? 0 }}
        >
          {liste === null && <li className="px-3 py-1.5 text-soluk">{t('ustBar.olayYukleniyor')}</li>}
          {liste
            ?.filter((y) => y.paket_hazir)
            .map((y) => (
              <li key={y.ad} role="option" aria-selected={y.ad === secili}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3 py-1.5 text-left hover:bg-black/5 ${y.ad === secili ? 'font-semibold' : ''}`}
                  onClick={() => {
                    setSol(null)
                    void yanginSec(y.ad)
                  }}
                >
                  <span>{y.baslik}</span>
                  <span className="text-[12px] font-normal text-soluk">
                    {y.konum} · {gunAyYil(Date.parse(y.tutusma_utc))}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
