import { useTranslation } from 'react-i18next'
import { useOlay } from '../../durum/olay'
import { useZaman } from '../../durum/zaman'
import { IkonArac, IkonAyar, IkonHarita, IkonHedef, IkonIha, IkonKare, IkonPaylas } from '../ikonlar'
import { RayDugmesi } from '../RayDugmesi'
import { OlaySecici, type OlayBasligi } from './OlaySecici'
import { SunucuGostergesi } from './SunucuGostergesi'

const Ayirici = () => <span className="my-1.5 w-6 shrink-0 border-t border-cizgi" />

/**
 * Sol ray (eski üst barın içeriği): olay seçici, kipler, menüler; en altta sunucu noktası ve
 * ayarlar. Yalnızca simgeler; adlar ipucunda.
 */
export function SolMenu() {
  const { t } = useTranslation()
  const olay = useOlay((d) => d.veri)
  const zamanBaslangic = useZaman((d) => d.baslangic)
  const zamanBitis = useZaman((d) => d.bitis)
  const baslik: OlayBasligi = olay
    ? { ad: olay.bilgi.baslik, konum: olay.bilgi.konum, baslangic: olay.tutusmaMs, bitis: olay.bitisMs }
    : { ad: t('ustBar.olayYukleniyor'), konum: '', baslangic: zamanBaslangic, bitis: zamanBitis }

  const yakinda = (ad: string) => `${ad}, ${t('ustBar.kipYakinda')}`

  return (
    <nav
      aria-label={t('ustBar.menu')}
      className="flex w-[56px] shrink-0 flex-col items-center gap-1.5 border-r border-cizgi bg-panel py-3"
    >
      <OlaySecici baslik={baslik} />
      <Ayirici />
      <RayDugmesi secili ad={t('ustBar.kipler.olay')} ikon={<IkonHarita boyut={18} />} ipucu="sag" />
      <RayDugmesi ad={yakinda(t('ustBar.kipler.iha'))} ikon={<IkonIha boyut={18} />} rozet={6} ipucu="sag" />
      <RayDugmesi ad={yakinda(t('ustBar.kipler.kaynaklar'))} ikon={<IkonArac boyut={18} />} rozet={6} ipucu="sag" />
      <Ayirici />
      <RayDugmesi ad={yakinda(t('ustBar.menuler.gorunum'))} ikon={<IkonKare boyut={17} />} ipucu="sag" />
      <RayDugmesi ad={yakinda(t('ustBar.menuler.analiz'))} ikon={<IkonHedef boyut={18} />} ipucu="sag" />
      <RayDugmesi ad={yakinda(t('ustBar.menuler.paylas'))} ikon={<IkonPaylas boyut={18} />} ipucu="sag" />

      <div className="mt-auto flex flex-col items-center gap-1.5">
        <SunucuGostergesi />
        <RayDugmesi ad={yakinda(t('ustBar.ayarlar'))} ikon={<IkonAyar boyut={18} />} ipucu="sag" />
      </div>
    </nav>
  )
}
