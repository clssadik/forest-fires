import { useTranslation } from 'react-i18next'
import { sayi } from '../../bicim'
import { useHarita, type GorunumKipi } from '../../durum/harita'
import { IkonAsagi, IkonTamEkran } from '../ikonlar'
import { OlcekCubugu } from './OlcekCubugu'

const ZOOMLAR = [0.5, 1, 1.5, 2.5, 5, 10]
const koyuKutu = 'rounded-[5px] bg-[#2a2723]/80 text-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] backdrop-blur-sm'

/** Sağ alttaki harita kontrolleri: ölçek, 2B/3B, yakınlaştırma, tam ekran. */
export function HaritaKontrolleri({ tamEkran }: { tamEkran: () => void }) {
  const { t } = useTranslation()
  const { kip, zoom, kipAyarla, zoomIste } = useHarita()

  return (
    <div className="absolute right-5 bottom-4 flex items-end gap-2.5">
      <OlcekCubugu />
      <div className={`flex p-[3px] text-[13px] font-semibold ${koyuKutu}`}>
        {(['2B', '3B'] as GorunumKipi[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => kipAyarla(k)}
            aria-pressed={kip === k}
            className={`h-[26px] rounded-[4px] px-2.5 ${kip === k ? 'bg-ates' : 'text-white/60 hover:text-white'}`}
          >
            {t(k === '2B' ? 'harita.kip2B' : 'harita.kip3B')}
          </button>
        ))}
      </div>
      <label className={`relative flex h-[32px] items-center ${koyuKutu}`}>
        <span className="sr-only">{t('harita.zoom')}</span>
        <select
          value=""
          onChange={(e) => zoomIste(Number(e.target.value))}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="" disabled>
            {sayi(zoom, 1)}×
          </option>
          {ZOOMLAR.map((z) => (
            <option key={z} value={z}>
              {sayi(z, 1)}×
            </option>
          ))}
        </select>
        <span className="pointer-events-none flex items-center gap-1.5 px-2.5 text-[13px]">
          {sayi(zoom, 1)}×
          <IkonAsagi boyut={12} />
        </span>
      </label>
      <button type="button" onClick={tamEkran} title={t('harita.tamEkran')} className={`grid size-[32px] place-items-center ${koyuKutu}`}>
        <IkonTamEkran boyut={16} />
      </button>
    </div>
  )
}
