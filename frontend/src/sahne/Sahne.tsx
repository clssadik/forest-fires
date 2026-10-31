import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useMemo, useState } from 'react'
import { MathUtils } from 'three'
import { useHarita } from '../durum/harita'
import { etkinOpaklik, useKatmanlar } from '../durum/katmanlar'
import { useZaman } from '../durum/zaman'
import type { OlayVerisi } from '../olay/veri'
import { Agaclar } from './Agaclar'
import { Arazi } from './Arazi'
import { Bulutlar } from './Bulutlar'
import { Cevre } from './cevre'
import { CevreArazisi } from './CevreArazisi'
import { GecisNoktalari } from './GecisNoktalari'
import { Gokyuzu } from './Gokyuzu'
import { KameraKontrol } from './KameraKontrol'
import { RuzgarCizgileri } from './RuzgarCizgileri'
import { SeciliOlayIsareti } from './SeciliOlayIsareti'
import { YanginEfektleri } from './YanginEfektleri'
import { YayilimIsaretleri } from './YayilimIsaretleri'
import { yanginUniformlari as U } from './yanginMalzemesi'

/** Global zamanı, rüzgârı ve katman opaklıklarını gölgelendirici uniform'larına aktarır. */
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
    const k = useKatmanlar.getState().katmanlar
    U.uT.value = (t - tutusmaMs) / 3_600_000
    const yumusat = (u: { value: number }, hedef: number) => {
      u.value = MathUtils.damp(u.value, hedef, 10, dt)
    }
    yumusat(U.uYanikIzi, etkinOpaklik(k, 'yanikIzi'))
    yumusat(U.uYayilim, etkinOpaklik(k, 'yayilim'))
    yumusat(U.uOlasilik, etkinOpaklik(k, 'olasilik'))
    yumusat(U.uGoruntu, etkinOpaklik(k, 'goruntu'))
    yumusat(U.uFirms, etkinOpaklik(k, 'firms'))
    yumusat(U.uIzokron, etkinOpaklik(k, 'izokron'))
    yumusat(U.uHata, etkinOpaklik(k, 'hata'))
    yumusat(U.uArazi, etkinOpaklik(k, 'arazi') > 0 ? 1 : 0)
    // Arazi (3B) kapalıyken kabartma düzleşir; kaydırıcı kabartma şiddetidir.
    yumusat(U.uKabartma, Math.max(etkinOpaklik(k, 'arazi'), 0.02))
  })
  return null
}

/**
 * Ana 3B sahne: gerçek DEM arazisi ve çevresindeki sahte arazi, örtüden ağaçlar, model yangını
 * (alev ve duman), zamana bağlı gökyüzü ve bulutlar, rüzgâr, eksen etiketleri.
 */
export function Sahne({ veri }: { veri: OlayVerisi }) {
  const katmanlar = useKatmanlar((d) => d.katmanlar)
  const kip = useHarita((d) => d.kip)
  const ruzgar = etkinOpaklik(katmanlar, 'ruzgar')
  const goruntu = etkinOpaklik(katmanlar, 'goruntu') > 0
  const yayilim = etkinOpaklik(katmanlar, 'yayilim') > 0
  const kabartma = Math.max(etkinOpaklik(katmanlar, 'arazi'), 0.02)
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
      <Agaclar veri={veri} cevre={cevre} gorunur={goruntu} />
      <YanginEfektleri veri={veri} gorunur={kip === '3B' && yayilim} />
      {kip === '3B' && <Bulutlar />}
      <RuzgarCizgileri veri={veri} opaklik={ruzgar} />
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
