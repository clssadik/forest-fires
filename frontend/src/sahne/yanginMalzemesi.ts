import { Color, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three'
import { DOKU_GURULTU_GLSL, gurultuDokusu } from './gurultuDokusu'
import { HATA_RENKLERI, RAMPALAR, rampaGlsl, renkGlsl } from './tematikRenkler'

/**
 * Arazi ve ağaç malzemelerinin ortak yangın gölgelendiricisi. Her köşe/örnek
 * bir model varış zamanı (aToa, tutuşmadan sonra saat) taşır; global zaman `uT`
 * değiştikçe yalnızca uniform güncellenir, geometri yeniden kurulmaz.
 *
 * Arazi köşesi ayrıca gerçek yanık oranını (aGercek, Sentinel-2 dNBR), modelin yanma
 * olasılığını (aOlasilik), FIRMS varışını (aFirms, aFirmsVar), yanma şiddetini (aSiddet),
 * örtü rengini (aOrtuRengi) ve köşenin modelde hiç yanıp yanmadığını
 * (aYandi) taşır.
 */

/** Yanmayan hücrelerin varış zamanı yerine yazılan değer (saat); hiçbir `uT` ona ulaşmaz. */
export const YANMADI_SAAT = 10_000

/**
 * Tüm malzemelerin paylaştığı uniform nesnesi; Sahne her karede günceller. Geliştirmede bu dosya
 * sıcak yenilenirse yeni bir nesne doğar, derlenmiş malzemeler eskisini tutar ve zaman ile katman
 * anahtarları sahneye ulaşmaz: bu yüzden sayfa baştan yüklenir (dosyanın sonu).
 */
export const yanginUniformlari = {
  uT: { value: -1 },
  uYayilim: { value: 1 },
  uOlasilik: { value: 0.5 },
  uKabartma: { value: 1 },
  uVaris: { value: 0 },
  uVarisUst: { value: 1 },
  uGuven: { value: 0 },
  uZamanFarki: { value: 0 },
  uSiddet: { value: 0 },
  uOrtuKat: { value: 0 },
  uIzokron: { value: 0 },
  uHata: { value: 0 },
  /** Model alanının gerçek alana eşitlendiği an (saat); hata katmanı bu anki modeli karşılaştırır. */
  uHataEsik: { value: 0 },
  /** Gerçek (duvar saati) zaman, saniye: dalgalar, alev titremesi, duman döngüsü. */
  uZaman: { value: 0 },
  /** Rüzgârın estiği yön (x, z) × hız / 40 km/sa. */
  uRuzgar: { value: new Vector2(0, 0) },
  uGunesYonu: { value: new Vector3(0, 1, 0) },
  uUfuk: { value: new Color('#aecbe6') },
  uGok: { value: new Color('#3d77c6') },
  /** Ana ışığın rengi × şiddet / 3 (duman ve bulutların aydınlanması için). */
  uIsikRengi: { value: new Color('#ffffff') },
  uOrtamRengi: { value: new Color('#dbe4ee') },
  /** Dumanlı hava 0–1 (son saatteki yanma hızından). */
  uDuman: { value: 0 },
  /** Gece 0–1. */
  uGece: { value: 0 },
  uGurultu: { value: gurultuDokusu },
}

/** Değer gürültüsü: ortak dokudan tek okuma (bkz. gurultuDokusu.ts). */
const GURULTU_GLSL = /* glsl */ `
${DOKU_GURULTU_GLSL}
float yGurultu(vec2 p) { return dGurultu(p); }
`

const UNIFORM_GLSL = /* glsl */ `
uniform float uT;
uniform float uVaris;
uniform float uVarisUst;
uniform float uGuven;
uniform float uZamanFarki;
uniform float uSiddet;
uniform float uOrtuKat;
uniform float uYayilim;
uniform float uOlasilik;
uniform float uKabartma;
uniform float uIzokron;
uniform float uHata;
uniform float uHataEsik;
uniform float uZaman;
uniform vec2 uRuzgar;
uniform vec3 uGunesYonu;
uniform vec3 uUfuk;
uniform vec3 uGok;
uniform vec3 uIsikRengi;
uniform vec3 uOrtamRengi;
uniform float uDuman;
uniform float uGece;
`

const DEGISKENLER = ['Toa', 'Yandi', 'Gercek', 'Olasilik', 'Firms', 'FirmsVar', 'Siddet', 'Orman', 'Su']

/** Arazi örgüsünün taşıması gereken köşe nitelikleri (çevre arazisi bunları sabit değerle doldurur). */
export const ARAZI_NITELIKLERI = DEGISKENLER.map((d) => `a${d}`)

const TEMATIK_GLSL = [
  rampaGlsl('rampaVaris', RAMPALAR.varis),
  rampaGlsl('rampaGuven', RAMPALAR.guven),
  rampaGlsl('rampaZamanFarki', RAMPALAR.zamanFarki),
  rampaGlsl('rampaSiddet', RAMPALAR.siddet),
].join('\n')

const SU_GLSL = /* glsl */ `
float suDalga(vec2 p, float t) {
  return yGurultu(p * 28.0 + vec2(t * 0.09, t * 0.05)) + 0.55 * yGurultu(p * 67.0 - vec2(t * 0.13, -t * 0.08));
}
`

/** Arazi malzemesi için onBeforeCompile. */
export function araziGolgelendirici(s: WebGLProgramParametersWithUniforms) {
  Object.assign(s.uniforms, yanginUniformlari)
  s.vertexShader = s.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
${DEGISKENLER.map((d) => `attribute float a${d};\nvarying float v${d};`).join('\n')}
attribute vec3 aOrtuRengi;
varying vec3 vOrtuRengi;
varying vec3 vDunya;
varying float vEgim;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
transformed.y *= uKabartma;
${DEGISKENLER.map((d) => `v${d} = a${d};`).join(' ')}
vOrtuRengi = aOrtuRengi;
vDunya = (modelMatrix * vec4(transformed, 1.0)).xyz;
vEgim = 1.0 - normal.y;`,
    )

  s.fragmentShader = s.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
${GURULTU_GLSL}
${SU_GLSL}
${TEMATIK_GLSL}
${DEGISKENLER.map((d) => `varying float v${d};`).join('\n')}
varying vec3 vOrtuRengi;
varying vec3 vDunya;
varying float vEgim;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
vec2 yp = vDunya.xz;
float n1 = yGurultu(yp * 9.0);
float n2 = yGurultu(yp * 33.0);
float n3 = yGurultu(yp * 90.0);
vec3 renk = diffuseColor.rgb;

// Arazi ayrıntısı: geniş renk lekeleri, kuru ot, dik yamaçta katmanlı kaya
float makro = yGurultu(yp * 0.9) * 0.55 + yGurultu(yp * 3.1) * 0.45;
renk *= 0.84 + 0.3 * makro;
renk = mix(renk, renk * vec3(1.1, 1.0, 0.78), smoothstep(0.55, 0.85, n2) * (1.0 - vOrman) * 0.55);
float kaya = smoothstep(0.22, 0.42, vEgim + (n2 - 0.5) * 0.18);
float katman = 0.9 + 0.1 * sin(vDunya.y * 160.0 + n1 * 14.0 + n2 * 6.0);
renk = mix(renk, vec3(0.56, 0.51, 0.45) * katman * (0.85 + 0.3 * n3), kaya * 0.45);

// Bitki örtüsü benekleri (WorldCover orman / maki)
float agac = smoothstep(0.6, 0.9, n1 * 0.35 + n2 * 0.35 + n3 * 0.3 + vOrman * 0.35) * step(0.05, vOrman);
renk = mix(renk, vec3(0.06, 0.08, 0.035), agac * 0.7);

// Su: kıyıda sığ turkuaz, açıkta koyu; kıyı çizgisinde köpük
float suM = smoothstep(0.45, 0.55, vSu);
vec3 suRengi = mix(vec3(0.09, 0.3, 0.33), vec3(0.025, 0.1, 0.16), smoothstep(0.55, 0.95, vSu));
renk = mix(renk, suRengi, suM);
float kopuk = smoothstep(0.42, 0.5, vSu) * (1.0 - smoothstep(0.5, 0.62, vSu)) * smoothstep(0.35, 0.75, yGurultu(yp * 70.0 + uZaman * 0.25));
renk = mix(renk, vec3(0.85, 0.9, 0.9), kopuk * 0.6);

float toa = vToa + (n1 - 0.5) * 0.6;
float yas = uT - toa;
float modelde = step(0.999, vYandi);

// Tutuşma olasılığı: modelin önümüzdeki 12 saatte yakması beklenen yer, tohum oranıyla
float ileri = -yas;
if (ileri > 0.0 && ileri < 12.0) renk = mix(renk, vec3(0.86, 0.3, 0.08), uOlasilik * modelde * vOlasilik * 0.75 * pow(1.0 - ileri / 12.0, 1.2));

// Yanmış alan (model)
float yandi = step(0.0, yas) * modelde;
vec3 kara = mix(vec3(0.03, 0.025, 0.022), vec3(0.11, 0.09, 0.08), n2 * 0.7 + n3 * 0.3);
// Taze yanıkta kül lekeleri (açık gri), birkaç saat kızıl kor tonu
kara = mix(kara, vec3(0.4, 0.38, 0.36), smoothstep(0.6, 0.85, n3 * 0.75 + n2 * 0.25) * 0.4);
kara = mix(kara, vec3(0.16, 0.05, 0.025), smoothstep(6.0, 0.0, yas) * 0.35);
renk = mix(renk, kara, yandi * uYayilim);

// İzokronlar: ilk 48 saatte 6 saatte bir, sonra 24 saatte bir
float f = vToa < 48.0 ? vToa / 6.0 : 8.0 + (vToa - 48.0) / 24.0;
float w = fwidth(f);
float iso = 1.0 - smoothstep(0.0, w * 1.3, abs(fract(f - 0.5) - 0.5));
renk = mix(renk, vec3(0.95, 0.55, 0.15), iso * 0.6 * yandi * uYayilim * uIzokron * step(0.5, vToa));

// Tematik modlar: zemin griye çekilir, üstüne tek bir düz harita boyanır. Modlar birbirini
// dışladığı için renkler toplanabilir; yalnızca geçişte iki mod kısa süre birlikte görünür.
vec3 duzRenk = vec3(0.0);
float duzOrtu = 0.0;
#define BOYA(ortu, r) { float o_ = (ortu); renk = mix(renk, (r), o_); duzRenk += (r) * o_; duzOrtu += o_; }

float parlaklik = dot(renk, vec3(0.3, 0.59, 0.11));
float zemin = max(max(uHata, uZamanFarki), max(uVaris, max(uGuven, max(uSiddet, uOrtuKat))));
renk = mix(renk, vec3(parlaklik) * 0.6, zemin / 0.9);

// Varış zamanı: cephe t anına kadar ilerledikçe boyanır; karekök ilk saatlere daha çok renk ayırır
BOYA(uVaris * modelde * step(vToa, uT), rampaVaris(sqrt(max(vToa, 0.0) / uVarisUst)));

// Güven: 20 çalıştırmanın kaçında yandı
BOYA(uGuven * smoothstep(0.02, 0.06, vOlasilik), rampaGuven(vOlasilik));

// Model hatası (eşit alan, zamandan bağımsız): doğru, yanlış alarm, kaçırılan
float modelIc = modelde * step(vToa, uHataEsik);
float gercekVar = step(0.5, vGercek);
vec3 hataRengi = modelIc * gercekVar > 0.5 ? ${renkGlsl(HATA_RENKLERI.dogru)}
  : modelIc > 0.5 ? ${renkGlsl(HATA_RENKLERI.fazla)}
  : ${renkGlsl(HATA_RENKLERI.kacirilan)};
BOYA(uHata * max(modelIc, gercekVar), hataRengi);

// Zaman farkı: model − FIRMS varışı; ikisi de gördüğünde ve ikisi de geçtikten sonra görünür
float ikisiDe = modelde * step(0.999, vFirmsVar);
BOYA(uZamanFarki * ikisiDe * step(max(vToa, vFirms), uT), rampaZamanFarki((vToa - vFirms) / 48.0 + 0.5));

// Yanma şiddeti: Key ve Benson eşikleriyle dNBR 0,1 düşük, 0,8 üstü en yüksek renk
BOYA(uSiddet * smoothstep(0.02, 0.06, vSiddet), rampaSiddet((vSiddet - 0.1) / 0.7));

// Bitki örtüsü: sınıf rengi; su ve çevre arazisinin rengi yok
BOYA(uOrtuKat * step(0.001, vOrtuRengi.r + vOrtuRengi.g + vOrtuRengi.b), vOrtuRengi);

diffuseColor.rgb = renk;`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.12, suM);`,
    )
    .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
// Su dalgaları ve kara mikro kabartısı: yükseklik alanının ekran türevlerinden normal bozma
// (Mikkelsen 2010, three.js bumpmap ile aynı yöntem); ek gürültü okuması gerekmez.
{
  float kabarti = (suM > 0.01 ? suDalga(yp, uZaman) * 0.0012 * suM : 0.0) + (n2 * 0.7 + n3 * 0.3) * 0.0016 * (1.0 - suM);
  vec3 sx = dFdx(-vViewPosition);
  vec3 sy = dFdy(-vViewPosition);
  vec3 r1 = cross(sy, normal);
  vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(kabarti) * r1 + dFdy(kabarti) * r2);
  normal = normalize(abs(det) * normal - grad);
}`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
// Suda gök yansıması (Fresnel)
float fres = 0.03 + 0.97 * pow(1.0 - max(dot(normal, normalize(vViewPosition)), 0.0), 5.0);
totalEmissiveRadiance += mix(uUfuk, uGok, 0.35) * fres * suM * 0.85;
// Tematik renkler gece de okunsun
totalEmissiveRadiance += duzRenk * uGece * 0.45;
float parca = smoothstep(0.25, 0.65, yGurultu(yp * 2.2 + 3.7));
float cephe = yandi * exp(-max(yas, 0.0) / 0.5) * (0.35 + 0.65 * parca);
float kor = yandi * smoothstep(8.0, 0.0, yas) * smoothstep(0.7, 0.85, n3) * step(0.5, n2) * (0.4 + 0.6 * parca);
totalEmissiveRadiance += vec3(1.0, 0.28, 0.05) * (cephe * (1.2 + 2.0 * n3) + kor * 0.45) * uYayilim;`,
    )
}

/**
 * Ağaç malzemesi (örneklenmiş çam, maki, servi) için onBeforeCompile. Geometri `aTac` taşır
 * (yaprak/dal 1, gövde 0). Ağaçlar rüzgârda salınır; yangın gelince tacı alev alır, sonra
 * kömürleşip küçülür, gövdesi bir süre kor halinde kalır.
 */
export function agacGolgelendirici(s: WebGLProgramParametersWithUniforms) {
  Object.assign(s.uniforms, yanginUniformlari)
  s.vertexShader = s.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
${UNIFORM_GLSL}
attribute float aToa;
attribute float aTac;
varying float vYas;
varying float vTac;
varying float vFaz;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vYas = uT - aToa;
vTac = aTac;
// Yanan tacın iğneleri dökülür: geriye gövdeye yapışık birkaç kömürleşmiş dal kalır
float yanik = uYayilim * smoothstep(0.1, 1.5, vYas);
transformed.xz *= mix(1.0, 1.0 - 0.78 * aTac, yanik);
transformed.y *= mix(1.0, 1.0 - 0.12 * aTac, yanik);
#ifdef USE_INSTANCING
  vFaz = dot(instanceMatrix[3].xz, vec2(37.1, 17.3));
#else
  vFaz = 0.0;
#endif
// Rüzgârda salınım: tepeye doğru artar (karesel)
float sal = 0.75 + 0.25 * sin(uZaman * 1.7 + vFaz) + 0.12 * sin(uZaman * 4.3 + vFaz * 1.7);
transformed.xz += uRuzgar * sal * transformed.y * transformed.y * 1.4 * (1.0 - yanik * 0.7);`,
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
varying float vYas;
varying float vTac;
varying float vFaz;`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float yandi = smoothstep(0.0, 0.35, vYas) * uYayilim;
// Cepheden hemen önce ısıyla kavrulma (yapraklar kahverengileşir)
float kavrulma = smoothstep(-0.6, 0.0, vYas) * (1.0 - step(0.0, vYas)) * uYayilim * vTac;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.35, 0.22, 0.1), kavrulma * 0.7);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.025, 0.02, 0.018), yandi);`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
float titreme = 0.65 + 0.35 * sin(uZaman * 13.0 + vFaz) * sin(uZaman * 7.3 + vFaz * 2.1);
float alev = step(0.0, vYas) * exp(-max(vYas, 0.0) / 0.45) * uYayilim;
float kor = step(0.0, vYas) * smoothstep(4.0, 0.5, vYas) * uYayilim;
// Tacın alevi ilan alevlerinden gelir; burada yalnızca içten kızaran dallar ve kor
totalEmissiveRadiance += vec3(0.9, 0.22, 0.03) * (alev * (0.25 + 0.55 * vTac) * titreme + kor * 0.12 * (1.0 - vTac));`,
    )
}

if (import.meta.hot) import.meta.hot.accept(() => location.reload())
