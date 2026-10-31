import { useEffect } from 'react'
import { DogrulamaEkrani } from './bilesenler/dogrulama/DogrulamaEkrani'
import { Harita } from './bilesenler/harita/Harita'
import { SagCekmece, SagRay } from './bilesenler/olay/SagRay'
import { ZamanPaneli } from './bilesenler/olay/ZamanPaneli'
import { SenaryoEkrani } from './bilesenler/senaryo/SenaryoEkrani'
import { SolMenu } from './bilesenler/solMenu/SolMenu'
import { UstBar } from './bilesenler/ustBar/UstBar'
import { useDogrulama } from './durum/dogrulama'
import { useEkran } from './durum/ekran'
import { useOlay } from './durum/olay'
import { useOynatici } from './kancalar/useOynatici'

/** Ana ekran: üst bar (logo), sol menü rayı + seçili kip (olay: 3B; doğrulama ve senaryo: 2B; hepsi gerçek veri). */
function App() {
  useOynatici()
  const ekran = useEkran((d) => d.ekran)
  // Olay ve doğrulama ekranları aynı geçmiş yangını gösterir (sol raydaki seçici).
  const yangin = useDogrulama((d) => d.ad)
  const veri = useOlay((d) => d.veri)

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
          // Paneller sabit; sahne aralarında kendi alanında durur, hiçbir şey üstüne binmez. Sağ
          // çekmece ve ray tam boy bir kenar çubuğu; zaman paneli onun solunda biter, kenarlar hizalı.
          <div className="flex min-w-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="flex min-h-0 flex-1 flex-col">
                <Harita />
              </main>
              <ZamanPaneli veri={veri} />
            </div>
            <SagCekmece veri={veri} />
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
