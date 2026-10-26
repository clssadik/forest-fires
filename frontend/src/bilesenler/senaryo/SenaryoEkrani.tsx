import { useEffect } from 'react'
import { tutusmaMs, useSenaryo } from '../../durum/senaryo'
import { ZamanCubugu } from '../altSerit/ZamanCubugu'
import { SenaryoGrafigi } from './SenaryoGrafigi'
import { SenaryoHaritasi } from './SenaryoHaritasi'
import { SenaryoPaneli } from './SenaryoPaneli'

const SAAT = 3_600_000

/** Senaryo ekranı: "şimdi burada yangın çıksa?" Haritaya tıkla, olasılık bantlarıyla yayılımı gör. */
export function SenaryoEkrani() {
  const ozet = useSenaryo((d) => d.ozet)

  // Ekrana dönülünce önceki sonucun zaman aralığı geri kurulur.
  useEffect(() => {
    useSenaryo.getState().zamaniKur()
  }, [])

  // Zaman çubuğundaki bant: "olası" alanın saatlik büyümesi (ha/sa).
  const yogunluk = (x: number) => {
    if (!ozet) return 0
    const s = Math.floor((x - tutusmaMs(ozet)) / SAAT)
    const h = ozet.buyume_ha[1]
    return s >= 0 && s + 1 < h.length ? h[s + 1] - h[s] : 0
  }
  const olaylar = ozet ? [{ tur: 'tutusma' as const, zaman: tutusmaMs(ozet) }] : []

  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col">
        <SenaryoHaritasi />
        <div className="flex h-[228px] shrink-0 flex-col border-t border-cizgi bg-panel">
          <ZamanCubugu yogunluk={yogunluk} olaylar={olaylar} />
          <SenaryoGrafigi />
        </div>
      </main>
      <SenaryoPaneli />
    </div>
  )
}
