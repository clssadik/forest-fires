import { olay, yayilimParametreleri as P, UTC_FARKI_SAAT } from '../veri/ornekSenaryo'
import { fbm, simplexOlustur, yumusakBasamak } from './gurultu'

/**
 * YER TUTUCU YAYILIM MODELİ (sahte varış zamanı / TOA)
 * ----------------------------------------------------
 * Gerçek sistemde her hücrenin varış zamanı (time-of-arrival) hücresel otomat
 * çıktısından gelecek. O zamana kadar bu modül, tutuşma noktasından rüzgâr
 * yönünde uzamış bir elips ve günlük döngülü bir yayılma hızıyla aynı arayüzü
 * sağlar. Grafikler, sahne ve paneller yalnızca aşağıdaki dışa aktarılan
 * fonksiyonları kullanır; gerçek TOA rasterı geldiğinde yalnızca bu dosya
 * değişmelidir:
 *
 *   varisZamaniSaat(x, z)  hücrenin tutuşmadan kaç saat sonra yandığı
 *   yayilmaHiziMDk(t)      cephe yayılma hızı (m/dk)
 *   cepheMesafesiM(t)      baş cephenin tutuşmadan uzaklığı (m)
 *   yananAlanHa(t)         birikimli yanan alan (ha)
 */

const SAAT = 3_600_000
const ADIM_SAAT = 1 / 6 // tablo çözünürlüğü: 10 dk
const TUTUSMA = olay.baslangic
const SON_SAAT = (olay.bitis - olay.baslangic) / SAAT

const yerelSaat = (t: number) => (((t / SAAT + UTC_FARKI_SAAT) % 24) + 24) % 24

/** Günlük döngü: 15:00'te 1, 03:00'te -1. */
export const gunlukDongu = (t: number) => Math.cos((2 * Math.PI * (yerelSaat(t) - 15)) / 24)

/** Ölçeksiz yayılma hızı (tutuşmadan s saat sonra). */
function hamHiz(s: number): number {
  if (s < 0) return 0
  const c = gunlukDongu(TUTUSMA + s * SAAT)
  const gunluk = 0.14 + 0.86 * Math.pow((c + 1) / 2, 1.5)
  const baslama = 1 - Math.exp(-s / 1.2)
  const sonum = Math.exp(-s / 110) + 0.9 * Math.exp(-s / 18)
  const kontrol = 1 - yumusakBasamak(SON_SAAT - 40, SON_SAAT, s)
  return baslama * gunluk * sonum * kontrol
}

// Birim şeklin alanı: arka ucu tutuşmada (−geri), başı +1'de olan elips.
const A = (1 + P.geriOrani) / 2
const M = (1 - P.geriOrani) / 2
const W = P.genislikOrani
const BIRIM_ALAN = Math.PI * A * W

/** Toplam alanı tutturmak için gereken son baş cephe mesafesi (m). */
const SON_MESAFE_M = Math.sqrt((olay.toplamAlanHa * 1e4) / BIRIM_ALAN)

// Birikimli mesafe tablosu
const N = Math.ceil(SON_SAAT / ADIM_SAAT) + 1
const birikimli = new Float64Array(N)
for (let i = 1; i < N; i++) {
  const s = (i - 0.5) * ADIM_SAAT
  birikimli[i] = birikimli[i - 1] + hamHiz(s) * ADIM_SAAT
}
const OLCEK = SON_MESAFE_M / birikimli[N - 1]

/** Yayılma hızı (m/dk). */
export function yayilmaHiziMDk(t: number): number {
  const s = (t - TUTUSMA) / SAAT
  return (hamHiz(s) * OLCEK) / 60
}

function mesafeSaatte(s: number): number {
  if (s <= 0) return 0
  const k = s / ADIM_SAAT
  if (k >= N - 1) return SON_MESAFE_M
  const i = Math.floor(k)
  return (birikimli[i] + (birikimli[i + 1] - birikimli[i]) * (k - i)) * OLCEK
}

/** Baş cephenin tutuşmadan uzaklığı (m). */
export const cepheMesafesiM = (t: number) => mesafeSaatte((t - TUTUSMA) / SAAT)

/** Birikimli yanan alan (ha). */
export const yananAlanHa = (t: number) => (BIRIM_ALAN * cepheMesafesiM(t) ** 2) / 1e4

export const sonCepheMesafesiM = SON_MESAFE_M

/** Mesafeden (m) tutuşmadan sonraki saate; ulaşılmazsa Infinity. */
function mesafedenSaate(d: number): number {
  if (d <= 0) return 0
  const hedef = d / OLCEK
  if (hedef > birikimli[N - 1]) return Infinity
  let alt = 0
  let ust = N - 1
  while (ust - alt > 1) {
    const orta = (alt + ust) >> 1
    if (birikimli[orta] < hedef) alt = orta
    else ust = orta
  }
  const oran = (hedef - birikimli[alt]) / Math.max(birikimli[ust] - birikimli[alt], 1e-9)
  return (alt + oran) * ADIM_SAAT
}

const yonRad = (P.yonDerece * Math.PI) / 180
/** Yayılım yönünde birim vektör (sahne x, z). */
export const yayilimYonu = { x: Math.sin(yonRad), z: -Math.cos(yonRad) }

const g = simplexOlustur(101)

/** Noktanın şekil-normalize uzaklığı (m): bu mesafeye cephe ulaşınca nokta yanar. */
function etkinMesafe(x: number, z: number): number {
  const dx = (x - P.tutusma.x) * 1000
  const dz = (z - P.tutusma.z) * 1000
  const r = Math.hypot(dx, dz)
  if (r < 1) return 0
  const u = (dx * yayilimYonu.x + dz * yayilimYonu.z) / r
  const v = (dx * -yayilimYonu.z + dz * yayilimYonu.x) / r
  // Birim şeklin bu yöndeki yarıçapı: ((ρu − M)/A)² + (ρv/W)² = 1
  const a = (u * u) / (A * A) + (v * v) / (W * W)
  const b = (-2 * M * u) / (A * A)
  const c = (M * M) / (A * A) - 1
  const rho = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  const duzensiz = 1 + P.duzensizlik * fbm(g, x * 0.16, z * 0.16, 4)
  return r / (rho * duzensiz)
}

/** Tutuşmadan sonra saat cinsinden varış zamanı; yanmayacaksa Infinity. */
export const varisZamaniSaat = (x: number, z: number) => mesafedenSaate(etkinMesafe(x, z))

/** Son yangın sınırına göre oran: < 1 içeride, 1 sınırda (sürekli; çizim için). */
export const sinirOrani = (x: number, z: number) => etkinMesafe(x, z) / SON_MESAFE_M

/** Tutuşmadan kontrol altına alınmaya kadar geçen süre (saat). */
export const YANMA_SURESI_SAAT = SON_SAAT

/** Ana yayılım ekseni üzerinde tutuşmadan `m` metre uzaktaki nokta (km). */
export const eksenNoktasi = (m: number) => ({
  x: P.tutusma.x + (yayilimYonu.x * m) / 1000,
  z: P.tutusma.z + (yayilimYonu.z * m) / 1000,
})
