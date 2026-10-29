import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { notOku, notYaz } from '../../olay/notlar'

/** Notlar sekmesi: modelin bilinen sınırları ve kullanıcının yangın başına notu (yalnızca tarayıcıda). */
export function NotlarSekmesi({ ad }: { ad: string }) {
  const { t } = useTranslation()
  const sinirlar = t('sagPanel.notlar.sinirListesi', { returnObjects: true }) as string[]

  return (
    <div className="space-y-3 px-3 pt-2.5 pb-3 text-[12px] leading-[16px]">
      <section>
        <h3 className="mb-1 font-semibold">{t('sagPanel.notlar.sinirlar')}</h3>
        <ul className="list-disc space-y-1 pl-4">
          {sinirlar.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      {/* Yangın değişince not alanı baştan kurulsun (key). */}
      <NotAlani key={ad} ad={ad} />
    </div>
  )
}

function NotAlani({ ad }: { ad: string }) {
  const { t } = useTranslation()
  const [metin, setMetin] = useState(() => notOku(ad))
  const [saklandi, setSaklandi] = useState(true)

  return (
    <section>
      <label htmlFor="olay-notu" className="mb-1 block font-semibold">
        {t('sagPanel.notlar.notlarim')}
      </label>
      <textarea
        id="olay-notu"
        value={metin}
        onChange={(e) => {
          setMetin(e.target.value)
          setSaklandi(notYaz(ad, e.target.value))
        }}
        placeholder={t('sagPanel.notlar.yerTutucu')}
        rows={7}
        className="w-full resize-y rounded-[4px] border border-cizgi bg-[#ece8dd] px-2 py-1.5 text-[12.5px] placeholder:text-silik focus:border-soluk focus:outline-none"
      />
      <p className={saklandi ? 'text-soluk' : 'text-ates'}>
        {t(saklandi ? 'sagPanel.notlar.saklama' : 'sagPanel.notlar.saklanamiyor')}
      </p>
    </section>
  )
}
