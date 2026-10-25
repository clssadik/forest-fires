import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAyYil } from '../../bicim'
import { olay } from '../../veri/ornekSenaryo'
import {
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
import { SunucuGostergesi } from './SunucuGostergesi'

const Ayirici = ({ noktali = false }: { noktali?: boolean }) => (
  <span
    className={`mx-2.5 h-5 self-center ${noktali ? 'border-l border-dotted border-[#8f8778]' : 'border-l border-cizgi'}`}
  />
)

/** Üst bar: logo, olay seçici, konum, tarih aralığı, kip sekmeleri, menüler (docs/02 §3). */
export function UstBar() {
  const { t } = useTranslation()

  return (
    <header className="flex h-11 shrink-0 items-center overflow-hidden border-b border-cizgi bg-ust pr-2 pl-4 text-[13.5px] whitespace-nowrap [&>*]:shrink-0">
      <div className="flex items-center gap-2">
        <Logo boyut={19} />
        <h1 className="text-[19px] font-semibold tracking-[-0.015em]">{t('uygulama.ad')}</h1>
      </div>
      <Ayirici />
      <span className="text-soluk max-[1600px]:hidden">{t('uygulama.altBaslik')}</span>
      <Ayirici noktali />

      <button
        type="button"
        className="ml-1 flex items-center gap-2 rounded px-2 py-1 font-semibold hover:bg-black/5"
        title={t('ustBar.olaySecici')}
      >
        {olay.ad}
        <IkonAsagi boyut={14} />
      </button>
      <span className="ml-3 text-soluk">{olay.konum}</span>

      <span className="ml-5 flex items-center gap-2">
        <IkonTakvim boyut={14} className="text-soluk" />
        {gunAyYil(olay.baslangic)} – {gunAyYil(olay.bitis)}
      </span>

      <nav className="ml-3.5 flex rounded-md bg-[#cfc9b9] p-[3px]">
        <KipSekmesi etkin ikon={<IkonHarita boyut={14} />} ad={t('ustBar.kipler.olay')} />
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

function KipSekmesi({
  ad,
  ikon,
  rozet,
  etkin = false,
}: {
  ad: string
  ikon: ReactNode
  rozet?: number
  etkin?: boolean
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={!etkin}
      title={etkin ? undefined : t('ustBar.kipYakinda')}
      className={`flex items-center gap-1.5 rounded-[5px] px-2.5 py-[3px] ${
        etkin ? 'bg-[#efebe0] shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-soluk'
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
    <button type="button" className="flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-black/5">
      <span className="text-soluk">{ikon}</span>
      {ad}
      <IkonAsagi boyut={11} className="text-soluk" />
    </button>
  )
}
