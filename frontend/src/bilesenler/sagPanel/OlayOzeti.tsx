import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi, tamTarih, yuzdeBicim } from '../../bicim'
import type { OlayVerisi } from '../../olay/veri'
import { Kart } from './Kart'

/** Olay Özeti kartı (docs/02 §5.3): yangın, model ve doğrulama özeti. */
export function OlayOzeti({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const { bilgi } = veri
  const m = bilgi.model
  const daireyiGeciyor = m.daire_dice !== null && m.bitis_dice !== null && m.bitis_dice > m.daire_dice
  const satirlar: [string, ReactNode][] = [
    [t('olayOzeti.ad'), bilgi.baslik],
    [t('olayOzeti.konum'), bilgi.konum],
    [t('olayOzeti.baslangic'), tamTarih(veri.tutusmaMs)],
    [t('olayOzeti.bitis'), tamTarih(veri.bitisMs)],
    [t('olayOzeti.toplamAlan'), t('olayOzeti.hektar', { deger: sayi(bilgi.gercek_ha) })],
    [t('olayOzeti.model'), t('olayOzeti.modelDeger', { ad: m.aciklama, sayi: m.calisma_sayisi })],
    [
      t('olayOzeti.sorensen'),
      <span key="sorensen">
        {m.bitis_dice === null ? '—' : yuzdeBicim(m.bitis_dice)}
        {m.daire_dice !== null && m.bitis_dice !== null && (
          <span className={`ml-1 font-normal ${daireyiGeciyor ? 'text-[#3f6b33]' : 'text-ates'}`}>
            {t(daireyiGeciyor ? 'olayOzeti.daireyiGeciyor' : 'olayOzeti.daireyiGecemiyor', {
              deger: yuzdeBicim(m.daire_dice),
            })}
          </span>
        )}
      </span>,
    ],
  ]
  return (
    <Kart baslik={t('olayOzeti.baslik')}>
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
