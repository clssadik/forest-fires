import { Canvas, useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useEffect, useState } from 'react'
import { MathUtils } from 'three'
import { useHarita } from '../durum/harita'
import { etkinOpaklik, useKatmanlar } from '../durum/katmanlar'
import { useZaman } from '../durum/zaman'
import { olay } from '../veri/ornekSenaryo'
import { Agaclar } from './Agaclar'
import { Arazi } from './Arazi'
import { Gokyuzu } from './Gokyuzu'
import { KameraKontrol } from './KameraKontrol'
import { RuzgarCizgileri } from './RuzgarCizgileri'
import { Su } from './Su'
import { YayilimIsaretleri } from './YayilimIsaretleri'
import { yanginUniformlari as U } from './yanginMalzemesi'
import { YerEtiketleri } from './YerEtiketleri'

const SIS_RENGI = '#cfd0c8'

/** Global zamanı ve katman opaklıklarını gölgelendirici uniform'larına aktarır. */
function UniformGuncelleyici() {
  useFrame((_, dt) => {
    const t = useZaman.getState().t
    const k = useKatmanlar.getState().katmanlar
    U.uT.value = (t - olay.baslangic) / 3_600_000
    const yumusat = (u: { value: number }, hedef: number) => {
      u.value = MathUtils.damp(u.value, hedef, 10, dt)
    }
    yumusat(U.uYanikIzi, etkinOpaklik(k, 'yanikIzi'))
    yumusat(U.uYayilim, etkinOpaklik(k, 'yayilim'))
    yumusat(U.uOlasilik, etkinOpaklik(k, 'olasilik'))
    yumusat(U.uGoruntu, etkinOpaklik(k, 'goruntu'))
    yumusat(U.uArazi, etkinOpaklik(k, 'arazi') > 0 ? 1 : 0)
    // Arazi (3B) kapalıyken kabartma düzleşir; kaydırıcı kabartma şiddetidir.
    yumusat(U.uKabartma, Math.max(etkinOpaklik(k, 'arazi'), 0.02))
  })
  return null
}

/** Ana 3B sahne: prosedürel arazi, ağaçlar, yangın, rüzgâr, etiketler. */
export function Sahne() {
  const katmanlar = useKatmanlar((d) => d.katmanlar)
  const kip = useHarita((d) => d.kip)
  const ruzgar = etkinOpaklik(katmanlar, 'ruzgar')
  const goruntu = etkinOpaklik(katmanlar, 'goruntu') > 0
  const yayilim = etkinOpaklik(katmanlar, 'yayilim') > 0
  const kabartma = Math.max(etkinOpaklik(katmanlar, 'arazi'), 0.02)

  // Etiketler için kabartmayı yumuşak geçişten sonra güncelle (uniform zaten yumuşak).
  const [etiketKabartma, setEtiketKabartma] = useState(kabartma)
  useEffect(() => {
    const z = setTimeout(() => setEtiketKabartma(kabartma), 350)
    return () => clearTimeout(z)
  }, [kabartma])

  return (
    <Canvas flat dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }} className="!absolute inset-0">
      <color attach="background" args={[SIS_RENGI]} />
      {/* 2B'de kamera çok yüksekte; sis yalnızca 3B'de */}
      <fog attach="fog" args={kip === '3B' ? [SIS_RENGI, 30, 115] : [SIS_RENGI, 1000, 2000]} />
      <hemisphereLight args={['#f1ede2', '#5f4e3a', 0.65]} />
      <directionalLight position={[-30, 22, 26]} intensity={3.2} color="#fff0d6" />

      <Gokyuzu />
      <Arazi />
      <Agaclar gorunur={goruntu} />
      <Su />
      <RuzgarCizgileri opaklik={ruzgar} />
      {yayilim && <YayilimIsaretleri kabartma={etiketKabartma} />}
      <YerEtiketleri kabartma={etiketKabartma} />

      <UniformGuncelleyici />
      <KameraKontrol />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.75} luminanceThreshold={0.92} luminanceSmoothing={0.15} />
      </EffectComposer>
    </Canvas>
  )
}
