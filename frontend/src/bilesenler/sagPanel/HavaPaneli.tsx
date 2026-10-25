import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { sayi, yuzdeBicim } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import { havaDurumu, pusulaYonu } from '../../model/hava'
import { olay } from '../../veri/ornekSenaryo'
import { IkonAlev, IkonAlevBoyu, IkonDamla, IkonRuzgar, IkonTermometre, IkonUcNokta, IkonYaprak } from '../ikonlar'
import { Kart } from './Kart'

/** Hava ve Yangın Davranışı kartı; değerler global zamandan türetilir (docs/02 §5.4, §9). */
export function HavaPaneli() {
  const { t } = useTranslation()
  // Saatlik değerler: yalnızca saat değişince yeniden çiz.
  const saatDilimi = useZaman((d) => Math.floor(d.t / 3_600_000))
  const h = havaDurumu(saatDilimi * 3_600_000)
  const basladi = saatDilimi * 3_600_000 >= olay.baslangic

  return (
    <Kart
      baslik={t('hava.baslik')}
      ek={t('hava.kaynakCephe')}
      sag={
        <button type="button" className="grid size-6 place-items-center rounded hover:bg-black/5" title={t('hava.secenekler')}>
          <IkonUcNokta boyut={14} />
        </button>
      }
    >
      <div className="grid grid-cols-[1.1fr_0.86fr_1.04fr] px-1.5 pt-2.5 pb-2">
        <Deger ikon={<IkonRuzgar boyut={17} />} etiket={t('hava.ruzgar')}>
          {t('hava.kmSa', { deger: h.ruzgarKmSa })}
          <span className="block font-normal">
            {t('hava.yon', { yon: pusulaYonu(h.ruzgarYonu), derece: h.ruzgarYonu })}
          </span>
        </Deger>
        <Deger ikon={<IkonTermometre boyut={17} />} etiket={t('hava.sicaklik')} cizgi>
          {t('hava.derece', { deger: h.sicaklik })}
        </Deger>
        <Deger ikon={<IkonDamla boyut={17} className="text-[#3f7fc0]" />} etiket={t('hava.nem')} cizgi>
          {yuzdeBicim(h.nem / 100)}
        </Deger>
        <div className="col-span-3 my-2 border-t border-cizgi/80" />
        <Deger ikon={<IkonYaprak boyut={18} className="text-[#55634a]" />} etiket={t('hava.yakitNemi')}>
          {yuzdeBicim(h.yakitNemi / 100)}
        </Deger>
        <Deger ikon={<IkonAlev boyut={18} className="text-ates" />} etiket={t('hava.erc')} cizgi>
          {h.erc}
        </Deger>
        <Deger ikon={<IkonAlevBoyu boyut={17} className="text-ates" />} etiket={t('hava.alevBoyu')} cizgi>
          {!basladi
            ? t('hava.baslamadi')
            : h.alevBoyu
              ? t('hava.aralikM', { min: sayi(h.alevBoyu[0], 1), max: sayi(h.alevBoyu[1], 1) })
              : t('hava.sondu')}
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
