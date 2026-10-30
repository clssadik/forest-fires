import { BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Vector3 } from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rastgeleUreteci } from '../model/gurultu'

/**
 * Prosedürel ağaç modelleri (birim: km; örnek ölçeği ~1). Bölgenin baskın türleri:
 * kızılçam (Pinus brutia: ince gövde, düzensiz kümelerden yayvan taç), dağ servisi /
 * göknar (sivri) ve maki çalısı. Her köşe `aTac` (yaprak 1, gövde 0) taşır; yanma ve
 * salınım gölgelendiricisi bunu kullanır. Yaprak normalleri küme merkezinden dışarı
 * bakar: düşük poligonla yumuşak, hacimli bir taç görünümü.
 */

export type AgacTuru = 'cam' | 'servi' | 'maki'

const GOVDE = new Color('#5a3f2c')

interface Parca {
  g: BufferGeometry
  tac: boolean
}

/** Köşelere renk (alttan üste koyu → açık; gölgede kalan alt yapraklar) ve aTac yazar. */
function boya(g: BufferGeometry, alt: Color, ust: Color, y0: number, y1: number, tac: boolean, r: () => number) {
  const p = g.attributes.position
  const renk = new Float32Array(p.count * 3)
  const tacDizi = new Float32Array(p.count).fill(tac ? 1 : 0)
  const c = new Color()
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(Math.max((p.getY(i) - y0) / (y1 - y0), 0), 1)
    c.copy(alt).lerp(ust, t * t * 0.6 + t * 0.4)
    if (tac) c.multiplyScalar(0.88 + r() * 0.24)
    c.toArray(renk, i * 3)
  }
  g.setAttribute('color', new BufferAttribute(renk, 3))
  g.setAttribute('aTac', new BufferAttribute(tacDizi, 1))
  return g
}

/** Gürültüyle bozulmuş yaprak kümesi (indeksli); normaller merkezden dışarı (yumuşak hacim). */
function kume(merkez: Vector3, yaricap: number, basiklik: number, r: () => number) {
  const ham = new IcosahedronGeometry(yaricap, 0)
  ham.deleteAttribute('normal')
  ham.deleteAttribute('uv')
  const g = mergeVertices(ham)
  const p = g.attributes.position
  const v = new Vector3()
  const n = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(0.78 + r() * 0.42)
    v.y *= basiklik
    p.setXYZ(i, v.x + merkez.x, v.y + merkez.y, v.z + merkez.z)
    v.y /= basiklik
    v.normalize()
    v.y = v.y * 0.8 + 0.25
    v.normalize().toArray(n, i * 3)
  }
  g.setAttribute('normal', new BufferAttribute(n, 3))
  return g
}

function govde(yukseklik: number, alt: number, ust: number, r: () => number): Parca {
  const g = new CylinderGeometry(ust, alt, yukseklik, 5, 1, true)
  g.translate(0, yukseklik / 2, 0)
  g.deleteAttribute('uv')
  return { g: boya(g, GOVDE.clone().multiplyScalar(0.7), GOVDE, 0, yukseklik, false, r), tac: false }
}

function birlestir(parcalar: Parca[]) {
  const g = mergeGeometries(parcalar.map((p) => p.g))
  if (!g) throw new Error('ağaç geometrisi birleştirilemedi')
  g.computeBoundingSphere()
  return g
}

/** Kızılçam: ~0,22 yüksek; gövdenin üst yarısında 5 düzensiz küme, yayvan ve basık taç. */
function cam(tohum: number) {
  const r = rastgeleUreteci(tohum)
  const alt = new Color('#1b2812')
  const ust = new Color('#56693a')
  const parcalar: Parca[] = [govde(0.17, 0.008, 0.004, r)]
  const kumeler: [number, number, number, number][] = [
    [0, 0.15, 0, 0.05],
    [0.032, 0.165, 0.012, 0.038],
    [-0.028, 0.17, -0.02, 0.04],
    [0.006, 0.19, 0.03, 0.034],
    [-0.004, 0.205, -0.004, 0.03],
  ]
  for (const [x, y, z, rr] of kumeler) {
    const g = kume(new Vector3(x, y, z), rr, 0.62, r)
    parcalar.push({ g: boya(g, alt, ust, 0.11, 0.23, true, r), tac: true })
  }
  return birlestir(parcalar)
}

/** Dağ servisi / göknar: sivri, iki katlı koni. */
function servi(tohum: number) {
  const r = rastgeleUreteci(tohum)
  const alt = new Color('#152110')
  const ust = new Color('#3f5530')
  const parcalar: Parca[] = [govde(0.06, 0.007, 0.005, r)]
  for (const [y, rr, h] of [
    [0.045, 0.042, 0.12],
    [0.11, 0.03, 0.1],
    [0.165, 0.018, 0.07],
  ] as const) {
    const g = new ConeGeometry(rr, h, 7, 1, true)
    g.translate(0, y + h / 2, 0)
    g.deleteAttribute('uv')
    parcalar.push({ g: boya(g, alt, ust, 0.04, 0.24, true, r), tac: true })
  }
  return birlestir(parcalar)
}

/** Maki çalısı: yere yakın, iki üç küme; gövde görünmez. */
function maki(tohum: number) {
  const r = rastgeleUreteci(tohum)
  const alt = new Color('#2b3417')
  const ust = new Color('#717444')
  const parcalar: Parca[] = []
  for (const [x, y, z, rr] of [
    [0, 0.022, 0, 0.034],
    [0.028, 0.018, 0.01, 0.026],
    [-0.022, 0.02, -0.016, 0.028],
  ] as const) {
    const g = kume(new Vector3(x, y, z), rr, 0.7, r)
    parcalar.push({ g: boya(g, alt, ust, 0, 0.05, true, r), tac: true })
  }
  return birlestir(parcalar)
}

export function agacGeometrisi(tur: AgacTuru): BufferGeometry {
  if (tur === 'cam') return cam(11)
  if (tur === 'servi') return servi(12)
  return maki(13)
}

/**
 * Uzak ağaçlar için basit model (ayrıntı düzeyi): tek yaprak kümesi ya da tek koni ve
 * ince gövde. Birkaç km öteden ayrıntılı modelle aynı siluet ve renkte görünür.
 */
export function basitAgacGeometrisi(tur: AgacTuru): BufferGeometry {
  const r = rastgeleUreteci(21)
  if (tur === 'servi') {
    const g = new ConeGeometry(0.04, 0.2, 5, 1, true)
    g.translate(0, 0.14, 0)
    g.deleteAttribute('uv')
    return birlestir([
      govde(0.05, 0.007, 0.005, r),
      { g: boya(g, new Color('#152110'), new Color('#3f5530'), 0.04, 0.24, true, r), tac: true },
    ])
  }
  if (tur === 'maki') {
    const g = kume(new Vector3(0, 0.022, 0), 0.045, 0.6, r)
    return birlestir([{ g: boya(g, new Color('#2b3417'), new Color('#717444'), 0, 0.05, true, r), tac: true }])
  }
  const g = kume(new Vector3(0, 0.175, 0), 0.065, 0.55, r)
  return birlestir([
    govde(0.15, 0.008, 0.004, r),
    { g: boya(g, new Color('#1b2812'), new Color('#56693a'), 0.13, 0.22, true, r), tac: true },
  ])
}
