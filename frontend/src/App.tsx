import { useEffect } from 'react'
import { AltSerit } from './bilesenler/altSerit/AltSerit'
import { DogrulamaEkrani } from './bilesenler/dogrulama/DogrulamaEkrani'
import { Harita } from './bilesenler/harita/Harita'
import { SagPanel } from './bilesenler/sagPanel/SagPanel'
import { UstBar } from './bilesenler/ustBar/UstBar'
import { useEkran } from './durum/ekran'
import { useZaman } from './durum/zaman'
import { useOynatici } from './kancalar/useOynatici'
import { zamanAraligi } from './veri/ornekSenaryo'

const olayZamaniniKur = () =>
  useZaman.getState().aralikAyarla(zamanAraligi.baslangic, zamanAraligi.bitis, zamanAraligi.acilis)

// Senaryonun zaman aralığı ilk çizimden önce kurulur (etiketler ilk karede doğru zamanla açılsın).
olayZamaniniKur()

/** Ana ekran: üst bar + seçili kip (olay: 3B örnek veri; doğrulama: 2B gerçek veri). */
function App() {
  useOynatici()
  const ekran = useEkran((d) => d.ekran)

  // Doğrulama ekranı kendi zaman aralığını kurar; olaya dönünce örnek senaryonunki geri gelir.
  useEffect(() => {
    if (ekran === 'olay') olayZamaniniKur()
  }, [ekran])

  return (
    <div className="flex h-full flex-col">
      <UstBar />
      {ekran === 'olay' ? (
        <div className="flex min-h-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <Harita />
            <AltSerit />
          </main>
          <SagPanel />
        </div>
      ) : (
        <DogrulamaEkrani />
      )}
    </div>
  )
}

export default App
