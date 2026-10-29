import type { WebGLProgramParametersWithUniforms } from 'three'

/**
 * Arazi ve ağaç malzemelerinin ortak yangın gölgelendiricisi. Her köşe/örnek
 * bir model varış zamanı (aToa, tutuşmadan sonra saat) taşır; global zaman `uT`
 * değiştikçe yalnızca uniform güncellenir, geometri yeniden kurulmaz.
 *
 * Arazi köşesi ayrıca gerçek yanık oranını (aGercek, Sentinel-2 dNBR), modelin yanma
 * olasılığını (aOlasilik), FIRMS varışını (aFirms) ve köşenin modelde hiç yanıp yanmadığını
 * (aYandi) taşır.
 */

/** Yanmayan hücrelerin varış zamanı yerine yazılan değer (saat); hiçbir `uT` ona ulaşmaz. */
export const YANMADI_SAAT = 10_000

/** Tüm malzemelerin paylaştığı uniform nesnesi; Sahne her karede günceller. */
export const yanginUniformlari = {
  uT: { value: -1 },
  uYanikIzi: { value: 0.9 },
  uYayilim: { value: 1 },
  uOlasilik: { value: 0.8 },
  uGoruntu: { value: 1 },
  uArazi: { value: 1 },
  uKabartma: { value: 1 },
  uFirms: { value: 1 },
  uIzokron: { value: 1 },
  uHata: { value: 0 },
  /** Model alanının gerçek alana eşitlendiği an (saat); hata katmanı bu anki modeli karşılaştırır. */
  uHataEsik: { value: 0 },
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
uniform float uFirms;
uniform float uIzokron;
uniform float uHata;
uniform float uHataEsik;
`

const DEGISKENLER = ['Toa', 'Yandi', 'Gercek', 'Olasilik', 'Firms', 'Orman']

/** Arazi malzemesi için onBeforeCompile. */
export function araziGolgelendirici(s: WebGLProgramParametersWithUniforms) {
  Object.assign(s.uniforms, yanginUniformlari)
  s.vertexShader = s.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
${DEGISKENLER.map((d) => `attribute float a${d};\nvarying float v${d};`).join('\n')}
varying vec3 vDunya;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
transformed.y *= uKabartma;
${DEGISKENLER.map((d) => `v${d} = a${d};`).join(' ')}
vDunya = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

  s.fragmentShader = s.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
${GURULTU_GLSL}
${DEGISKENLER.map((d) => `varying float v${d};`).join('\n')}
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

// Bitki örtüsü benekleri (WorldCover orman / maki)
float agac = smoothstep(0.6, 0.9, n1 * 0.35 + n2 * 0.35 + n3 * 0.3 + vOrman * 0.35) * step(0.05, vOrman);
renk = mix(renk, mix(renk, vec3(0.07, 0.085, 0.04), agac * 0.65), uGoruntu);
renk = mix(vec3(0.6, 0.5, 0.36), renk, uArazi);

float toa = vToa + (n1 - 0.5) * 0.6;
float yas = uT - toa;
float modelde = step(0.999, vYandi);

// Yanık izi: Sentinel-2'nin gördüğü gerçek yanmış alan (zamandan bağımsız, yangın sonrası)
float gercekIc = smoothstep(0.35, 0.65, vGercek + (n2 - 0.5) * 0.2);
// Soluk kül kahvesi: FIRMS'in kırmızısı ve modelin karası üstünde okunabilsin.
renk = mix(renk, vec3(0.38, 0.3, 0.26) * (0.85 + 0.3 * n3), uYanikIzi * gercekIc * 0.6);

// Tutuşma olasılığı: modelin önümüzdeki 12 saatte yakması beklenen yer, tohum oranıyla
float ileri = -yas;
if (ileri > 0.0 && ileri < 12.0) renk = mix(renk, vec3(0.86, 0.3, 0.08), uOlasilik * modelde * vOlasilik * 0.75 * pow(1.0 - ileri / 12.0, 1.2));

// Yanmış alan (model)
float yandi = step(0.0, yas) * modelde;
vec3 kara = mix(vec3(0.03, 0.025, 0.022), vec3(0.11, 0.09, 0.08), n2 * 0.7 + n3 * 0.3);
kara = mix(kara, vec3(0.2, 0.06, 0.03), smoothstep(10.0, 0.0, yas) * 0.6);
renk = mix(renk, kara, yandi * uYayilim);

// İzokronlar: ilk 48 saatte 6 saatte bir, sonra 24 saatte bir
float f = vToa < 48.0 ? vToa / 6.0 : 8.0 + (vToa - 48.0) / 24.0;
float w = fwidth(f);
float iso = 1.0 - smoothstep(0.0, w * 1.3, abs(fract(f - 0.5) - 0.5));
renk = mix(renk, vec3(0.95, 0.55, 0.15), iso * 0.6 * yandi * uYayilim * uIzokron * step(0.5, vToa));

// FIRMS: uydunun t anına kadar gördüğü yanan pikseller; yeni olanlar parlak
float firmsYas = uT - vFirms;
float benek = step(0.7, yGurultu(yp * 10.0));
if (firmsYas >= 0.0) renk = mix(renk, mix(vec3(1.0, 0.22, 0.08), vec3(0.62, 0.1, 0.07), smoothstep(0.0, 24.0, firmsYas)), benek * uFirms);

// Gerçek alanın sınırı (beyaz kesikli)
float gs = fwidth(vGercek);
float sinir = 1.0 - smoothstep(0.0, gs * 1.5, abs(vGercek - 0.5));
float kesik = step(0.5, fract((yp.x + yp.y) * 2.2));
renk = mix(renk, vec3(0.97, 0.96, 0.92), sinir * kesik * 0.9 * uYanikIzi);

// Model hatası (eşit alan, zamandan bağımsız): doğru, yanlış alarm, kaçırılan
float modelIc = modelde * step(vToa, uHataEsik);
float gercekVar = step(0.5, vGercek);
vec3 hataRengi = modelIc * gercekVar > 0.5 ? vec3(0.83, 0.28, 0.16)
  : modelIc > 0.5 ? vec3(0.94, 0.71, 0.24)
  : vec3(0.27, 0.36, 0.5);
renk = mix(renk, hataRengi, uHata * max(modelIc, gercekVar));

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
