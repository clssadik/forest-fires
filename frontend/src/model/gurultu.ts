/**
 * Tohumlu 2B simplex gürültü (Stefan Gustavson'un kamu malı uygulamasından
 * uyarlanmıştır) ve fBm yardımcıları. Bağımlılık eklememek için burada.
 */

const F2 = 0.5 * (Math.sqrt(3) - 1)
const G2 = (3 - Math.sqrt(3)) / 6
const YONLER = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

/** Basit tohumlu sözde rastgele üreteç (mulberry32). */
export function rastgeleUreteci(tohum: number) {
  let a = tohum >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function simplexOlustur(tohum = 1) {
  const r = rastgeleUreteci(tohum)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  const perm = new Uint8Array(512)
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  /** [-1, 1] aralığında değer döndürür. */
  return function simplex(x: number, y: number): number {
    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const t = (i + j) * G2
    const x0 = x - (i - t)
    const y0 = y - (j - t)
    const i1 = x0 > y0 ? 1 : 0
    const j1 = x0 > y0 ? 0 : 1
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    const ii = i & 255
    const jj = j & 255
    let n = 0
    const katki = (gi: number, xx: number, yy: number) => {
      let tt = 0.5 - xx * xx - yy * yy
      if (tt < 0) return 0
      tt *= tt
      const g = YONLER[gi & 7]
      return tt * tt * (g[0] * xx + g[1] * yy)
    }
    n += katki(perm[ii + perm[jj]], x0, y0)
    n += katki(perm[ii + i1 + perm[jj + j1]], x1, y1)
    n += katki(perm[ii + 1 + perm[jj + 1]], x2, y2)
    return 70 * n
  }
}

export type Gurultu2B = (x: number, y: number) => number

/** Kesirli Brown hareketi: yaklaşık [-1, 1]. */
export function fbm(g: Gurultu2B, x: number, y: number, oktav = 5, kazanc = 0.5, bosluk = 2.03) {
  let toplam = 0
  let genlik = 1
  let frekans = 1
  let norm = 0
  for (let o = 0; o < oktav; o++) {
    toplam += genlik * g(x * frekans, y * frekans)
    norm += genlik
    genlik *= kazanc
    frekans *= bosluk
  }
  return toplam / norm
}

/** Sırtlı (ridged) fBm: keskin dağ sırtları için, yaklaşık [0, 1]. */
export function sirtliFbm(g: Gurultu2B, x: number, y: number, oktav = 5) {
  let toplam = 0
  let genlik = 0.5
  let frekans = 1
  let agirlik = 1
  for (let o = 0; o < oktav; o++) {
    let n = 1 - Math.abs(g(x * frekans, y * frekans))
    n *= n
    n *= agirlik
    agirlik = Math.min(Math.max(n * 2, 0), 1)
    toplam += n * genlik
    genlik *= 0.5
    frekans *= 2.1
  }
  return toplam
}

export const yumusakBasamak = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}
