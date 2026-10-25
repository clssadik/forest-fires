import { useMemo } from 'react'
import { Etiket } from './Etiket'
import { useTranslation } from 'react-i18next'
import { sayi } from '../bicim'
import { araziY, yukseklikM } from '../model/arazi'
import { yerEtiketleri } from '../veri/ornekSenaryo'

/** Tepe ve su etiketleri. Tepeler yakın çevredeki en yüksek noktaya oturtulur. */
export function YerEtiketleri({ kabartma }: { kabartma: number }) {
  const { t } = useTranslation()
  const yerler = useMemo(
    () =>
      yerEtiketleri.map((y) => {
        if (y.tur !== 'tepe') return { ...y, hM: 0, yS: 0.05 }
        let en = { x: y.x, z: y.z, h: -Infinity }
        for (let dx = -3; dx <= 3; dx += 0.25)
          for (let dz = -3; dz <= 3; dz += 0.25) {
            const h = yukseklikM(y.x + dx, y.z + dz)
            if (h > en.h) en = { x: y.x + dx, z: y.z + dz, h }
          }
        return { ...y, x: en.x, z: en.z, hM: en.h, yS: araziY(en.x, en.z) }
      }),
    [],
  )

  return (
    <>
      {yerler.map((y) => (
        <Etiket key={y.ad} position={[y.x, y.yS * kabartma + 0.05, y.z]} zIndexRange={[10, 0]}>
          <div
            className="pointer-events-none -translate-x-1/2 -translate-y-full text-center text-[13.5px] leading-[17px] whitespace-nowrap text-white"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.65)' }}
          >
            {y.tur === 'tepe' ? (
              <>
                <span className="mr-1 inline-block align-[1px] text-[10px]">▲</span>
                {y.ad}
                <br />
                {t('harita.yukseklik', { deger: sayi(Math.round(y.hM)) })}
              </>
            ) : (
              <span className="text-[#f0f4f6]">{y.ad}</span>
            )}
          </div>
        </Etiket>
      ))}
    </>
  )
}
