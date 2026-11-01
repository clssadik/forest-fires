import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useHarita, type GorunumKipi } from '../../durum/harita'
import type { OlayVerisi } from '../../olay/veri'
import { IkonDik, IkonDonSag, IkonDonSol, IkonEg, IkonHedef, IkonTamEkran } from '../ikonlar'
import { OlcekCubugu } from './OlcekCubugu'

const DONUS_ADIMI = 45
const EGIM_ADIMI = 12

/**
 * Harita kontrolleri: alt ortada yüzen tek bir hap. 2B/3B yazıyla, gerisi yalnızca simge (adı ipucunda):
 * tutuşmaya git, 3B'de döndür / eğ ve tam ekran; gruplar ince ayraçlarla ayrılır. Ölçek sağ altta, kutusuz.
 * Pusula bunun dışında, sol üstte kalır.
 */
export function HaritaKontrolleri({ veri, tamEkran }: { veri: OlayVerisi; tamEkran: () => void }) {
  const { t } = useTranslation()
  const { kip, kipAyarla, odaklanIste, donmeIste } = useHarita()
  const { tutusma } = veri.bilgi

  return (
    <>
      <div className="absolute right-4 bottom-4 z-30">
        <OlcekCubugu />
      </div>
      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/85 p-1 text-[13px] whitespace-nowrap text-white ring-1 ring-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.35)] select-none">
        <div className="flex rounded-full bg-white/[0.08] p-0.5 font-semibold">
          {(['2B', '3B'] as GorunumKipi[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => kipAyarla(k)}
              aria-pressed={kip === k}
              className={`h-[24px] rounded-full px-2.5 ${kip === k ? 'bg-guclu text-zemin' : 'text-white/55 hover:text-white'}`}
            >
              {t(k === '2B' ? 'harita.kip2B' : 'harita.kip3B')}
            </button>
          ))}
        </div>
        <Ayrac />
        <Dugme etiket={t('harita.tutusmayaGit')} onClick={() => odaklanIste(tutusma.x, tutusma.z)}>
          <IkonHedef boyut={15} />
        </Dugme>
        {kip === '3B' && (
          <>
            <Ayrac />
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
          </>
        )}
        <Ayrac />
        <Dugme etiket={t('harita.tamEkran')} onClick={tamEkran}>
          <IkonTamEkran boyut={15} />
        </Dugme>
      </div>
    </>
  )
}

function Ayrac() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-white/15" />
}

function Dugme({
  etiket,
  onClick,
  children,
}: {
  etiket: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={etiket}
      aria-label={etiket}
      onClick={onClick}
      className="grid size-[28px] place-items-center rounded-full hover:bg-white/10"
    >
      {children}
    </button>
  )
}
