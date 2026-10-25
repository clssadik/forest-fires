import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi, tamTarih } from '../../bicim'
import { olay } from '../../veri/ornekSenaryo'
import { Kart } from './Kart'

/** Olay Özeti kartı (docs/02 §5.3). */
export function OlayOzeti() {
  const { t } = useTranslation()
  const satirlar: [string, ReactNode][] = [
    [t('olayOzeti.ad'), olay.ad],
    [t('olayOzeti.kimlik'), olay.kimlik],
    [t('olayOzeti.konum'), olay.konum],
    [t('olayOzeti.baslangic'), tamTarih(olay.baslangic)],
    [t('olayOzeti.bitis'), tamTarih(olay.bitis)],
    [t('olayOzeti.toplamAlan'), t('olayOzeti.hektar', { deger: sayi(olay.toplamAlanHa) })],
    [t('olayOzeti.neden'), t(`olayOzeti.nedenler.${olay.neden}`)],
    [
      t('olayOzeti.durum'),
      <span key="durum" className="inline-flex items-center gap-1.5 border-b border-cizgi pb-px">
        <span className="size-[9px] rounded-full border border-[#8d8676] bg-[#b9b3a4]" />
        {t(`olayOzeti.durumlar.${olay.durum}`)}
      </span>,
    ],
  ]
  return (
    <Kart
      baslik={t('olayOzeti.baslik')}
      sag={
        <button type="button" className="text-[12.5px] hover:underline">
          {t('olayOzeti.duzenle')}
        </button>
      }
    >
      <dl className="grid grid-cols-[104px_1fr] gap-x-2 gap-y-[3px] px-3 pt-2 pb-2.5 text-[12.5px] leading-[17px]">
        {satirlar.map(([etiket, deger]) => (
          <div key={etiket} className="contents">
            <dt className="text-soluk">{etiket}</dt>
            <dd className="font-medium">{deger}</dd>
          </div>
        ))}
      </dl>
    </Kart>
  )
}
