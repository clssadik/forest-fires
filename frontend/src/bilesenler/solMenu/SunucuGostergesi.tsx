import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

type SunucuDurumu = 'kontrol' | 'bagli' | 'bagliDegil'

/** Arka uç sağlık kontrolü; üst barda küçük bir nokta olarak gösterilir. */
export function SunucuGostergesi() {
  const { t } = useTranslation()
  const [durum, setDurum] = useState<SunucuDurumu>('kontrol')

  useEffect(() => {
    fetch('/api/saglik')
      .then((y) => setDurum(y.ok ? 'bagli' : 'bagliDegil'))
      .catch(() => setDurum('bagliDegil'))
  }, [])

  const renk = durum === 'bagli' ? 'bg-[#5d8a4f]' : durum === 'bagliDegil' ? 'bg-[#c08a6a]' : 'bg-silik'
  return (
    <span className="grid size-7 place-items-center" title={t(`sunucu.${durum}`)} role="status">
      <span className={`size-[7px] rounded-full ${renk}`} />
      <span className="sr-only">{t(`sunucu.${durum}`)}</span>
    </span>
  )
}
