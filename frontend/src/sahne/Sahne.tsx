import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useState } from 'react'
import { MathUtils } from 'three'
import { useHarita } from '../durum/harita'
import { katmanGucleri, useKatmanlar } from '../durum/katmanlar'
import { useZaman } from '../durum/zaman'
import type { OlayVerisi } from '../olay/veri'
import { Agaclar } from './Agaclar'
import { Arazi } from './Arazi'
import { Bulutlar } from './Bulutlar'
import { Cevre } from './cevre'
import { CevreArazisi } from './CevreArazisi'
import { FirmsNoktalari } from './FirmsNoktalari'
import { GecisNoktalari } from './GecisNoktalari'
import { Gokyuzu } from './Gokyuzu'
import { KameraKontrol } from './KameraKontrol'
import { RuzgarCizgileri } from './RuzgarCizgileri'
import { SeciliOlayIsareti } from './SeciliOlayIsareti'
import { YanginEfektleri } from './YanginEfektleri'
import { YayilimIsaretleri } from './YayilimIsaretleri'
import { yanginUniformlari as U } from './yanginMalzemesi'

/** 2B görünümde arazinin kalan kabartması. */
const DUZ_KABARTMA = 0.02

/** Global zamanı, rüzgârı ve katman güçlerini gölgelendirici uniform'larına aktarır. */
function UniformGuncelleyici({ veri }: { veri: OlayVerisi }) {
  useFrame((_, dt) => {
    U.uHataEsik.value = veri.bilgi.model.esit_alan_esik_dk / 60
    U.uZaman.value += Math.min(dt, 0.1)
    const t = useZaman.getState().t
    const tutusmaMs = veri.tutusmaMs
    // Rüzgâr: verideki yön "geldiği yer"; estiği yön tersidir. Kuzey −z.
    const h = veri.hava(t)
    const a = (h.ruzgarYonu * Math.PI) / 180
    const guc = h.ruzgarKmSa / 40
    U.uRuzgar.value.x = MathUtils.damp(U.uRuzgar.value.x, -Math.sin(a) * guc, 2, dt)
    U.uRuzgar.value.y = MathUtils.damp(U.uRuzgar.value.y, Math.cos(a) * guc, 2, dt)
    const { mod, anahtarlar } = useKatmanlar.getState()
    const g = katmanGucleri(mod, anahtarlar)
    U.uT.value = (t - tutusmaMs) / 3_600_000
    const yumusat = (u: { value: number }, hedef: number) => {
      u.value = MathUtils.damp(u.value, hedef, 10, dt)
    }
    yumusat(U.uGercekSinir, g.gercekSinir)
    yumusat(U.uYayilim, g.yayilim)
    yumusat(U.uOlasilik, g.olasilik)
    yumusat(U.uFirms, g.firms)
    yumusat(U.uIzokron, g.izokron)
    yumusat(U.uHata, g.hata)
    // 2B'de kabartma düzleşir.
    yumusat(U.uKabartma, useHarita.getState().kip === '3B' ? 1 : DUZ_KABARTMA)
  })
  return null
}

/**
 * Ana 3B sahne: gerçek DEM arazisi ve çevresindeki sahte arazi, örtüden ağaçlar, model yangını
 * (alev ve duman), zamana bağlı gökyüzü ve bulutlar, rüzgâr, eksen etiketleri.
 */
export function Sahne({ veri }: { veri: OlayVerisi }) {
  const mod = useKatmanlar((d) => d.mod)
  const anahtarlar = useKatmanlar((d) => d.anahtarlar)
  const kip = useHarita((d) => d.kip)
  const gucler = katmanGucleri(mod, anahtarlar)
  const yayilim = gucler.yayilim > 0
  const kabartma = kip === '3B' ? 1 : DUZ_KABARTMA
  const cevre = useMemo(() => new Cevre(veri), [veri])

  // Etiketler için kabartmayı yumuşak geçişten sonra güncelle (uniform zaten yumuşak).
  const [etiketKabartma, setEtiketKabartma] = useState(kabartma)
  useEffect(() => {
    const z = setTimeout(() => setEtiketKabartma(kabartma), 350)
    return () => clearTimeout(z)
  }, [kabartma])

  return (
    <Canvas flat dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: 'high-performance' }} className="!absolute inset-0">
      <Gokyuzu veri={veri} />
      <Arazi veri={veri} />
      <CevreArazisi veri={veri} cevre={cevre} />
      <Agaclar veri={veri} cevre={cevre} gorunur={gucler.agaclar} />
      <YanginEfektleri veri={veri} gorunur={kip === '3B' && yayilim} duman={gucler.duman > 0} />
      {kip === '3B' && <Bulutlar />}
      <RuzgarCizgileri veri={veri} opaklik={gucler.ruzgar} />
      <FirmsNoktalari veri={veri} />
      {yayilim && <YayilimIsaretleri veri={veri} kabartma={etiketKabartma} />}
      <GecisNoktalari veri={veri} />
      <SeciliOlayIsareti veri={veri} kabartma={etiketKabartma} />

      <UniformGuncelleyici veri={veri} />
      <KameraKontrol veri={veri} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.92} luminanceSmoothing={0.15} />
      </EffectComposer>
    </Canvas>
  )
}
