import { useEffect } from 'react'
import { DogrulamaEkrani } from './bilesenler/dogrulama/DogrulamaEkrani'
import { Harita } from './bilesenler/harita/Harita'
import { AnSutunu } from './bilesenler/olay/AnSutunu'
import { SolCekmece, SolRay } from './bilesenler/olay/SolRay'
import { ZamanPaneli } from './bilesenler/olay/ZamanPaneli'
import { SenaryoEkrani } from './bilesenler/senaryo/SenaryoEkrani'
import { UstBar } from './bilesenler/ustBar/UstBar'
import { useDogrulama } from './durum/dogrulama'
import { useEkran } from './durum/ekran'
import { useOlay } from './durum/olay'
import { useOynatici } from './kancalar/useOynatici'

/** Ana ekran: üst bar + seçili kip (olay: 3B; doğrulama ve senaryo: 2B; hepsi gerçek veri). */
function App() {
  useOynatici()
  const ekran = useEkran((d) => d.ekran)
  // Olay ve doğrulama ekranları aynı geçmiş yangını gösterir (üst bardaki seçici).
  const yangin = useDogrulama((d) => d.ad)
  const veri = useOlay((d) => d.veri)

  // Her ekran kendi zaman aralığını kurar; olaya dönünce olayınki geri gelir.
  useEffect(() => {
    if (ekran === 'olay') void useOlay.getState().yukle(yangin)
  }, [ekran, yangin])

  return (
    <div className="flex h-full flex-col">
      <UstBar />
      {ekran === 'olay' ? (
        // Paneller sabit; sahne aralarında kendi alanında durur, hiçbir şey üstüne binmez. Sol ray ve
        // çekmece tam boy bir kenar çubuğu; zaman paneli onun sağından başlar, kenarlar hizalı kalır.
        <div className="flex min-h-0 flex-1">
          <SolRay />
          <SolCekmece veri={veri} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <main className="flex min-w-0 flex-1 flex-col">
                <Harita />
              </main>
              {veri && <AnSutunu veri={veri} />}
            </div>
            <ZamanPaneli veri={veri} />
          </div>
        </div>
      ) : ekran === 'dogrulama' ? (
        <DogrulamaEkrani />
      ) : (
        <SenaryoEkrani />
      )}
    </div>
  )
}

export default App
