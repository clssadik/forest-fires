import { useTranslation } from 'react-i18next'
import { sayi } from '../../bicim'
import { useHarita } from '../../durum/harita'

const ADIMLAR = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000, 50000]
const HEDEF_PX = 150

/** Kameraya göre güncellenen ölçek çubuğu: 0 · orta · uç (docs/02 §4.1). */
export function OlcekCubugu() {
  const { t } = useTranslation()
  const pikselBasinaM = useHarita((d) => d.pikselBasinaM)
  const toplam = ADIMLAR.findLast((a) => a / pikselBasinaM <= HEDEF_PX) ?? ADIMLAR[0]
  const gen = toplam / pikselBasinaM
  const etiket = (m: number) =>
    toplam >= 1000 ? t('harita.olcekKm', { deger: sayi(m / 1000, 2) }) : t('harita.olcekM', { deger: sayi(m) })

  return (
    <div className="relative mr-4 h-[30px] select-none text-[11.5px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.7)]" style={{ width: gen }}>
      <span className="absolute top-0 left-0 -translate-x-1/2">0</span>
      <span className="absolute top-0 left-1/2 -translate-x-1/2">{etiket(toplam / 2).replace(/ (km|m)$/, '')}</span>
      <span className="absolute top-0 left-full -translate-x-1/2 whitespace-nowrap">{etiket(toplam)}</span>
      <svg className="absolute bottom-0 left-0 h-[9px] overflow-visible drop-shadow-[0_1px_1px_rgba(0,0,0,.6)]" width={gen}>
        <line x1={0} x2={gen} y1={8} y2={8} stroke="white" strokeWidth={2} />
        {[0, 0.25, 0.5, 0.75, 1].map((k) => (
          <line key={k} x1={k * gen} x2={k * gen} y1={k % 0.5 === 0 ? 1 : 4} y2={8} stroke="white" strokeWidth={1.6} />
        ))}
      </svg>
    </div>
  )
}
