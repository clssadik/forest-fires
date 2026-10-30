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
        <ol className="space-y-2">
          {sinirlar.map((s, i) => (
            <li key={s.baslik} className="flex gap-3 rounded-[10px] bg-yuzey p-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zemin/60 text-[12px] leading-4 font-semibold text-ikincil tabular-nums">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-[18px] font-semibold">{s.baslik}</span>
                <span className="mt-0.5 block text-[12.5px] leading-[18px] text-ikincil">{s.metin}</span>
              </span>
            </li>
          ))}
        </ol>
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
        rows={7}
        className="block w-full resize-y rounded-[10px] border border-transparent bg-yuzey px-3 py-2.5 text-[13px] leading-[19px] placeholder:text-soluk focus:border-eksen focus:outline-none"
      />
      <p className={`mt-2 text-[12px] leading-4 ${saklandi ? 'text-ikincil' : 'text-ates-acik'}`}>
        {t(saklandi ? 'sagPanel.notlar.saklama' : 'sagPanel.notlar.saklanamiyor')}
      </p>
    </Bolum>
  )
}
