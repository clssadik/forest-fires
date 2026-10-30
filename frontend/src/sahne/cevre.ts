import { fbm, simplexOlustur, sirtliFbm, yumusakBasamak } from '../model/gurultu'
import { ORMAN_YOGUNLUGU, type OlayVerisi } from '../olay/veri'

/**
 * Model ızgarasının (kare) dışındaki görsel çevre: tamamen sahte, yalnızca görünüm için.
 * Kenarda gerçek DEM ve örtüyle birebir başlar; dışarı çıktıkça kenar değeri gittikçe
 * genişleyen bir pencerede yumuşatılır ve gürültülü dağlara, kıyıda denize dönüşür.
 * Model, doğrulama ve sayılar bu araziyi hiç görmez.
 */

/** Çevrenin kare kenarından uzanımı (km). Ucu her zaman sisin ötesinde kalır. */
export const CEVRE_UZANIMI_KM = 260
/** Yakın çevre: karenin bu kadar km yakınında ince ve eşit aralıklı örgü. */
const YAKIN_KM = 30
const YAKIN_ADIM_KM = 0.6
/** Uzak çevre: kaba örgü; aralık dışarı doğru her adımda büyür. */
const UZAK_ADIM_KM = 3
const UZAK_BUYUME = 1.03
/** Gerçek araziden sahte araziye geçiş genişliği (km). */
const GECIS_KM = 6

export type CevreVerisi = Pick<
  OlayVerisi,
  'genislikKm' | 'yukseklikKm' | 'hucreKm' | 'satir' | 'sutun' | 'yukseklikM' | 'ortuKenetli'
>

/**
 * Bir çevre örgüsünün köşe çizgileri ve ortasındaki delik (yarı boyutlar, km): delikteki
 * dörtgenler çizilmez, yalnızca kenarındaki bir sıra içeri taşan etek olarak kalır.
 */
export interface CevreOrgusu {
  xs: number[]
  zs: number[]
  delikX: number
  delikZ: number
}

export interface CevreNoktasi {
  /** Yükseklik (m); su için deniz seviyesinin altı. */
  hM: number
  /** Su oranı 0–1 (0,5 kıyı çizgisi). */
  su: number
  /** Bitki örtüsü yoğunluğu 0–1 (ORMAN_YOGUNLUGU ölçeğinde). */
  orman: number
  /** Kareye uzaklık (km); içeride 0. */
  d: number
}

/** [-yari, yari] aralığını uçları dahil `adim`a en yakın eşit aralıkla böler. */
function esitBol(yari: number, adim: number) {
  const n = Math.max(1, Math.round((2 * yari) / adim))
  return Array.from({ length: n + 1 }, (_, i) => -yari + (2 * yari * i) / n)
}

/** Delik kenarından dışarı `uzanim` km boyunca adımlar (simetrik iki yan). */
function disaCizgiler(yari: number, adim: number, buyume: number, uzanim: number) {
  const dis: number[] = []
  let p = yari
  while (p < yari + uzanim - 1e-6) {
    p += adim
    adim *= buyume
    dis.push(p)
  }
  return dis
}

export class Cevre {
  /** Karenin hemen çevresi (ince örgü; iç çizgiler gerçek köşelere hizalı) ve uzak çevre. */
  readonly yakin: CevreOrgusu
  readonly uzak: CevreOrgusu
  /** Gerçek arazi örgüsünün yarı genişliği ve yarı yüksekliği (köşe merkezleri, km). */
  readonly ax: number
  readonly az: number
  private readonly g1 = simplexOlustur(71)
  private readonly g2 = simplexOlustur(72)
  private readonly g3 = simplexOlustur(73)
  private readonly veri: CevreVerisi

  constructor(veri: CevreVerisi, uzanimKm = CEVRE_UZANIMI_KM) {
    this.veri = veri
    const h = veri.hucreKm
    this.ax = veri.genislikKm / 2 - h / 2
    this.az = veri.yukseklikKm / 2 - h / 2
    const yakinUzanim = Math.min(YAKIN_KM, uzanimKm)
    const yakin = (n: number, yari: number) => {
      // İçeride gerçek köşelerin her k'ıncısı (+ son); dışarıda eşit adım
      const k = Math.max(1, Math.round(YAKIN_ADIM_KM / h))
      const ic: number[] = []
      for (let i = 0; i < n; i += k) ic.push(i * h - yari)
      if ((n - 1) % k) ic.push(yari)
      const dis = disaCizgiler(yari, k * h, 1, yakinUzanim)
      return [...dis.map((v) => -v).reverse(), ...ic, ...dis]
    }
    this.yakin = { xs: yakin(veri.sutun, this.ax), zs: yakin(veri.satir, this.az), delikX: this.ax, delikZ: this.az }
    const dx = this.yakin.xs[this.yakin.xs.length - 1]
    const dz = this.yakin.zs[this.yakin.zs.length - 1]
    const uzak = (yari: number) => {
      const dis = disaCizgiler(yari, UZAK_ADIM_KM, UZAK_BUYUME, uzanimKm - yakinUzanim)
      return [...dis.map((v) => -v).reverse(), ...esitBol(yari, UZAK_ADIM_KM), ...dis]
    }
    this.uzak = { xs: uzak(dx), zs: uzak(dz), delikX: dx, delikZ: dz }
  }

  /** Kareye (gerçek örgüye) dışarıdan uzaklık (km); içeride 0. */
  uzaklik(x: number, z: number) {
    return Math.hypot(Math.max(Math.abs(x) - this.ax, 0), Math.max(Math.abs(z) - this.az, 0))
  }

  nokta(x: number, z: number): CevreNoktasi {
    const v = this.veri
    const d = this.uzaklik(x, z)
    const kx = Math.min(Math.max(x, -this.ax), this.ax)
    const kz = Math.min(Math.max(z, -this.az), this.az)
    if (d === 0) {
      const o = v.ortuKenetli(x, z)
      return { hM: v.yukseklikM(x, z), su: o === 'su' ? 1 : 0, orman: ORMAN_YOGUNLUGU[o], d }
    }

    // Kenar değeri: kenar boyunca (teğet yönde), uzaklıkla genişleyen pencerede ortalama.
    // İçeri doğru örneklenmez: kenardaki dar bir kıyı şeridi de dışarıda deniz olarak sürer.
    const r = Math.min(d * 0.6, 8)
    const rx = Math.abs(x) <= this.ax ? r : 0
    const rz = Math.abs(z) <= this.az ? r : 0
    let hKenar = 0
    let suKenar = 0
    let ormanKenar = 0
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        const px = Math.min(Math.max(kx + a * rx, -this.ax), this.ax)
        const pz = Math.min(Math.max(kz + b * rz, -this.az), this.az)
        const o = v.ortuKenetli(px, pz)
        hKenar += v.yukseklikM(px, pz)
        suKenar += o === 'su' ? 1 : 0
        ormanKenar += ORMAN_YOGUNLUGU[o]
      }
    }
    hKenar /= 9
    suKenar /= 9
    ormanKenar /= 9

    const t = yumusakBasamak(0, GECIS_KM, d)
    const n = fbm(this.g1, x / 13, z / 11, 5)
    // Alan bükmesi: sırtlar düzenli tümsek dizisi gibi değil, kıvrımlı uzansın
    const bx = x + fbm(this.g3, x / 25, z / 25, 3) * 9
    const bz = z + fbm(this.g3, x / 25 + 50, z / 25, 3) * 9
    const sirt = sirtliFbm(this.g2, bx / 22, bz / 14, 6)
    // Dağlık kenarın dışı daha dağlık; dışarı çıktıkça genlik biraz daha büyür.
    const genlik = (230 + 0.8 * Math.max(hKenar, 0)) * (0.7 + 0.3 * yumusakBasamak(0, 40, d))
    const ayrinti = sirtliFbm(this.g1, x / 5 + 17, z / 5, 4)
    const hKara = Math.max(hKenar + ((sirt - 0.3) * 2 * genlik + n * 200 + (ayrinti - 0.3) * 160) * t, 4 + 30 * t)

    // Kıyı çizgisi kenardan dışarı dümdüz uzamasın: su oranına gürültü katılır.
    // Kenardan uzaklaştıkça karaya hafif eğilim: kenarı yarı su olan yerler göl tarlasına dönmesin
    const kiyi = suKenar + (fbm(this.g3, x / 5, z / 5, 4) * 0.3 - 0.12) * yumusakBasamak(0, 3, d)
    const su = yumusakBasamak(0.42, 0.58, kiyi)
    const hM = hKara * (1 - su) + (-12 - 6 * d) * su

    const ormanSahte =
      yumusakBasamak(-0.85, -0.1, fbm(this.g3, x / 4 + 40, z / 4, 4)) *
      (1 - yumusakBasamak(1500, 2000, hKara)) *
      (0.45 + 0.55 * yumusakBasamak(30, 220, hKara))
    const orman = (ormanKenar * (1 - t) + ormanSahte * t) * (1 - su)
    return { hM, su, orman, d }
  }
}
