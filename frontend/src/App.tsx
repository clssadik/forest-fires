import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sahne } from './sahne/Sahne'

type SunucuDurumu = 'kontrol' | 'bagli' | 'bagliDegil'

function App() {
  const { t } = useTranslation()
  const [sunucu, setSunucu] = useState<SunucuDurumu>('kontrol')

  useEffect(() => {
    fetch('/api/saglik')
      .then((y) => setSunucu(y.ok ? 'bagli' : 'bagliDegil'))
      .catch(() => setSunucu('bagliDegil'))
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-cizgi bg-panel px-4 py-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-base font-semibold">{t('uygulama.ad')}</h1>
          <span className="text-sm text-soluk">{t('uygulama.altBaslik')}</span>
        </div>
        <span className="flex items-center gap-2 text-sm text-soluk">
          <span
            className={`size-2 rounded-full ${sunucu === 'bagli' ? 'bg-green-600' : sunucu === 'bagliDegil' ? 'bg-ates' : 'bg-soluk'}`}
          />
          {t(`sunucu.${sunucu}`)}
        </span>
      </header>
      <main className="relative flex-1">
        <Sahne />
        <p className="absolute bottom-3 left-3 rounded bg-panel/90 px-3 py-1.5 text-sm text-soluk">
          {t('sahne.yerTutucu')}
        </p>
      </main>
    </div>
  )
}

export default App
