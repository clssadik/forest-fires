import { useTranslation } from 'react-i18next'
import {
  anahtarEtkin,
  HARITA_ANAHTARLARI,
  MOD_GRUPLARI,
  useKatmanlar,
  type GorunumModu,
  type HaritaAnahtari,
} from '../../durum/katmanlar'
import { KatmanOnizleme } from './KatmanOnizleme'
import { AnahtarGorseli, Bolum } from './ortak'

/** Katmanlar sekmesi: sorularına göre gruplanmış görünüm modları ve üstlerine binen anahtarlar. */
export function KatmanListesi() {
  const { t } = useTranslation()
  const seciliMod = useKatmanlar((d) => d.mod)
  return (
    <>
      <div role="radiogroup" aria-label={t('katmanlar.gorunum')}>
        {MOD_GRUPLARI.map((g) => (
          <Bolum key={g.ad} baslik={t(`katmanlar.gruplar.${g.ad}`)}>
            <ul className="-mx-2 space-y-0.5">
              {g.modlar.map((mod) => (
                <ModSatiri key={mod} mod={mod} secili={mod === seciliMod} />
              ))}
            </ul>
          </Bolum>
        ))}
      </div>
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
