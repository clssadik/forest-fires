import { AltSerit } from './bilesenler/altSerit/AltSerit'
import { Harita } from './bilesenler/harita/Harita'
import { SagPanel } from './bilesenler/sagPanel/SagPanel'
import { UstBar } from './bilesenler/ustBar/UstBar'
import { useZaman } from './durum/zaman'
import { useOynatici } from './kancalar/useOynatici'
import { zamanAraligi } from './veri/ornekSenaryo'

// Senaryonun zaman aralığı ilk çizimden önce kurulur (etiketler ilk karede doğru zamanla açılsın).
useZaman.getState().aralikAyarla(zamanAraligi.baslangic, zamanAraligi.bitis, zamanAraligi.acilis)

/** Olay kipi ana ekranı: üst bar, harita + alt şerit, sağ panel. */
function App() {
  useOynatici()

  return (
    <div className="flex h-full flex-col">
      <UstBar />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <Harita />
          <AltSerit />
        </main>
        <SagPanel />
      </div>
    </div>
  )
}

export default App
