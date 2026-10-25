import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, sayi } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import { PROFIL_UZUNLUK_KM, yukseklikProfili } from '../../model/profil'
import { cepheMesafesiM, yananAlanHa, yayilmaHiziMDk } from '../../model/yayilim'
import { CizgiGrafigi } from './CizgiGrafigi'
import { TEMALAR } from './grafikTemalari'

const SAAT = 3_600_000

/** Üç küçük grafik: yanan alan, yayılma hızı, yükseklik profili (docs/02 §5.5). */
export function Grafikler() {
  const { t } = useTranslation()
  const baslangic = useZaman((d) => d.baslangic)
  const bitis = useZaman((d) => d.bitis)
  const zaman = useZaman((d) => d.t)

  const { alan, hiz, gunTikleri, alanUst, hizUst } = useMemo(() => {
    const alan: { x: number; y: number }[] = []
    const hiz: { x: number; y: number }[] = []
    for (let x = baslangic; x <= bitis; x += SAAT / 2) {
      alan.push({ x, y: yananAlanHa(x) })
      hiz.push({ x, y: yayilmaHiziMDk(x) })
    }
    // Her iki günde bir gün etiketi (yerel 00:00).
    const gunTikleri: { x: number; etiket: string }[] = []
    let x = Math.ceil((baslangic + 3 * SAAT) / (24 * SAAT)) * 24 * SAAT - 3 * SAAT
    for (let i = 0; x <= bitis; x += 24 * SAAT, i++) if (i % 2 === 0) gunTikleri.push({ x, etiket: gunAy(x) })
    const alanUst = yuvarlaYukari(Math.max(...alan.map((p) => p.y)) * 1.05)
    const hizUst = yuvarlaYukari(Math.max(...hiz.map((p) => p.y)) * 1.1)
    return { alan, hiz, gunTikleri, alanUst, hizUst }
  }, [baslangic, bitis])

  const profil = useMemo(() => yukseklikProfili().map((p) => ({ x: p.km, y: p.hM })), [])
  const profilAlan = useMemo<[number, number]>(() => {
    const ys = profil.map((p) => p.y)
    return [Math.floor(Math.min(...ys) / 100) * 100, Math.ceil(Math.max(...ys) / 100) * 100]
  }, [profil])

  const ucluTik = (ust: number, alt = 0) =>
    [alt, (alt + ust) / 2, ust].map((y) => ({ y, etiket: sayi(y) }))

  return (
    <div className="flex min-h-0 flex-1">
      <CizgiGrafigi
        baslik={
          <>
            {t('grafikler.yananAlan')} <span className="text-soluk">{t('grafikler.yananAlanBirim')}</span>
          </>
        }
        veri={alan}
        xAlan={[baslangic, bitis]}
        yAlan={[0, alanUst]}
        xTikler={gunTikleri}
        yTikler={[0, 1, 2, 3].map((i) => ({ y: (alanUst * i) / 3, etiket: sayi((alanUst * i) / 3) }))}
        imlec={zaman}
        tema={TEMALAR.alan}
      />
      <CizgiGrafigi
        baslik={
          <>
            {t('grafikler.yayilmaHizi')} <span className="text-soluk">{t('grafikler.yayilmaHiziBirim')}</span>
          </>
        }
        veri={hiz}
        xAlan={[baslangic, bitis]}
        yAlan={[0, hizUst]}
        xTikler={gunTikleri}
        yTikler={ucluTik(hizUst)}
        imlec={zaman}
        tema={TEMALAR.hiz}
      />
      <CizgiGrafigi
        baslik={
          <>
            {t('grafikler.profil')} <span className="text-soluk">{t('grafikler.profilAlt')}</span>
          </>
        }
        veri={profil}
        xAlan={[0, PROFIL_UZUNLUK_KM]}
        yAlan={profilAlan}
        xTikler={[0, 5, 10, 15, 20, 25]
          .filter((k) => k <= PROFIL_UZUNLUK_KM)
          .map((k) => ({ x: k, etiket: k === 25 ? t('grafikler.km', { deger: k }) : String(k) }))}
        yTikler={ucluTik(profilAlan[1], profilAlan[0])}
        imlec={cepheMesafesiM(zaman) / 1000}
        tema={TEMALAR.profil}
        kirmiziNokta
      />
    </div>
  )
}

/** Eksen üst sınırı için "güzel" yuvarlama (1, 2, 2.5, 5 × 10^n). */
function yuvarlaYukari(v: number) {
  if (v <= 0) return 1
  const us = 10 ** Math.floor(Math.log10(v))
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * us >= v) return k * us
  return 10 * us
}
