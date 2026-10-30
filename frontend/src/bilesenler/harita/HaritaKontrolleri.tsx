import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { sayi } from '../../bicim'
import { useHarita, type GorunumKipi } from '../../durum/harita'
import type { OlayVerisi } from '../../olay/veri'
import { IkonAsagi, IkonDik, IkonDonSag, IkonDonSol, IkonEg, IkonHedef, IkonTamEkran } from '../ikonlar'
import { OlcekCubugu } from './OlcekCubugu'

const ZOOMLAR = [0.5, 1, 1.5, 2.5, 5, 10]
const DONUS_ADIMI = 45
const EGIM_ADIMI = 12
const kutu = 'rounded-[5px] bg-white/[0.08] ring-1 ring-white/10 text-white'

/**
 * Harita kontrolleri: haritanın altında yarı saydam tek çubuk. Solda 2B/3B, tutuşmaya git,
 * yakınlaştırma, 3B'de döndür / eğ düğmeleri ve klavye ipucu; sağda ölçek ve tam ekran.
 * Pusula bunun dışında, sol üstte kalır.
 */
export function HaritaKontrolleri({ veri, tamEkran }: { veri: OlayVerisi; tamEkran: () => void }) {
  const { t } = useTranslation()
  const { kip, zoom, kipAyarla, zoomIste, odaklanIste, donmeIste } = useHarita()
  const { tutusma } = veri.bilgi

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-[48px] items-center gap-2 border-t border-white/10 bg-black/45 px-4 whitespace-nowrap backdrop-blur-md select-none">
      <div className={`flex p-[3px] text-[13px] font-semibold ${kutu}`}>
        {(['2B', '3B'] as GorunumKipi[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => kipAyarla(k)}
            aria-pressed={kip === k}
            className={`h-[24px] rounded-[4px] px-2.5 ${kip === k ? 'bg-ates' : 'text-white/60 hover:text-white'}`}
          >
            {t(k === '2B' ? 'harita.kip2B' : 'harita.kip3B')}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => odaklanIste(tutusma.x, tutusma.z)}
        title={t('harita.tutusmayaGit')}
        aria-label={t('harita.tutusmayaGit')}
        className={`flex h-[30px] items-center gap-1.5 px-2.5 text-[13px] hover:bg-white/15 ${kutu}`}
      >
        <IkonHedef boyut={15} className="text-ates-acik" />
        {t('harita.tutusma')}
      </button>
      <label className={`relative flex h-[30px] items-center hover:bg-white/15 ${kutu}`}>
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
      {kip === '3B' && (
        <div className={`flex overflow-hidden ${kutu}`}>
          <Dugme etiket={t('harita.solaDon')} onClick={() => donmeIste(-DONUS_ADIMI, 0)}>
            <IkonDonSol boyut={15} />
          </Dugme>
          <Dugme etiket={t('harita.sagaDon')} onClick={() => donmeIste(DONUS_ADIMI, 0)}>
            <IkonDonSag boyut={15} />
          </Dugme>
          <Dugme etiket={t('harita.eg')} onClick={() => donmeIste(0, EGIM_ADIMI)}>
            <IkonEg boyut={15} />
          </Dugme>
          <Dugme etiket={t('harita.dik')} onClick={() => donmeIste(0, -EGIM_ADIMI)}>
            <IkonDik boyut={15} />
          </Dugme>
        </div>
      )}
      <p className="ml-1 min-w-0 truncate text-[12px] leading-none text-white/70">
        {kip === '3B' ? (
          <Trans
            i18nKey="harita.ipucu3B"
            components={{
              tus: (
                <kbd className="rounded-[4px] border border-white/25 border-b-white/40 bg-white/10 px-1.5 py-[3px] font-sans text-[11px] font-medium text-white" />
              ),
            }}
          />
        ) : (
          t('harita.ipucu2B')
        )}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-4">
        <OlcekCubugu />
        <button type="button" onClick={tamEkran} title={t('harita.tamEkran')} className={`grid size-[30px] place-items-center hover:bg-white/15 ${kutu}`}>
          <IkonTamEkran boyut={16} />
        </button>
      </div>
    </div>
  )
}

function Dugme({ etiket, onClick, children }: { etiket: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={etiket} aria-label={etiket} onClick={onClick} className="grid h-[30px] w-[30px] place-items-center hover:bg-white/15">
      {children}
    </button>
  )
}
