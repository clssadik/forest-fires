import { useMemo } from 'react'
import { InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils } from 'three'
import { rastgeleUreteci } from '../model/gurultu'
import { DOKU_GURULTU_GLSL } from './gurultuDokusu'
import { yanginUniformlari as U } from './yanginMalzemesi'

/**
 * Seyrek yaz kümülüsleri (yalnızca görünüm). Her bulut birkaç yumuşak ilandan oluşur;
 * rüzgârla sürüklenir ve alan dışına çıkınca öbür kenardan girer. Güneş yönüyle
 * aydınlanır: gün batımında turuncu, gece koyu. Kameraya çok yaklaşan bulut solar.
 */

const BULUT_SAYISI = 46
const PARCA = 11
/** Bulutların dolaştığı kare alanın yarı kenarı (km) ve yükseklik aralığı (sahne birimi). */
const ALAN_KM = 110
const Y_ALT = 9
const Y_UST = 13

const VERTEX = /* glsl */ `
uniform float uZaman;
uniform vec2 uRuzgar;
uniform vec3 uGunesYonu;
#include <fog_pars_vertex>
attribute vec3 aMerkez;
attribute float aBoy;
attribute float aRastgele;
varying vec2 vUv;
varying float vRastgele;
varying float vYakinlik;
varying vec3 vIsikGorus;
varying float vAlt;
void main() {
  vUv = uv;
  vRastgele = aRastgele;
  vec3 p = aMerkez;
  // Rüzgârla sürüklenme; alan dışına çıkan öbür kenardan girer
  p.xz += uRuzgar * uZaman * 0.04;
  p.xz = mod(p.xz + ${ALAN_KM}.0, ${ALAN_KM * 2}.0) - ${ALAN_KM}.0;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  vYakinlik = smoothstep(aBoy * 0.8, aBoy * 4.0, -mvPosition.z);
  mvPosition.xy += position.xy * aBoy;
  vAlt = position.y;
  vIsikGorus = normalize((viewMatrix * vec4(uGunesYonu, 0.0)).xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`

const FRAGMENT = /* glsl */ `
uniform vec3 uIsikRengi;
uniform vec3 uOrtamRengi;
uniform float uZaman;
${DOKU_GURULTU_GLSL}
#include <fog_pars_fragment>
varying vec2 vUv;
varying float vRastgele;
varying float vYakinlik;
varying vec3 vIsikGorus;
varying float vAlt;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  if (r > 1.0 || vYakinlik < 0.01) discard;
  float n = dFbm(q * 1.3 + vRastgele * 19.0 + uZaman * 0.01);
  float yogun = smoothstep(0.25, 0.75, n * 0.8 + (1.0 - r) * 0.7) * smoothstep(1.0, 0.4, r);
  vec3 N = normalize(vec3(q + (n - 0.5) * 0.5, 0.8));
  float isik = max(dot(N, vIsikGorus), 0.0);
  // Alt taraf gölgede (kümülüsün düz, koyu tabanı)
  float taban = smoothstep(-0.9, 0.3, vAlt);
  vec3 renk = vec3(1.0) * (uOrtamRengi * (0.45 + 0.25 * taban) + uIsikRengi * (0.35 + 0.75 * isik) * (0.6 + 0.4 * taban));
  gl_FragColor = vec4(renk, yogun * 0.85 * vYakinlik);
  #include <fog_fragment>
}
`

export function Bulutlar() {
  const { geometri, malzeme } = useMemo(() => {
    const r = rastgeleUreteci(909)
    const n = BULUT_SAYISI * PARCA
    const merkez = new Float32Array(n * 3)
    const boy = new Float32Array(n)
    const rast = new Float32Array(n)
    let k = 0
    for (let b = 0; b < BULUT_SAYISI; b++) {
      const bx = (r() * 2 - 1) * ALAN_KM
      const bz = (r() * 2 - 1) * ALAN_KM
      const by = Y_ALT + r() * (Y_UST - Y_ALT)
      const olcek = 0.6 + r() * 1.2
      for (let p = 0; p < PARCA; p++, k++) {
        // Yatayda yayvan, ortası kabarık küme
        const a = r() * Math.PI * 2
        const u = Math.sqrt(r()) * 3.2 * olcek
        const orta = 1 - u / (3.2 * olcek)
        merkez.set([bx + Math.cos(a) * u * 1.4, by + orta * 1.1 * olcek + r() * 0.3, bz + Math.sin(a) * u], k * 3)
        boy[k] = (1.6 + r() * 1.6 + orta * 1.5) * olcek
        rast[k] = r()
      }
    }
    const taban = new PlaneGeometry(1, 1)
    const g = new InstancedBufferGeometry()
    g.index = taban.index
    g.setAttribute('position', taban.attributes.position)
    g.setAttribute('uv', taban.attributes.uv)
    g.setAttribute('aMerkez', new InstancedBufferAttribute(merkez, 3))
    g.setAttribute('aBoy', new InstancedBufferAttribute(boy, 1))
    g.setAttribute('aRastgele', new InstancedBufferAttribute(rast, 1))
    g.instanceCount = n
    const m = new ShaderMaterial({
      uniforms: { ...UniformsUtils.clone(UniformsLib.fog), ...U },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
    })
    return { geometri: g, malzeme: m }
  }, [])

  return <mesh geometry={geometri} material={malzeme} frustumCulled={false} renderOrder={1} raycast={() => null} />
}
