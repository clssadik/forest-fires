import { useTranslation } from 'react-i18next'
import { useKatmanlar, type Katman, type KatmanKimligi } from '../../durum/katmanlar'
import { KatmanOnizleme } from './KatmanOnizleme'
import { AnahtarGorseli, Bolum } from './ortak'

/** Katmanlar, anlamlarına göre üç grupta: modelin çıktıları, uydu gözlemi, zemin. */
const GRUPLAR: { ad: string; kimlikler: KatmanKimligi[] }[] = [
  { ad: 'model', kimlikler: ['yayilim', 'olasilik', 'izokron', 'hata'] },
  { ad: 'gozlem', kimlikler: ['yanikIzi', 'firms'] },
  { ad: 'zemin', kimlikler: ['arazi', 'goruntu', 'ruzgar'] },
]

/** Katmanlar sekmesi: her satırda önizleme, ad, kısa açıklama ve açma/kapama anahtarı. */
export function KatmanListesi() {
  const { t } = useTranslation()
  const katmanlar = useKatmanlar((d) => d.katmanlar)
  return (
    <>
      {GRUPLAR.map((g) => {
        const satirlar = g.kimlikler.flatMap((k) => katmanlar.filter((x) => x.kimlik === k))
        return (
          <Bolum key={g.ad} baslik={t(`katmanlar.gruplar.${g.ad}`)}>
            <ul className="-mx-2 space-y-0.5">
              {satirlar.map((k) => (
                <KatmanSatiri key={k.kimlik} katman={k} />
              ))}
            </ul>
          </Bolum>
        )
      })}
    </>
  )
}

function KatmanSatiri({ katman }: { katman: Katman }) {
  const { t } = useTranslation()
  const degistir = useKatmanlar((d) => d.degistir)
  const { kimlik, acik } = katman

  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={acik}
        onClick={() => degistir(kimlik)}
        className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left hover:bg-white/[0.04]"
      >
        <KatmanOnizleme kimlik={kimlik} soluk={!acik} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] leading-[18px] font-medium ${acik ? '' : 'text-ikincil'}`}>
            {t(`katmanlar.adlar.${kimlik}`)}
          </span>
          <span className="block truncate text-[12px] leading-4 text-ikincil">{t(`katmanlar.aciklamalar.${kimlik}`)}</span>
        </span>
        <AnahtarGorseli acik={acik} />
      </button>
    </li>
  )
}
