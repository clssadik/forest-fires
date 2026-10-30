import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, Vector3 } from 'three'
import { useHarita } from '../durum/harita'
import { useZaman } from '../durum/zaman'
import type { OlayVerisi } from '../olay/veri'
import { gokRenkleri, gunesKonumu, gunesYonu } from './gunes'
import { yanginUniformlari as U } from './yanginMalzemesi'

/**
 * Atmosfer: gökyüzü kubbesi, güneş/ay ışığı, yarıküre ışığı ve sis. Güneşin yeri global
 * zamandan ve yangının enlem/boylamından hesaplanır; zaman kaydırıcısı gün batımını ve geceyi
 * getirir. Yangın büyürken hava dumanla bulanıklaşır (ufuk kahverengiye çalar).
 * Sis rengi ufukla aynıdır: çevre arazisinin uzak ucu ufkun içinde kaybolur.
 */

/** Dumanlı havanın ufuk rengi (ışıkla çarpılır). */
const DUMAN_RENGI = new Color('#9a7458')
/** Bulanıklığın tam olduğu yanma hızı (ha/sa). */
const DUMAN_DOYGUNLUK_HA_SA = 2500

export function Gokyuzu({ veri }: { veri: OlayVerisi }) {
  const kip = useHarita((d) => d.kip)
  const { scene } = useThree()
  const gunes = useRef<DirectionalLight>(null)
  const ortam = useRef<HemisphereLight>(null)
  const { enlem, boylam } = useMemo(() => veri.konum(0, 0), [veri])
  const durum = useMemo(
    () => ({
      renk: gokRenkleri(30),
      yon: new Vector3(),
      isikYonu: new Vector3(),
      sis: new Fog('#000000', 30, 95),
      gece: 0,
      dumanli: 0,
    }),
    [],
  )
  const uniformlar = useMemo(
    () => ({
      uTepe: { value: new Color() },
      uUfuk: { value: new Color() },
      uGunes: { value: new Vector3(0, 1, 0) },
      uIsik: { value: new Color() },
      uGece: { value: 0 },
    }),
    [],
  )

  useFrame(({ camera, controls }, dt) => {
    const t = useZaman.getState().t
    const g = gunesKonumu(t, enlem, boylam)
    const r = gokRenkleri(g.yukseklik, durum.renk)
    durum.yon.set(...gunesYonu(g))

    // Son bir saatteki yanma hızı → dumanlı hava
    const hiz = veri.yananAlanHa(t) - veri.yananAlanHa(t - 3_600_000)
    const hedefDuman = Math.min(Math.max(hiz / DUMAN_DOYGUNLUK_HA_SA, 0), 1) * U.uYayilim.value
    durum.dumanli += (hedefDuman - durum.dumanli) * Math.min(dt * 2, 1)
    const isikParlakligi = Math.min(r.isikSiddeti / 2.5, 1)
    r.ufuk.lerp(DUMAN_RENGI.clone().multiplyScalar(0.25 + 0.75 * isikParlakligi), durum.dumanli * 0.2)
    r.tepe.lerp(r.ufuk, durum.dumanli * 0.1)

    uniformlar.uTepe.value.copy(r.tepe)
    uniformlar.uUfuk.value.copy(r.ufuk)
    uniformlar.uGunes.value.copy(durum.yon)
    uniformlar.uIsik.value.copy(r.isik)
    durum.gece = Math.min(Math.max((-g.yukseklik - 4) / 8, 0), 1)
    uniformlar.uGece.value = durum.gece

    U.uGunesYonu.value.copy(durum.yon)
    U.uUfuk.value.copy(r.ufuk)
    U.uGok.value.copy(r.tepe)
    U.uIsikRengi.value.copy(r.isik).multiplyScalar(r.isikSiddeti / 3)
    U.uOrtamRengi.value.copy(r.ortamGok).multiplyScalar(r.ortamSiddeti)
    U.uDuman.value = durum.dumanli
    U.uGece.value = durum.gece

    // Işık: gündüz güneşten, gece ayın yerinden (güneşin karşısı, en az 35° yüksekte).
    const isik = gunes.current
    if (isik) {
      if (g.yukseklik > -4) durum.isikYonu.copy(durum.yon)
      else durum.isikYonu.set(-durum.yon.x, Math.max(-durum.yon.y, 0.6), -durum.yon.z).normalize()
      // Ufka çok yakın ışık arazide uzun, gerçekdışı gölge çizgileri bırakır.
      durum.isikYonu.y = Math.max(durum.isikYonu.y, 0.12)
      durum.isikYonu.normalize()
      isik.position.copy(durum.isikYonu).multiplyScalar(100)
      isik.color.copy(r.isik)
      isik.intensity = r.isikSiddeti * (1 - durum.dumanli * 0.3)
    }
    if (ortam.current) {
      ortam.current.color.copy(r.ortamGok)
      ortam.current.groundColor.copy(r.ortamZemin)
      ortam.current.intensity = r.ortamSiddeti
    }

    // Sis: bakılan noktaya uzaklıkla ölçeklenir; çevrenin uzak ucu her zaman sisin içinde.
    const hedef = (controls as unknown as { target?: Vector3 } | null)?.target
    const uzaklik = hedef ? camera.position.distanceTo(hedef) : 25
    if (kip === '3B') {
      durum.sis.near = uzaklik * (1.6 - durum.dumanli * 0.3) + 10
      durum.sis.far = uzaklik * 1.5 + 140 - durum.dumanli * 20
    } else {
      durum.sis.near = 1000
      durum.sis.far = 2000
    }
    durum.sis.color.copy(r.ufuk)
    scene.fog = durum.sis
    scene.background = durum.sis.color
  })

  return (
    <>
      <hemisphereLight ref={ortam} />
      <directionalLight ref={gunes} />
      {/* Kubbe kamerayla taşınır ve en uzak derinliğe çizilir: hiçbir şeyi örtmez, ucu görünmez. */}
      <mesh frustumCulled={false} renderOrder={-1}>
        <sphereGeometry args={[1, 48, 24]} />
        <shaderMaterial
          side={BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniformlar}
          vertexShader={/* glsl */ `
            varying vec3 vYon;
            void main() {
              vYon = normalize(position);
              vec4 p = projectionMatrix * viewMatrix * vec4(position * 500.0 + cameraPosition, 1.0);
              gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
            }`}
          fragmentShader={/* glsl */ `
            uniform vec3 uTepe;
            uniform vec3 uUfuk;
            uniform vec3 uGunes;
            uniform vec3 uIsik;
            uniform float uGece;
            varying vec3 vYon;
            float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
            void main() {
              vec3 d = normalize(vYon);
              float k = smoothstep(-0.02, 0.55, d.y);
              vec3 renk = mix(uUfuk, uTepe, pow(k, 0.8));
              float g = max(dot(d, uGunes), 0.0);
              float ufukYakin = 1.0 - smoothstep(0.0, 0.5, d.y);
              // Güneş diski, halesi ve ufuktaki saçılma
              renk += uIsik * (smoothstep(0.9993, 0.9997, g) * 3.0 * (1.0 - uGece) + pow(g, 40.0) * 0.35 + pow(g, 6.0) * 0.18 * ufukYakin);
              // Yıldızlar (gece)
              vec3 hucre = floor(d * 380.0);
              float y = step(0.9975, h3(hucre)) * h3(hucre + 7.0);
              renk += vec3(0.85, 0.9, 1.0) * y * uGece * smoothstep(0.02, 0.25, d.y);
              gl_FragColor = vec4(renk, 1.0);
              #include <colorspace_fragment>
            }`}
        />
      </mesh>
    </>
  )
}
