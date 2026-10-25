import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Etiket } from './Etiket'
import { useTranslation } from 'react-i18next'
import { gunAySaat } from '../bicim'
import { useZaman } from '../durum/zaman'
import { araziY } from '../model/arazi'
import { cepheMesafesiM, eksenNoktasi, sonCepheMesafesiM } from '../model/yayilim'
import { izokronAnlari, olay } from '../veri/ornekSenaryo'

/**
 * Ana yayılım ekseni (sarı çizgi), tutuşma işareti ve izokron zaman etiketleri
 * (docs/02 §4.4). Hepsi global zamana göre görünür/gizlenir.
 */

const YUKSELTI = 0.12

function eksenNoktalari(m0: number, m1: number, kabartma: number) {
  const adet = Math.max(Math.ceil((m1 - m0) / 250), 1)
  return Array.from({ length: adet + 1 }, (_, i) => {
    const p = eksenNoktasi(m0 + ((m1 - m0) * i) / adet)
    return [p.x, araziY(p.x, p.z) * kabartma + YUKSELTI, p.z] as [number, number, number]
  })
}

export function YayilimIsaretleri({ kabartma }: { kabartma: number }) {
  const { t } = useTranslation()
  // Çizgiyi her karede değil, cephe ~100 m ilerledikçe yeniden kur.
  const cephe = useZaman((d) => Math.round(cepheMesafesiM(d.t) / 100) * 100)
  const zaman = useZaman((d) => d.t)
  const gecmis = useMemo(() => (cephe > 0 ? eksenNoktalari(0, cephe, kabartma) : null), [cephe, kabartma])
  const gelecek = useMemo(
    () => (cephe < sonCepheMesafesiM - 200 ? eksenNoktalari(cephe, sonCepheMesafesiM, kabartma) : null),
    [cephe, kabartma],
  )
  const tutusma = eksenNoktasi(0)
  const basladi = zaman >= olay.baslangic

  return (
    <group>
      {gelecek && (
        <Line points={gelecek} color="#f2b84a" lineWidth={2} dashed dashSize={0.35} gapSize={0.3} transparent opacity={0.75} />
      )}
      {gecmis && <Line points={gecmis} color="#f4b23c" lineWidth={2.6} />}


      {/* Hepsi sürekli bağlı kalır, yalnızca görünürlük değişir (drei Html'in yeniden bağlanma yarışından kaçınmak için). */}
      {izokronAnlari.map((a) => {
          const p = eksenNoktasi(cepheMesafesiM(a))
          return (
            <Etiket key={a} position={[p.x, araziY(p.x, p.z) * kabartma + YUKSELTI, p.z]} zIndexRange={[19, 0]}>
              <div className={`pointer-events-none relative ${a <= zaman ? '' : 'invisible'}`}>
                <span className="absolute -top-[7px] -left-[7px] grid size-[14px] place-items-center rounded-full border-2 border-[#f6a43a] bg-[#fff4df]">
                  <span className="size-[4px] rounded-full bg-[#f08a2a]" />
                </span>
                <div className="absolute top-[-11px] left-[14px] rounded-[4px] bg-[#2b2622]/80 px-1.5 py-[2px] text-[12.5px] whitespace-nowrap text-white">
                  {gunAySaat(a)}
                </div>
              </div>
            </Etiket>
          )
        })}
      <Etiket key="tutusma" position={[tutusma.x, araziY(tutusma.x, tutusma.z) * kabartma + YUKSELTI, tutusma.z]} zIndexRange={[20, 0]}>
          <div className={`pointer-events-none relative ${basladi ? '' : 'invisible'}`}>
            <span className="absolute -top-[7px] -left-[7px] size-[14px] rounded-full border-2 border-white bg-ates shadow-[0_0_14px_6px_rgba(255,170,60,0.75)]" />
            <div className="absolute top-[-14px] left-[14px] rounded-[4px] bg-[#2b2622]/80 px-2 py-1 text-[14px] leading-[18px] whitespace-nowrap text-white">
              {t('harita.tutusma')}
              <br />
              {gunAySaat(olay.baslangic)}
            </div>
          </div>
        </Etiket>
    </group>
  )
}
