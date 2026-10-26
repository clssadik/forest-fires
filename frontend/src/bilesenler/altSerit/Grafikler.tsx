import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { gunAy, sayi } from '../../bicim'
import { useZaman } from '../../durum/zaman'
import type { OlayVerisi } from '../../olay/veri'
import { CizgiGrafigi } from './CizgiGrafigi'
import { TEMALAR } from './grafikTemalari'

const SAAT = 3_600_000

/**
 * Üç küçük grafik (docs/02 §5.5): modelin yanan alanı, baş cephe yayılma hızı ve ana yayılım
 * ekseni boyunca yükseklik profili (imleç: cephenin eksende vardığı yer).
 */
export function Grafikler({ veri }: { veri: OlayVerisi }) {
  const { t } = useTranslation()
  const baslangic = useZaman((d) => d.baslangic)
  const bitis = useZaman((d) => d.bitis)
  const zaman = useZaman((d) => d.t)

  const { alan, hiz, gunTikleri, alanUst, hizUst } = useMemo(() => {
    const alan: { x: number; y: number }[] = []
    const hiz: { x: number; y: number }[] = []
    for (let x = baslangic; x <= bitis; x += SAAT / 2) {
      alan.push({ x, y: veri.yananAlanHa(x) })
      hiz.push({ x, y: veri.hizMDk(x) })
    }
    // Her iki günde bir gün etiketi (yerel 00:00).
    const gunTikleri: { x: number; etiket: string }[] = []
    let x = Math.ceil((baslangic + 3 * SAAT) / (24 * SAAT)) * 24 * SAAT - 3 * SAAT
    for (let i = 0; x <= bitis; x += 24 * SAAT, i++) if (i % 2 === 0) gunTikleri.push({ x, etiket: gunAy(x) })
    const alanUst = yuvarlaYukari(Math.max(...alan.map((p) => p.y)) * 1.05)
    const hizUst = yuvarlaYukari(Math.max(...hiz.map((p) => p.y)) * 1.1)
    return { alan, hiz, gunTikleri, alanUst, hizUst }
  }, [baslangic, bitis, veri])

  const profil = useMemo(() => veri.profil.map((p) => ({ x: p.km, y: p.hM })), [veri])
  const profilKm = Math.max(veri.bilgi.eksen?.uzunluk_km ?? 1, 1)
  const profilAlan = useMemo<[number, number]>(() => {
    const ys = profil.map((p) => p.y)
    if (!ys.length) return [0, 100]
    const alt = Math.floor(Math.min(...ys) / 100) * 100
    return [alt, Math.max(Math.ceil(Math.max(...ys) / 100) * 100, alt + 100)]
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
        xAlan={[0, profilKm]}
        yAlan={profilAlan}
        xTikler={profilTikleri(profilKm).map((k, i, d) => ({
          x: k,
          etiket: i === d.length - 1 ? t('grafikler.km', { deger: k }) : String(k),
        }))}
        yTikler={ucluTik(profilAlan[1], profilAlan[0])}
        imlec={veri.eksendeCepheKm(zaman)}
        tema={TEMALAR.profil}
        kirmiziNokta
      />
    </div>
  )
}

/** Profil ekseninde en fazla ~6 km tiki (5 ya da 10 km'de bir). */
function profilTikleri(uzunluk: number) {
  const adim = uzunluk > 30 ? 10 : 5
  return Array.from({ length: Math.floor(uzunluk / adim) + 1 }, (_, i) => i * adim)
}

/** Eksen üst sınırı için "güzel" yuvarlama (1, 2, 2.5, 5 × 10^n). */
function yuvarlaYukari(v: number) {
  if (v <= 0) return 1
  const us = 10 ** Math.floor(Math.log10(v))
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * us >= v) return k * us
  return 10 * us
}
