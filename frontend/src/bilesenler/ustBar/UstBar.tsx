import { useTranslation } from 'react-i18next'

/** Üst bar: yalnızca ortada logo yazısı. Gezinme ve olay seçimi sol rayda (`SolMenu`). */
export function UstBar() {
  const { t } = useTranslation()
  return (
    <header className="flex h-11 shrink-0 items-center justify-center border-b border-cizgi bg-ust">
      <h1 className="text-[19px] font-bold tracking-[0.14em] text-white">{t('uygulama.logo')}</h1>
    </header>
  )
}
