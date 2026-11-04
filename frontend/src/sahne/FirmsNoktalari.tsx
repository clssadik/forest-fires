import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { BufferAttribute, BufferGeometry, PerspectiveCamera, ShaderMaterial } from 'three'
import { rastgeleUreteci } from '../model/gurultu'
import type { OlayVerisi } from '../olay/veri'
import { yanginUniformlari as U } from './yanginMalzemesi'

/** Noktaların arası (km): VIIRS pikselinin yaklaşık boyu. */
const ARALIK_KM = 0.4
/** Noktanın çapı (km); çok uzaktan bakınca EN_AZ_PIKSEL altına inmez. */
const CAP_KM = 0.16
const EN_AZ_PIKSEL = 2.5
/** Noktanın araziden yüksekliği (km); eğik bakışta yamaca gömülmesin. */
const YUKSELTI = 0.02

const VERTEX = /* glsl */ `
uniform float uKabartma;
uniform float uT;
uniform float uOlcek;
uniform float uOrto;
uniform float uEnAz;
attribute float aFirms;
varying float vYas;
void main() {
  vec3 p = position;
  p.y *= uKabartma;
  vYas = uT - aFirms;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vYas < 0.0 ? 0.0 : max(uOlcek / mix(-mv.z, 1.0, uOrto), uEnAz);
}`

const FRAGMENT = /* glsl */ `
uniform float uFirms;
varying float vYas;
void main() {
  if (vYas < 0.0) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.75, 1.0, d);
  if (a <= 0.0) discard;
  // Yeni tespit parlak, bir günde koyulaşır
  vec3 renk = mix(vec3(1.0, 0.36, 0.08), vec3(0.72, 0.13, 0.08), smoothstep(0.0, 24.0, vYas));
  gl_FragColor = vec4(renk, a * uFirms);
}`

/**
 * FIRMS'in t anına kadar gördüğü pikseller, araziye sabit küçük noktalar olarak. Zemini boyamaz:
 * altındaki model yanığı okunur kalır. Noktalar VIIRS aralığında seyreltilir.
 */
export function FirmsNoktalari({ veri }: { veri: OlayVerisi }) {
  const geometri = useMemo(() => {
    const adim = Math.max(Math.round(ARALIK_KM / veri.hucreKm), 1)
    const rastgele = rastgeleUreteci(veri.satir * 31 + veri.sutun)
    const konum: number[] = []
    const firms: number[] = []
    for (let i = 0; i < veri.satir; i += adim)
      for (let j = 0; j < veri.sutun; j += adim) {
        const hucre = veri.hucreKonumu(i, j)
        const saat = veri.firmsSaat(hucre.x, hucre.z)
        if (!Number.isFinite(saat)) continue
        // Düzgün dizi görünmesin
        const x = hucre.x + (rastgele() - 0.5) * adim * veri.hucreKm * 0.7
        const z = hucre.z + (rastgele() - 0.5) * adim * veri.hucreKm * 0.7
        konum.push(x, veri.araziY(x, z) + YUKSELTI, z)
        firms.push(saat)
      }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(konum), 3))
    g.setAttribute('aFirms', new BufferAttribute(new Float32Array(firms), 1))
    return g
  }, [veri])

  const malzeme = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uKabartma: U.uKabartma,
          uT: U.uT,
          uFirms: U.uFirms,
          uOlcek: { value: 1 },
          uOrto: { value: 0 },
          uEnAz: { value: EN_AZ_PIKSEL },
        },
        transparent: true,
        depthWrite: false,
      }),
    [],
  )

  useFrame(({ size, camera, gl }) => {
    const oran = gl.getPixelRatio()
    const persp = camera instanceof PerspectiveCamera
    malzeme.uniforms.uOrto.value = persp ? 0 : 1
    malzeme.uniforms.uEnAz.value = EN_AZ_PIKSEL * oran
    malzeme.uniforms.uOlcek.value = persp
      ? (CAP_KM * size.height * oran) / (2 * Math.tan((camera.fov * Math.PI) / 360))
      : CAP_KM * camera.zoom * oran
  })

  return <points geometry={geometri} material={malzeme} frustumCulled={false} renderOrder={4} />
}
