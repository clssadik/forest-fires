import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notOku, notYaz } from '../../olay/notlar'
import { Bolum } from './ortak'

/** Notlar sekmesi: modelin bilinen sınırları ve kullanıcının yangın başına notu (yalnızca tarayıcıda). */
export function NotlarSekmesi({ ad }: { ad: string }) {
  const { t } = useTranslation()
  const sinirlar = t('sagPanel.notlar.sinirListesi', { returnObjects: true }) as { baslik: string; metin: string }[]

  return (
    <>
      <Bolum baslik={t('sagPanel.notlar.sinirlar')}>
        <ul className="space-y-3">
          {sinirlar.map((s) => (
            <li key={s.baslik}>
              <div className="text-[13px] leading-[18px] font-medium">{s.baslik}</div>
              <div className="mt-0.5 text-[12.5px] leading-[18px] text-ikincil">{s.metin}</div>
            </li>
          ))}
        </ul>
      </Bolum>
      {/* Yangın değişince not alanı baştan kurulsun (key). */}
      <NotAlani key={ad} ad={ad} />
    </>
  )
}

function NotAlani({ ad }: { ad: string }) {
  const { t } = useTranslation()
  const [metin, setMetin] = useState(() => notOku(ad))
  const [saklandi, setSaklandi] = useState(true)

  return (
    <Bolum baslik={<label htmlFor="olay-notu">{t('sagPanel.notlar.notlarim')}</label>}>
      <textarea
        id="olay-notu"
        value={metin}
        onChange={(e) => {
          setMetin(e.target.value)
          setSaklandi(notYaz(ad, e.target.value))
        }}
        placeholder={t('sagPanel.notlar.yerTutucu')}
        title={t('sagPanel.notlar.saklama')}
        rows={7}
        className="block w-full resize-y rounded-[10px] border border-transparent bg-yuzey px-3 py-2.5 text-[13px] leading-[19px] placeholder:text-soluk focus:border-eksen focus:outline-none"
      />
      {!saklandi && <p className="mt-2 text-[12px] leading-4 text-ates-acik">{t('sagPanel.notlar.saklanamiyor')}</p>}
    </Bolum>
  )
}
