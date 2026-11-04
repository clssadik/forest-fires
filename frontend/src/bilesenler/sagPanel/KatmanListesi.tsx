import { useTranslation } from 'react-i18next'
import {
  anahtarEtkin,
  GORUNUM_MODLARI,
  HARITA_ANAHTARLARI,
  useKatmanlar,
  type GorunumModu,
  type HaritaAnahtari,
} from '../../durum/katmanlar'
import { KatmanOnizleme } from './KatmanOnizleme'
import { AnahtarGorseli, Bolum } from './ortak'

/** Modun haritadaki renkleri; `cizgi` kesikli sınırdır. */
const LEJANTLAR: Record<GorunumModu, { ad: string; renk: string; cizgi?: boolean }[]> = {
  yayilim: [],
  karsilastirma: [
    { ad: 'yanik', renk: '#1d1815' },
    { ad: 'gercekSinir', renk: '#f7f5eb', cizgi: true },
    { ad: 'firms', renk: '#ff5a28' },
  ],
  hata: [
    { ad: 'dogru', renk: '#d4472a' },
    { ad: 'fazla', renk: '#f0b43c' },
    { ad: 'kacirilan', renk: '#455c80' },
  ],
}

/** Katmanlar sekmesi: birbirini dışlayan görünüm modları ve üstlerine binen anahtarlar. */
export function KatmanListesi() {
  const { t } = useTranslation()
  const seciliMod = useKatmanlar((d) => d.mod)
  const lejant = LEJANTLAR[seciliMod]
  return (
    <>
      <Bolum baslik={t('katmanlar.gorunum')}>
        <ul role="radiogroup" aria-label={t('katmanlar.gorunum')} className="-mx-2 space-y-0.5">
          {GORUNUM_MODLARI.map((mod) => (
            <ModSatiri key={mod} mod={mod} secili={mod === seciliMod} />
          ))}
        </ul>
        {lejant.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] leading-4 text-ikincil">
            {lejant.map((l) => (
              <li key={l.ad} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={l.cizgi ? 'h-0 w-3.5 border-t border-dashed' : 'size-2.5 rounded-[3px] ring-1 ring-white/15'}
                  style={l.cizgi ? { borderColor: l.renk } : { background: l.renk }}
                />
                {t(`katmanlar.lejant.${l.ad}`)}
              </li>
            ))}
          </ul>
        )}
      </Bolum>
      <Bolum baslik={t('katmanlar.harita')}>
        <ul className="-mx-2 space-y-0.5">
          {HARITA_ANAHTARLARI.map((a) => (
            <AnahtarSatiri key={a} anahtar={a} etkin={anahtarEtkin(seciliMod, a)} />
          ))}
        </ul>
      </Bolum>
    </>
  )
}

function ModSatiri({ mod, secili }: { mod: GorunumModu; secili: boolean }) {
  const { t } = useTranslation()
  const modSec = useKatmanlar((d) => d.modSec)
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={secili}
        onClick={() => modSec(mod)}
        className={`flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left ${secili ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
      >
        <KatmanOnizleme kimlik={mod} soluk={!secili} />
        <span className={`min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium ${secili ? '' : 'text-ikincil'}`}>
          {t(`katmanlar.modlar.${mod}`)}
        </span>
        <span aria-hidden className={`grid size-[16px] shrink-0 place-items-center rounded-full border ${secili ? 'border-guclu' : 'border-eksen'}`}>
          {secili && <span className="size-2 rounded-full bg-guclu" />}
        </span>
      </button>
    </li>
  )
}

function AnahtarSatiri({ anahtar, etkin }: { anahtar: HaritaAnahtari; etkin: boolean }) {
  const { t } = useTranslation()
  const acik = useKatmanlar((d) => d.anahtarlar[anahtar])
  const degistir = useKatmanlar((d) => d.degistir)
  const gorunen = acik && etkin
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={gorunen}
        disabled={!etkin}
        onClick={() => degistir(anahtar)}
        className="flex w-full items-center gap-3 rounded-[8px] px-2 py-1.5 text-left enabled:hover:bg-white/[0.04] disabled:opacity-40"
      >
        <KatmanOnizleme kimlik={anahtar} soluk={!gorunen} />
        <span className={`min-w-0 flex-1 truncate text-[13px] leading-[18px] font-medium ${gorunen ? '' : 'text-ikincil'}`}>
          {t(`katmanlar.anahtarlar.${anahtar}`)}
        </span>
        <AnahtarGorseli acik={gorunen} />
      </button>
    </li>
  )
}
