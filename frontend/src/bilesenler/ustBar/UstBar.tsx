import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAyYil } from '../../bicim'
import { bitisMs, tutusmaMs, useDogrulama } from '../../durum/dogrulama'
import { useEkran } from '../../durum/ekran'
import { useOlay } from '../../durum/olay'
import { bitisMs as senaryoBitisMs, tutusmaMs as senaryoTutusmaMs, useSenaryo } from '../../durum/senaryo'
import { useZaman } from '../../durum/zaman'
import {
  IkonAlev,
  IkonArac,
  IkonAsagi,
  IkonAyar,
  IkonCizgi,
  IkonGrafik,
  IkonHarita,
  IkonIha,
  IkonPaylas,
  IkonTakvim,
  Logo,
} from '../ikonlar'
import { OlaySecici } from './OlaySecici'
import { SunucuGostergesi } from './SunucuGostergesi'

const Ayirici = ({ noktali = false }: { noktali?: boolean }) => (
  <span
    className={`mx-2.5 h-5 self-center ${noktali ? 'border-l border-dotted border-[#8f8778]' : 'border-l border-cizgi'}`}
  />
)

/** Üst bar: logo, olay seçici (doğrulama ekranında geçmiş yangınlar), konum, tarih aralığı, kip sekmeleri, menüler (docs/02 §3). */
export function UstBar() {
  const { t } = useTranslation()
  const ekran = useEkran((d) => d.ekran)
  const ekranAyarla = useEkran((d) => d.ekranAyarla)
  const bilgi = useDogrulama((d) => d.bilgi)
  const senaryo = useSenaryo((d) => d.ozet)
  const olay = useOlay((d) => d.veri)
  // Senaryo sonucu yokken zaman çubuğunun boş aralığı (şimdi → +48 sa) gösterilir.
  const zamanBaslangic = useZaman((d) => d.baslangic)
  const zamanBitis = useZaman((d) => d.bitis)
  // Olay ve doğrulama ekranı seçili geçmiş yangının, senaryo ekranı seçilen yerin bilgisini gösterir.
  const bos = { ad: t('ustBar.olayYukleniyor'), konum: '', baslangic: zamanBaslangic, bitis: zamanBitis }
  const baslik =
    ekran === 'senaryo'
      ? {
          ad: t('senaryo.baslik'),
          konum: t('senaryo.konum'),
          baslangic: senaryo ? senaryoTutusmaMs(senaryo) : zamanBaslangic,
          bitis: senaryo ? senaryoBitisMs(senaryo) : zamanBitis,
        }
      : ekran === 'olay'
        ? olay
          ? { ad: olay.bilgi.baslik, konum: olay.bilgi.konum, baslangic: olay.tutusmaMs, bitis: olay.bitisMs }
          : bos
        : bilgi
          ? { ad: bilgi.baslik, konum: bilgi.konum, baslangic: tutusmaMs(bilgi), bitis: bitisMs(bilgi) }
          : bos

  return (
    <header className="relative flex h-11 shrink-0 items-center overflow-hidden border-b border-cizgi bg-ust pr-2 pl-4 text-[13.5px] whitespace-nowrap [&>*]:shrink-0">
      <div className="flex items-center gap-2">
        <Logo boyut={19} />
        <h1 className="text-[19px] font-semibold tracking-[-0.015em]">{t('uygulama.ad')}</h1>
      </div>
      <Ayirici />
      <span className="text-soluk max-[1600px]:hidden">{t('uygulama.altBaslik')}</span>
      <Ayirici noktali />

      <OlaySecici ad={baslik.ad} secilebilir={ekran !== 'senaryo'} />
      <span className="ml-3 text-soluk max-[1560px]:hidden">{baslik.konum}</span>

      <span className="ml-5 flex items-center gap-2">
        <IkonTakvim boyut={14} className="text-soluk" />
        {gunAyYil(baslik.baslangic)} – {gunAyYil(baslik.bitis)}
      </span>

      <nav className="ml-3.5 flex rounded-md bg-[#cfc9b9] p-[3px]">
        <KipSekmesi
          secili={ekran === 'olay'}
          onClick={() => ekranAyarla('olay')}
          ikon={<IkonHarita boyut={14} />}
          ad={t('ustBar.kipler.olay')}
        />
        <KipSekmesi
          secili={ekran === 'dogrulama'}
          onClick={() => ekranAyarla('dogrulama')}
          ikon={<IkonGrafik boyut={14} />}
          ad={t('ustBar.kipler.dogrulama')}
        />
        <KipSekmesi
          secili={ekran === 'senaryo'}
          onClick={() => ekranAyarla('senaryo')}
          ikon={<IkonAlev boyut={14} />}
          ad={t('ustBar.kipler.senaryo')}
        />
        <KipSekmesi ikon={<IkonIha boyut={14} />} ad={t('ustBar.kipler.iha')} rozet={6} />
        <KipSekmesi ikon={<IkonArac boyut={14} />} ad={t('ustBar.kipler.kaynaklar')} rozet={6} />
      </nav>

      <div className="ml-2 flex items-center">
        <Menu ikon={<IkonTakvim boyut={14} />} ad={t('ustBar.menuler.gorunum')} />
        <Menu ikon={<IkonGrafik boyut={14} />} ad={t('ustBar.menuler.analiz')} />
        <Menu ikon={<IkonPaylas boyut={14} />} ad={t('ustBar.menuler.paylas')} />
      </div>

      <div className="ml-auto flex items-center">
        <SunucuGostergesi />
        <Ayirici />
        <button type="button" className="rounded p-1.5 hover:bg-black/5" title={t('ustBar.ayarlar')}>
          <IkonAyar boyut={16} />
        </button>
        <Ayirici />
        <button type="button" className="rounded p-1.5 text-soluk hover:bg-black/5" title={t('ustBar.kucult')}>
          <IkonCizgi boyut={16} />
        </button>
      </div>
    </header>
  )
}

/** Kip sekmesi; `onClick` verilmezse henüz hazır olmayan kip olarak pasif görünür. */
function KipSekmesi({
  ad,
  ikon,
  rozet,
  secili = false,
  onClick,
}: {
  ad: string
  ikon: ReactNode
  rozet?: number
  secili?: boolean
  onClick?: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      aria-pressed={onClick ? secili : undefined}
      title={onClick ? undefined : t('ustBar.kipYakinda')}
      className={`flex items-center gap-1.5 rounded-[5px] px-2.5 py-[3px] ${
        secili ? 'bg-[#efebe0] shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : onClick ? 'hover:bg-black/5' : 'text-soluk'
      }`}
    >
      {ikon}
      {ad}
      {rozet !== undefined && (
        <span className="ml-0.5 grid size-[17px] place-items-center rounded-full bg-ates text-[10.5px] font-semibold text-white">
          {rozet}
        </span>
      )}
    </button>
  )
}

function Menu({ ad, ikon }: { ad: string; ikon: ReactNode }) {
  return (
    <button type="button" title={ad} className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-black/5">
      <span className="text-soluk">{ikon}</span>
      {/* Dar ekranda yalnızca simge: üst bar taşmasın. */}
      <span className="max-[1700px]:sr-only">{ad}</span>
      <IkonAsagi boyut={11} className="text-soluk" />
    </button>
  )
}
