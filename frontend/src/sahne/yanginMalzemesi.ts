import type { WebGLProgramParametersWithUniforms } from 'three'
import { YANMA_SURESI_SAAT } from '../model/yayilim'

/**
 * Arazi ve ağaç malzemelerinin ortak yangın gölgelendiricisi. Her köşe/örnek
 * bir varış zamanı (aToa, tutuşmadan sonra saat) taşır; global zaman `uT`
 * değiştikçe yalnızca uniform güncellenir, geometri yeniden kurulmaz.
 */

/**
 * Son sınırın dışındaki (hiç yanmayacak) noktalar için süreklileştirilmiş varış
 * zamanı: sınırda kesintisiz kalır ki gölgelendiricide köşe enterpolasyonu bozulmasın.
 */
export const disVarisZamani = (sinirOrani: number) => YANMA_SURESI_SAAT + Math.max(sinirOrani - 1, 0) * 400 + 1

/** Tüm malzemelerin paylaştığı uniform nesnesi; Sahne her karede günceller. */
export const yanginUniformlari = {
  uT: { value: -1 },
  uYanikIzi: { value: 0.9 },
  uYayilim: { value: 1 },
  uOlasilik: { value: 0.8 },
  uGoruntu: { value: 1 },
  uArazi: { value: 1 },
  uKabartma: { value: 1 },
}

const GURULTU_GLSL = /* glsl */ `
float yHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float yGurultu(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(yHash(i), yHash(i + vec2(1, 0)), u.x), mix(yHash(i + vec2(0, 1)), yHash(i + vec2(1, 1)), u.x), u.y);
}
`

const UNIFORM_GLSL = /* glsl */ `
uniform float uT;
uniform float uYanikIzi;
uniform float uYayilim;
uniform float uOlasilik;
uniform float uGoruntu;
uniform float uArazi;
uniform float uKabartma;
`

/** Arazi malzemesi için onBeforeCompile. */
export function araziGolgelendirici(s: WebGLProgramParametersWithUniforms) {
  Object.assign(s.uniforms, yanginUniformlari)
  s.vertexShader = s.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
attribute float aToa;
attribute float aSinir;
attribute float aOrman;
varying float vToa;
varying float vSinir;
varying float vOrman;
varying vec3 vDunya;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
transformed.y *= uKabartma;
vToa = aToa; vSinir = aSinir; vOrman = aOrman;
vDunya = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

  s.fragmentShader = s.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
${GURULTU_GLSL}
varying float vToa;
varying float vSinir;
varying float vOrman;
varying vec3 vDunya;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec2 yp = vDunya.xz;
float n1 = yGurultu(yp * 9.0);
float n2 = yGurultu(yp * 33.0);
float n3 = yGurultu(yp * 90.0);
vec3 renk = diffuseColor.rgb;

// Bitki örtüsü benekleri (hava görüntüsü katmanı)
float agac = smoothstep(0.66, 0.9, n1 * 0.4 + n2 * 0.35 + n3 * 0.35 + vOrman * 0.3);
vec3 orman = vec3(0.07, 0.085, 0.04);
renk = mix(renk, mix(renk, orman, agac * 0.72), uGoruntu);
renk = mix(vec3(0.6, 0.5, 0.36), renk, uArazi);

float toa = vToa + (n1 - 0.5) * 1.6 + (n3 - 0.5) * 0.5;
float yas = uT - toa;

// Yanık izi (dNBR): son sınırın içi, henüz yanmamış kısım kızıl tonlu
float icerde = 1.0 - smoothstep(0.985, 1.0, vSinir + (n2 - 0.5) * 0.02);
float leke = smoothstep(0.45, 0.8, yGurultu(yp * 1.3 + 9.1) * 0.7 + n2 * 0.3);
if (yas < 0.0) renk = mix(renk, vec3(0.5, 0.09, 0.05) * (0.75 + 0.5 * n3), uYanikIzi * (0.12 + 0.45 * leke) * icerde);

// Tutuşma olasılığı: cephenin hemen önü
float ileri = -yas;
if (ileri > 0.0 && ileri < 9.0) renk = mix(renk, vec3(0.8, 0.12, 0.05), uOlasilik * (0.2 + 0.6 * leke) * pow(1.0 - ileri / 9.0, 1.5));

// Yanmış alan (model)
float yandi = step(0.0, yas);
vec3 kara = mix(vec3(0.03, 0.025, 0.022), vec3(0.11, 0.09, 0.08), n2 * 0.7 + n3 * 0.3);
kara = mix(kara, vec3(0.2, 0.06, 0.03), smoothstep(10.0, 0.0, yas) * 0.6);
renk = mix(renk, kara, yandi * uYayilim);

// İzokronlar (12 saatte bir) ve son sınır çizgisi
float f = vToa / 12.0;
float w = fwidth(f);
float iso = 1.0 - smoothstep(0.0, w * 1.3, abs(fract(f - 0.5) - 0.5));
renk = mix(renk, vec3(0.85, 0.35, 0.12), iso * 0.4 * yandi * uYayilim * step(0.5, vToa));
float sw = fwidth(vSinir);
float sinir = 1.0 - smoothstep(0.0, sw * 1.4, abs(vSinir - 1.0));
float kesik = step(0.5, fract((yp.x + yp.y) * 2.2));
renk = mix(renk, vec3(0.95, 0.94, 0.9), sinir * kesik * 0.85 * max(uYanikIzi, uYayilim));

diffuseColor.rgb = renk;`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
float parca = smoothstep(0.25, 0.65, yGurultu(yp * 2.2 + 3.7));
float cephe = yandi * exp(-max(yas, 0.0) / 0.5) * (0.35 + 0.65 * parca);
float kor = yandi * smoothstep(8.0, 0.0, yas) * step(0.6, n2) * parca;
totalEmissiveRadiance += vec3(1.0, 0.28, 0.05) * (cephe * (1.2 + 2.0 * n3) + kor * 0.45) * uYayilim;`,
    )
}

/** Ağaç (örneklenmiş koni) malzemesi için onBeforeCompile. */
export function agacGolgelendirici(s: WebGLProgramParametersWithUniforms) {
  Object.assign(s.uniforms, yanginUniformlari)
  s.vertexShader = s.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
attribute float aToa;
varying float vYas;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vYas = uT - aToa;
// Yanan ağaç biraz incelir
if (vYas > 0.0 && uYayilim > 0.0) transformed.xz *= 0.7;`,
    )
    .replace(
      '#include <project_vertex>',
      `vec4 mvPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition.y *= uKabartma;
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
    )
  s.fragmentShader = s.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
varying float vYas;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float yandi = step(0.0, vYas) * uYayilim;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.017, 0.015), yandi);`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.4, 0.1) * yandi * exp(-max(vYas, 0.0) / 0.7) * 2.5;`,
    )
}
