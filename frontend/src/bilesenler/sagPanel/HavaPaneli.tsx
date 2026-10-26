import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi, yuzdeBicim } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import { pusulaYonu, type OlayVerisi } from '../../olay/veri'
import { IkonAlev, IkonAlevBoyu, IkonDamla, IkonRuzgar, IkonTermometre, IkonYaprak } from '../ikonlar'
import { Kart } from './Kart'

/**
 * Hava ve Yangın Davranışı kartı (docs/02 §5.4, §9): tutuşma noktasındaki saatlik hava
 * (Open-Meteo/ERA5, yakıt nemi Simard denge nemi) ve modelin baş cephe hızı ile yanan alanı.
 */
export function HavaPaneli({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  // Değerler 10 dakikada bir yeniden çizilir; her karede değil.
  const an = useZaman((d) => Math.floor(d.t / 600_000) * 600_000)
  const h = veri.hava(an)
  const basladi = an >= veri.tutusmaMs
  const ruzgar = Math.round(h.ruzgarKmSa)
  const yon = Math.round(h.ruzgarYonu)

  return (
    <Kart baslik={t('hava.baslik')} ek={t('hava.kaynakTutusma')}>
      <div className="grid grid-cols-[1.1fr_0.86fr_1.04fr] px-1.5 pt-2.5 pb-2">
        <Deger ikon={<IkonRuzgar boyut={17} />} etiket={t('hava.ruzgar')}>
          {t('hava.kmSa', { deger: ruzgar })}
          <span className="block font-normal">{t('hava.yon', { yon: pusulaYonu(yon), derece: yon })}</span>
        </Deger>
        <Deger ikon={<IkonTermometre boyut={17} />} etiket={t('hava.sicaklik')} cizgi>
          {t('hava.derece', { deger: Math.round(h.sicaklik) })}
        </Deger>
        <Deger ikon={<IkonDamla boyut={17} className="text-[#3f7fc0]" />} etiket={t('hava.nem')} cizgi>
          {yuzdeBicim(h.nem / 100)}
        </Deger>
        <div className="col-span-3 my-2 border-t border-cizgi/80" />
        <Deger ikon={<IkonYaprak boyut={18} className="text-[#55634a]" />} etiket={t('hava.yakitNemi')}>
          {sayi(h.yakitNemi, 1)} %
        </Deger>
        <Deger ikon={<IkonAlev boyut={18} className="text-ates" />} etiket={t('hava.cepheHizi')} cizgi>
          {basladi ? t('hava.mDk', { deger: sayi(veri.hizMDk(an), 1) }) : t('hava.baslamadi')}
        </Deger>
        <Deger ikon={<IkonAlevBoyu boyut={17} className="text-ates" />} etiket={t('hava.modelAlan')} cizgi>
          {basladi ? t('olayOzeti.hektar', { deger: sayi(veri.yananAlanHa(an)) }) : t('hava.baslamadi')}
        </Deger>
      </div>
    </Kart>
  )
}

function Deger({
  ikon,
  etiket,
  cizgi = false,
  children,
}: {
  ikon: ReactNode
  etiket: string
  cizgi?: boolean
  children: ReactNode
}) {
  return (
    <div className={`flex min-w-0 gap-1.5 px-1.5 ${cizgi ? 'border-l border-cizgi/80' : ''}`}>
      <span className="mt-[9px] shrink-0 text-[#4a463e]">{ikon}</span>
      <div className="min-w-0 leading-[17px]">
        <div className="truncate text-[12px] text-soluk">{etiket}</div>
        <div className="text-[14px] font-semibold whitespace-nowrap">{children}</div>
      </div>
    </div>
  )
}
