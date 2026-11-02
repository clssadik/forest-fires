import { useEffect, type CSSProperties } from 'react'
import { DogrulamaEkrani } from './bilesenler/dogrulama/DogrulamaEkrani'
import { Harita } from './bilesenler/harita/Harita'
import { CEKMECE_GENISLIGI, SagCekmece, SagRay } from './bilesenler/olay/SagRay'
import { ZamanPaneli } from './bilesenler/olay/ZamanPaneli'
import { SenaryoEkrani } from './bilesenler/senaryo/SenaryoEkrani'
import { SolMenu } from './bilesenler/solMenu/SolMenu'
import { UstBar } from './bilesenler/ustBar/UstBar'
import { useDogrulama } from './durum/dogrulama'
import { useEkran } from './durum/ekran'
import { useOlay } from './durum/olay'
import { useOlayDuzeni } from './durum/olayDuzeni'
import { useOynatici } from './kancalar/useOynatici'

/** Ana ekran: üst bar (logo), sol menü rayı + seçili kip (olay: 3B; doğrulama ve senaryo: 2B; hepsi gerçek veri). */
function App() {
  useOynatici()
  const ekran = useEkran((d) => d.ekran)
  // Olay ve doğrulama ekranları aynı geçmiş yangını gösterir (sol raydaki seçici).
  const yangin = useDogrulama((d) => d.ad)
  const veri = useOlay((d) => d.veri)
  const cekmeceAcik = useOlayDuzeni((d) => d.cekmece !== null)

  // Her ekran kendi zaman aralığını kurar; olaya dönünce olayınki geri gelir.
  useEffect(() => {
    if (ekran === 'olay') void useOlay.getState().yukle(yangin)
  }, [ekran, yangin])

  return (
    <div className="flex h-full flex-col">
      <UstBar />
      <div className="flex min-h-0 flex-1">
        <SolMenu />
        {ekran === 'olay' ? (
          // Sağ çekmece haritanın üstüne biner; harita (3B tuval) hiç daralmaz. Haritanın sağdaki
          // öğeleri ve zaman paneli `--sag-ortu` kadar çekilir, çekmecenin altında kalmasın.
          <div className="flex min-w-0 flex-1">
            <div
              className="relative flex min-w-0 flex-1 overflow-hidden"
              style={{ '--sag-ortu': cekmeceAcik ? `${CEKMECE_GENISLIGI}px` : '0px' } as CSSProperties}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex min-h-0 flex-1 flex-col">
                  <Harita />
                </main>
                <div className="mr-[var(--sag-ortu)] transition-[margin] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
                  <ZamanPaneli veri={veri} />
                </div>
              </div>
              <SagCekmece veri={veri} />
            </div>
            <SagRay />
          </div>
        ) : ekran === 'dogrulama' ? (
          <DogrulamaEkrani />
        ) : (
          <SenaryoEkrani />
        )}
      </div>
    </div>
  )
}

export default App
