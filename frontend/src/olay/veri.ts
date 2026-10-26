import type { HamOlay, OlayBilgisi, OlayRasterlari, OlayTuru } from './api'
import { YOK } from './api'

/**
 * Olay ekranının gerçek verisi: arka ucun kaba ızgarası (~150 m) ve saatlik serileri.
 * Sahne, grafikler ve paneller yalnızca bu sınıfın yöntemlerini kullanır.
 *
 * Sahne koordinatı km: +x doğu, +z güney (sahnede kuzey −z); orijin ızgaranın ortası.
 * Hücre (i, j) merkezi: x = (j + ½)·h − G/2, z = (i + ½)·h − Y/2. Arazi örgüsünün köşeleri
 * bu merkezlerdir, yani her raster köşe başına bir değer verir.
 */

const SAAT = 3_600_000
/** Sahnede yüksekliği okunur kılmak için düşey abartı. */
export const DIKEY_ABARTI = 2
/** Metreden sahne birimine (km × abartı). */
export const sahneY = (hM: number) => (Math.max(hM, -60) / 1000) * DIKEY_ABARTI

export type OrtuSinifi = 'diger' | 'orman' | 'maki' | 'ot' | 'tarim' | 'su' | 'yerlesim'
/** `ortu` rasterındaki kodların sırası (backend `olay.ORTU_SINIFLARI`). */
export const ORTU_SIRASI: OrtuSinifi[] = ['diger', 'orman', 'maki', 'ot', 'tarim', 'su', 'yerlesim']

export interface OnemliOlay {
  tur: OlayTuru
  /** Unix ms. */
  zaman: number
  /** Sahne konumu (km); kamera tıklanınca buraya uçar. */
  x?: number
  z?: number
  ham?: HamOlay
}

export interface HavaDurumu {
  ruzgarKmSa: number
  /** Rüzgârın geldiği yön (derece). */
  ruzgarYonu: number
  sicaklik: number
  nem: number
  yakitNemi: number
}

const YONLER = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB']
/** 16 yönlü pusula kısaltması (Türkçe). */
export const pusulaYonu = (derece: number) => YONLER[Math.round((((derece % 360) + 360) % 360) / 22.5) % 16]

/** Sıralı `xs` üzerinde doğrusal ara değer; aralık dışında kenara kenetlenir. */
export function aradegerle(xs: number[], ys: number[], x: number): number {
  if (!xs.length) return 0
  if (x <= xs[0]) return ys[0]
  const n = xs.length - 1
  if (x >= xs[n]) return ys[n]
  let alt = 0
  let ust = n
  while (ust - alt > 1) {
    const orta = (alt + ust) >> 1
    if (xs[orta] <= x) alt = orta
    else ust = orta
  }
  return ys[alt] + ((ys[ust] - ys[alt]) * (x - xs[alt])) / (xs[ust] - xs[alt])
}

/** Açıyı (derece) en kısa yoldan ara değerle (350° ile 10° arası 0°). */
function aciAradegerle(xs: number[], ys: number[], x: number): number {
  const sin = ys.map((d) => Math.sin((d * Math.PI) / 180))
  const cos = ys.map((d) => Math.cos((d * Math.PI) / 180))
  const a = (Math.atan2(aradegerle(xs, sin, x), aradegerle(xs, cos, x)) * 180) / Math.PI
  return (a + 360) % 360
}

export class OlayVerisi {
  readonly satir: number
  readonly sutun: number
  /** Hücre kenarı (km). */
  readonly hucreKm: number
  readonly genislikKm: number
  readonly yukseklikKm: number
  readonly tutusmaMs: number
  readonly bitisMs: number
  /** Ana yayılım ekseni boyunca profil (km, m, varış saati). */
  readonly profil: { km: number; hM: number; toaSaat: number }[]
  readonly olaylar: OnemliOlay[]
  private readonly saatlerMs: number[]
  readonly bilgi: OlayBilgisi
  readonly r: OlayRasterlari

  constructor(bilgi: OlayBilgisi, r: OlayRasterlari) {
    this.bilgi = bilgi
    this.r = r
    const g = bilgi.izgara
    this.satir = g.satir
    this.sutun = g.sutun
    this.hucreKm = g.hucre_m / 1000
    this.genislikKm = g.genislik_km
    this.yukseklikKm = g.yukseklik_km
    this.tutusmaMs = Date.parse(bilgi.tutusma_utc)
    this.bitisMs = Date.parse(bilgi.bitis_utc)
    this.saatlerMs = bilgi.seriler.saatler.map((s) => this.tutusmaMs + s * SAAT)
    const e = bilgi.eksen
    this.profil = e
      ? e.yukseklik_m.map((hM, i) => ({
          km: (e.uzunluk_km * i) / (e.yukseklik_m.length - 1),
          hM,
          toaSaat: e.toa_saat[i] ?? Infinity,
        }))
      : []
    this.olaylar = bilgi.olaylar.map((o) => ({
      tur: o.tur,
      zaman: this.tutusmaMs + o.saat * SAAT,
      x: o.x,
      z: o.z,
      ham: o,
    }))
  }

  get bitisSaat() {
    return (this.bitisMs - this.tutusmaMs) / SAAT
  }

  /** Hücre merkezinin sahne konumu. */
  hucreKonumu(i: number, j: number) {
    return { x: (j + 0.5) * this.hucreKm - this.genislikKm / 2, z: (i + 0.5) * this.hucreKm - this.yukseklikKm / 2 }
  }

  /** Sahne konumundan sürekli hücre koordinatı (kenara kenetli). */
  private ic(x: number, z: number) {
    const j = Math.min(Math.max((x + this.genislikKm / 2) / this.hucreKm - 0.5, 0), this.sutun - 1)
    const i = Math.min(Math.max((z + this.yukseklikKm / 2) / this.hucreKm - 0.5, 0), this.satir - 1)
    return { i, j }
  }

  /** En yakın hücrenin indeksi; ızgara dışındaysa -1. */
  indeks(x: number, z: number): number {
    const j = Math.floor((x + this.genislikKm / 2) / this.hucreKm)
    const i = Math.floor((z + this.yukseklikKm / 2) / this.hucreKm)
    if (i < 0 || j < 0 || i >= this.satir || j >= this.sutun) return -1
    return i * this.sutun + j
  }

  icinde(x: number, z: number) {
    return this.indeks(x, z) >= 0
  }

  /** Deniz seviyesine göre yükseklik (m), bilineer. */
  yukseklikM(x: number, z: number): number {
    const { i, j } = this.ic(x, z)
    const i0 = Math.floor(i)
    const j0 = Math.floor(j)
    const i1 = Math.min(i0 + 1, this.satir - 1)
    const j1 = Math.min(j0 + 1, this.sutun - 1)
    const a = i - i0
    const b = j - j0
    const h = this.r.yukseklik
    const s = this.sutun
    const ust = h[i0 * s + j0] * (1 - b) + h[i0 * s + j1] * b
    const alt = h[i1 * s + j0] * (1 - b) + h[i1 * s + j1] * b
    return ust * (1 - a) + alt * a
  }

  /** Sahne yüksekliği (birim). */
  araziY = (x: number, z: number) => sahneY(this.yukseklikM(x, z))

  /** Eğim (derece) ve bakı (derece, kuzeyden saat yönünde, yamacın baktığı yön). */
  egimVeBaki(x: number, z: number) {
    const e = this.hucreKm
    const hx = (this.yukseklikM(x + e, z) - this.yukseklikM(x - e, z)) / (2 * e * 1000)
    const hz = (this.yukseklikM(x, z + e) - this.yukseklikM(x, z - e)) / (2 * e * 1000)
    const egim = (Math.atan(Math.hypot(hx, hz)) * 180) / Math.PI
    // Yamaç aşağı yön: (-hx, -hz); kuzey = -z
    const baki = ((Math.atan2(-hx, hz) * 180) / Math.PI + 360) % 360
    return { egim, baki }
  }

  ortu(x: number, z: number): OrtuSinifi {
    const k = this.indeks(x, z)
    return k < 0 ? 'diger' : ORTU_SIRASI[this.r.ortu[k]] ?? 'diger'
  }

  /** Model varışı (tutuşmadan sonra saat); yanmadıysa Infinity. */
  toaSaat(x: number, z: number) {
    return this.zamanOku(this.r.modelToa, this.indeks(x, z))
  }

  firmsSaat(x: number, z: number) {
    return this.zamanOku(this.r.firmsToa, this.indeks(x, z))
  }

  zamanOku(dizi: Uint16Array, k: number) {
    return k < 0 || dizi[k] === YOK ? Infinity : dizi[k] / 60
  }

  /** Modelin yanma olasılığı (tohumların yaktığı oran) 0–1. */
  olasilik(x: number, z: number) {
    const k = this.indeks(x, z)
    return k < 0 ? 0 : this.r.olasilik[k] / 255
  }

  /** Hücrenin gerçekte (Sentinel-2) yanmış oranı 0–1. */
  gercek(x: number, z: number) {
    const k = this.indeks(x, z)
    return k < 0 ? 0 : this.r.gercek[k] / 255
  }

  /** WGS84 konumu (köşelerden bilineer; 50 km'de hata < 10 m). */
  konum(x: number, z: number) {
    const u = (x + this.genislikKm / 2) / this.genislikKm
    const v = (z + this.yukseklikKm / 2) / this.yukseklikKm
    const [su, sau, saa, sa] = this.bilgi.izgara.koseler
    const ust = [su[0] + (sau[0] - su[0]) * u, su[1] + (sau[1] - su[1]) * u]
    const alt = [sa[0] + (saa[0] - sa[0]) * u, sa[1] + (saa[1] - sa[1]) * u]
    return { boylam: ust[0] + (alt[0] - ust[0]) * v, enlem: ust[1] + (alt[1] - ust[1]) * v }
  }

  private seri(ad: keyof OlayBilgisi['seriler'], t: number) {
    return aradegerle(this.saatlerMs, this.bilgi.seriler[ad], t)
  }

  /** Modelin t anına kadar yaktığı alan (ha); tutuşmadan önce 0. */
  yananAlanHa = (t: number) => (t < this.tutusmaMs ? 0 : this.seri('model_ha', t))
  /** FIRMS'in t anına kadar gördüğü gerçek alan (ha). */
  firmsAlanHa = (t: number) => (t < this.tutusmaMs ? 0 : this.seri('firms_ha', t))
  /** Baş cephenin tutuşmaya uzaklığı (m). */
  cepheM = (t: number) => (t < this.tutusmaMs ? 0 : this.seri('cephe_m', t))
  /** Baş cephe yayılma hızı (m/dk). */
  hizMDk = (t: number) => (t < this.tutusmaMs ? 0 : this.seri('hiz_m_dk', t))

  /** Tutuşma noktasındaki saatlik hava (zamanda doğrusal). */
  hava(t: number): HavaDurumu {
    const s = this.bilgi.seriler
    return {
      ruzgarKmSa: this.seri('ruzgar_kmsa', t),
      ruzgarYonu: aciAradegerle(this.saatlerMs, s.ruzgar_yon, t),
      sicaklik: this.seri('sicaklik_c', t),
      nem: this.seri('bagil_nem', t),
      yakitNemi: this.seri('yakit_nemi', t),
    }
  }

  /** Ana yayılım ekseni üzerinde tutuşmadan `km` uzaktaki nokta. */
  eksenNoktasi(km: number) {
    const e = this.bilgi.eksen
    if (!e || e.uzunluk_km === 0) return { ...this.bilgi.tutusma }
    const o = Math.min(Math.max(km / e.uzunluk_km, 0), 1)
    return { x: e.bas.x + (e.son.x - e.bas.x) * o, z: e.bas.z + (e.son.z - e.bas.z) * o }
  }

  /** Eksen üzerinde t anına kadar yanmış en uzak nokta (km). */
  eksendeCepheKm(t: number) {
    const saat = (t - this.tutusmaMs) / SAAT
    let km = 0
    for (const p of this.profil) if (p.toaSaat <= saat) km = p.km
    return km
  }

  /** Ana eksenin `saat` anında ulaştığı nokta; eksen o saate kadar hiç yanmadıysa null. */
  eksenIzokronu(saat: number) {
    let son: { km: number } | null = null
    for (const p of this.profil) if (p.toaSaat <= saat) son = p
    return son && son.km > 0 ? this.eksenNoktasi(son.km) : null
  }
}
