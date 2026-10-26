/**
 * Zaman kaydırıcısının her konumunda yangın katmanını boyar.
 *
 * Arka uç, varış zamanı (TOA) rasterlarını Web Mercator ızgarasında uint16 dakika olarak
 * gönderir (tutuşmadan bu yana; YOK = yanmadı). Bir t anında "yanmış" hücre TOA ≤ t olan
 * hücredir. Boyama aynı döngüde anlık örtüşme sayılarını da çıkarır.
 *
 * Gözlenen yanık alan (karşılaştırma için): gerçek yanmış alanın (Sentinel-2) FIRMS'in t'ye
 * kadar gördüğü kısmı. Bitişte gerçek alanın tamamı sayılır; böylece son karedeki örtüşme,
 * doğrulama raporundaki "bitişte" ölçütüyle aynıdır.
 */

export const YOK = 65535

export type RenkKipi = 'yayilim' | 'karsilastirma'

export interface Rasterlar {
  genislik: number
  yukseklik: number
  /** Model topluluk TOA'sı (dk); simülasyon çalışmadıysa null. */
  model: Uint16Array | null
  /** FIRMS'ten türetilen gözlenen varış (dk), yalnızca gerçek alan içinde. */
  firms: Uint16Array
  /** Gerçek yanmış alan (1 = yandı). */
  gercek: Uint8Array
}

export interface AnlikSayilar {
  model: number
  gozlenen: number
  kesisim: number
}

/** RGBA → küçük-sonlu Uint32 (ImageData'nın bellekteki sırası: R, G, B, A). */
export const paketle = (r: number, g: number, b: number, a: number) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0

const hex = (h: string, a: number) =>
  paketle(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a)

/** Karşılaştırma renkleri; doğrulama raporuyla aynı palet (rapor.py). */
export const KARSILASTIRMA_RENKLERI = {
  dogru: '#2a78d6',
  yanlisAlarm: '#eb6834',
  kacirilan: '#1baf7a',
}
const DOGRU = hex(KARSILASTIRMA_RENKLERI.dogru, 215)
const YANLIS_ALARM = hex(KARSILASTIRMA_RENKLERI.yanlisAlarm, 215)
const KACIRILAN = hex(KARSILASTIRMA_RENKLERI.kacirilan, 215)

/** FIRMS noktası rengi (haritada MapLibre ifadesiyle): [tespitin yaşı (sa), renk]. */
export const FIRMS_DURAKLARI: [number, string][] = [
  [0, '#fff6b0'],
  [6, '#ffc93c'],
  [24, '#3d3a33'],
]

/** Yayılım kipinde yaşa göre renk durakları: [yaş (dk), renk, saydamlık]. */
export const YAS_DURAKLARI: [number, string, number][] = [
  [0, '#ffd45c', 245], // yeni tutuşan: cephe
  [120, '#f07a2a', 235], // yanma süresi (model: 120 dk) sonunda
  [720, '#c2361f', 220],
  [2880, '#6e2318', 205], // 2 gün ve daha eski
]
const YAS_ADIMI = 10 // dk; renk tablosu çözünürlüğü
const yasTablosu = (() => {
  const son = YAS_DURAKLARI.at(-1)![0]
  const tablo = new Uint32Array(son / YAS_ADIMI + 1)
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  for (let k = 0; k < tablo.length; k++) {
    const yas = k * YAS_ADIMI
    let i = 0
    while (i < YAS_DURAKLARI.length - 2 && yas > YAS_DURAKLARI[i + 1][0]) i++
    const [y0, r0, a0] = YAS_DURAKLARI[i]
    const [y1, r1, a1] = YAS_DURAKLARI[i + 1]
    const o = Math.min(Math.max((yas - y0) / (y1 - y0), 0), 1)
    const [c0, c1] = [rgb(r0), rgb(r1)]
    const k3 = c0.map((c, j) => Math.round(c + (c1[j] - c) * o))
    tablo[k] = paketle(k3[0], k3[1], k3[2], Math.round(a0 + (a1 - a0) * o))
  }
  return tablo
})()

/**
 * `cikti`yı (genişlik × yükseklik, ImageData'nın Uint32 görünümü) t anına göre boyar.
 * `modelGoster` kapalıysa yalnızca sayar. Sayılar hücre adedidir.
 */
export function boya(
  r: Rasterlar,
  tDk: number,
  bitisDk: number,
  kip: RenkKipi,
  cikti: Uint32Array,
  modelGoster = true,
): AnlikSayilar {
  const { model, firms, gercek } = r
  const sonda = tDk >= bitisDk
  const enYasli = yasTablosu.length - 1
  let nModel = 0
  let nGozlenen = 0
  let nKesisim = 0
  const n = r.genislik * r.yukseklik
  for (let i = 0; i < n; i++) {
    const m = model !== null && model[i] <= tDk // YOK (65535) her zaman t'den büyük
    const g = gercek[i] === 1 && (sonda || firms[i] <= tDk)
    if (m) nModel++
    if (g) nGozlenen++
    if (m && g) nKesisim++
    let renk = 0
    if (modelGoster) {
      if (kip === 'yayilim') {
        if (m) renk = yasTablosu[Math.min(((tDk - model![i]) / YAS_ADIMI) | 0, enYasli)]
      } else if (m) renk = g ? DOGRU : YANLIS_ALARM
      else if (g) renk = KACIRILAN
    }
    cikti[i] = renk
  }
  return { model: nModel, gozlenen: nGozlenen, kesisim: nKesisim }
}

/** Kesişim / birleşim; ikisi de boşsa null. */
export function iou(s: AnlikSayilar): number | null {
  const birlesim = s.model + s.gozlenen - s.kesisim
  return birlesim > 0 ? s.kesisim / birlesim : null
}
