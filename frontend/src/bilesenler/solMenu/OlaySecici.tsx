import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAyYil } from '../../bicim'
import { useDogrulama } from '../../durum/dogrulama'
import * as api from '../../dogrulama/api'
import { IkonTakvim } from '../ikonlar'
import { RayDugmesi } from '../RayDugmesi'

export interface OlayBasligi {
  ad: string
  konum: string
  baslangic: number
  bitis: number
}

/**
 * Sol raydaki olay düğmesi: açılan kartta gösterilen olayın adı, yeri ve tarih aralığı. Olay ve
 * doğrulama ekranlarında kart bölge paketi hazır olan geçmiş yangınları da listeler (iki ekran
 * aynı seçimi paylaşır); senaryo ekranında yalnızca bilgiyi gösterir.
 */
export function OlaySecici({ baslik, secilebilir }: { baslik: OlayBasligi; secilebilir: boolean }) {
  const { t } = useTranslation()
  const secili = useDogrulama((d) => d.ad)
  const yanginSec = useDogrulama((d) => d.yanginSec)
  // Kart açıkken düğmenin ekrandaki yeri; null = kapalı.
  const [konum, setKonum] = useState<{ sol: number; ust: number } | null>(null)
  const acik = konum !== null
  const [liste, setListe] = useState<api.YanginOzeti[] | null>(null)
  const kap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!acik) return
    if (secilebilir && !liste) api.yanginListesi().then(setListe, () => setListe([]))
    const disari = (e: PointerEvent) => {
      if (!kap.current?.contains(e.target as Node)) setKonum(null)
    }
    const kacis = (e: KeyboardEvent) => e.key === 'Escape' && setKonum(null)
    document.addEventListener('pointerdown', disari)
    document.addEventListener('keydown', kacis)
    return () => {
      document.removeEventListener('pointerdown', disari)
      document.removeEventListener('keydown', kacis)
    }
  }, [acik, liste, secilebilir])

  return (
    <div ref={kap}>
      <RayDugmesi
        ad={baslik.ad}
        ikon={<IkonTakvim boyut={18} />}
        ipucu="sag"
        secili={acik}
        aria-haspopup="dialog"
        aria-expanded={acik}
        onClick={(e) => {
          const k = e.currentTarget.getBoundingClientRect()
          setKonum(acik ? null : { sol: k.right + 10, ust: k.top })
        }}
      />
      {konum && (
        <div
          role="dialog"
          aria-label={t('ustBar.olaySecici')}
          className="fixed z-50 w-[280px] rounded-md border border-cizgi bg-panel shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
          style={{ left: konum.sol, top: konum.ust }}
        >
          <div className="px-3.5 py-3">
            <div className="text-[14px] font-semibold">{baslik.ad}</div>
            {baslik.konum && <div className="mt-0.5 text-[12.5px] text-soluk">{baslik.konum}</div>}
            <div className="mt-2 flex items-center gap-2 text-[12.5px] text-ikincil">
              <IkonTakvim boyut={13} className="text-soluk" />
              {gunAyYil(baslik.baslangic)} – {gunAyYil(baslik.bitis)}
            </div>
          </div>
          {secilebilir && (
            <ul role="listbox" aria-label={t('ustBar.olaySecici')} className="border-t border-cizgi py-1">
              {liste === null && <li className="px-3.5 py-1.5 text-[13px] text-soluk">{t('ustBar.olayYukleniyor')}</li>}
              {liste
                ?.filter((y) => y.paket_hazir)
                .map((y) => (
                  <li key={y.ad} role="option" aria-selected={y.ad === secili}>
                    <button
                      type="button"
                      className={`flex w-full flex-col px-3.5 py-1.5 text-left text-[13px] hover:bg-white/[0.07] ${y.ad === secili ? 'font-semibold' : ''}`}
                      onClick={() => {
                        setKonum(null)
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
      )}
    </div>
  )
}
