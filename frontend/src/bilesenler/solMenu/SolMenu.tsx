import { useTranslation } from 'react-i18next'
import { bitisMs, tutusmaMs, useDogrulama } from '../../durum/dogrulama'
import { useEkran, type Ekran } from '../../durum/ekran'
import { useOlay } from '../../durum/olay'
import { bitisMs as senaryoBitisMs, tutusmaMs as senaryoTutusmaMs, useSenaryo } from '../../durum/senaryo'
import { useZaman } from '../../durum/zaman'
import { IkonAlev, IkonArac, IkonAyar, IkonGrafik, IkonHarita, IkonHedef, IkonIha, IkonKare, IkonPaylas } from '../ikonlar'
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
  const baslik: OlayBasligi =
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

  const kip = (e: Ekran) => ({ secili: ekran === e, onClick: () => ekranAyarla(e), ad: t(`ustBar.kipler.${e}`) })
  const yakinda = (ad: string) => `${ad}, ${t('ustBar.kipYakinda')}`

  return (
    <nav
      aria-label={t('ustBar.menu')}
      className="flex w-[56px] shrink-0 flex-col items-center gap-1.5 border-r border-cizgi bg-panel py-3"
    >
      <OlaySecici baslik={baslik} secilebilir={ekran !== 'senaryo'} />
      <Ayirici />
      <RayDugmesi {...kip('olay')} ikon={<IkonHarita boyut={18} />} ipucu="sag" />
      <RayDugmesi {...kip('dogrulama')} ikon={<IkonGrafik boyut={18} />} ipucu="sag" />
      <RayDugmesi {...kip('senaryo')} ikon={<IkonAlev boyut={18} />} ipucu="sag" />
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
