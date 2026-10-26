import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { tutusmaMs, useDogrulama } from '../../durum/dogrulama'
import { ZamanCubugu } from '../altSerit/ZamanCubugu'
import { BuyumeGrafigi } from './BuyumeGrafigi'
import { DogrulamaHaritasi } from './DogrulamaHaritasi'
import { DogrulamaPaneli } from './DogrulamaPaneli'

const SAAT = 3_600_000

/** Doğrulama ekranı: gerçek veriyle 2B harita, zaman çubuğu + yanan alan grafiği, ölçüt paneli. */
export function DogrulamaEkrani() {
  const { t } = useTranslation()
  const yukleme = useDogrulama((d) => d.yukleme)
  const hata = useDogrulama((d) => d.hata)
  const bilgi = useDogrulama((d) => d.bilgi)
  const sonuc = useDogrulama((d) => d.sonuc)

  useEffect(() => {
    const d = useDogrulama.getState()
    if (d.yukleme === 'hazir') d.zamaniKur()
    else void d.yukle()
  }, [])

  // Zaman çubuğundaki bant: modelin 2 saatlik büyüme hızı (ha/sa); tutuşma işareti.
  // Bu bileşen yalnızca veri değişince yeniden çizilir; zamanla değil.
  const yogunluk = (x: number) => {
    if (!sonuc || !bilgi) return 0
    const { buyume_saatleri: s, buyume_ha: h } = sonuc
    const saat = (x - tutusmaMs(bilgi)) / SAAT
    const i = s.findIndex((v) => v >= saat)
    return i > 0 ? (h[i] - h[i - 1]) / (s[i] - s[i - 1]) : 0
  }
  const olaylar = bilgi ? [{ tur: 'tutusma' as const, zaman: tutusmaMs(bilgi) }] : []

  if (yukleme === 'hata')
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-[14px] font-semibold">{t('dogrulama.yuklenemedi')}</p>
          <p className="mt-1 text-[12.5px] text-soluk">{hata}</p>
        </div>
      </div>
    )

  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col">
        {bilgi ? (
          <DogrulamaHaritasi />
        ) : (
          <div className="grid flex-1 place-items-center text-[13px] text-soluk">{t('dogrulama.yukleniyor')}</div>
        )}
        <div className="flex h-[228px] shrink-0 flex-col border-t border-cizgi bg-panel">
          <ZamanCubugu yogunluk={yogunluk} olaylar={olaylar} />
          <BuyumeGrafigi />
        </div>
      </main>
      <DogrulamaPaneli />
    </div>
  )
}
