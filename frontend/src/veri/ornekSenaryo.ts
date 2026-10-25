/**
 * ÖRNEK (YER TUTUCU) SENARYO VERİSİ
 * ---------------------------------
 * Bu dosyadaki her şey arayüzü geliştirmek için uydurulmuş yer tutucu veridir.
 * Olay bilgileri gerçek 2021 Manavgat yangınına dayanır, ama konumlar, tepe
 * adları/yerleri, olay saatleri ve yayılım/hava parametreleri temsilidir.
 * Arka uç çıktısı (hücresel otomat TOA rasterı, Open-Meteo hava serisi,
 * DEM, FIRMS tespitleri) hazır olduğunda bu modül API'den gelen veriyle
 * değiştirilecek. Arayüz bileşenleri yalnızca buradaki tiplere bağlıdır.
 *
 * Koordinatlar sahne koordinatıdır: 1 birim = 1 km, +x doğu, -z kuzey.
 */

export const SAAT_DILIMI = 'Europe/Istanbul'
/** 2021'de Türkiye sabit UTC+3 kullanıyordu; günlük döngü hesabı için. */
export const UTC_FARKI_SAAT = 3

/** Yerel (TSİ) tarih/saatten Unix milisaniyesi. Ay 1 tabanlıdır. */
export const tsi = (yil: number, ay: number, gun: number, saat = 0, dakika = 0) =>
  Date.UTC(yil, ay - 1, gun, saat - UTC_FARKI_SAAT, dakika)

export type OlayDurumu = 'suruyor' | 'tamamlandi'
export type OlayNedeni = 'arastiriliyor' | 'insan' | 'dogal'

export interface OlayBilgisi {
  ad: string
  kimlik: string
  konum: string
  /** Tahmini tutuşma anı. */
  baslangic: number
  /** Kontrol altına alınma (tahmini). */
  bitis: number
  toplamAlanHa: number
  neden: OlayNedeni
  durum: OlayDurumu
}

export const olay: OlayBilgisi = {
  ad: 'Manavgat Yangını',
  kimlik: 'TR-07-2021-0728',
  konum: 'Manavgat, Antalya',
  baslangic: tsi(2021, 7, 28, 12, 0),
  bitis: tsi(2021, 8, 6, 12, 0),
  toplamAlanHa: 56_700,
  neden: 'arastiriliyor',
  durum: 'suruyor',
}

/** Zaman çubuğunun gösterdiği aralık ve açılıştaki imleç anı. */
export const zamanAraligi = {
  baslangic: tsi(2021, 7, 28, 6, 0),
  bitis: tsi(2021, 8, 6, 18, 0),
  acilis: tsi(2021, 7, 29, 16, 0),
}

export type OlayTuru = 'tutusma' | 'hizliBuyume' | 'sicramaAtesi' | 'sirtGecisi' | 'kontrolAltinda'

export interface OnemliOlay {
  tur: OlayTuru
  zaman: number
}

export const onemliOlaylar: OnemliOlay[] = [
  { tur: 'tutusma', zaman: tsi(2021, 7, 28, 12, 0) },
  { tur: 'hizliBuyume', zaman: tsi(2021, 7, 28, 18, 40) },
  { tur: 'sicramaAtesi', zaman: tsi(2021, 7, 29, 3, 10) },
  { tur: 'sirtGecisi', zaman: tsi(2021, 7, 30, 15, 50) },
  { tur: 'kontrolAltinda', zaman: tsi(2021, 8, 6, 12, 0) },
]

/** Yayılım ekseni üzerinde etiketlenecek izokron anları. */
export const izokronAnlari: number[] = [
  tsi(2021, 7, 28, 18, 0),
  tsi(2021, 7, 29, 0, 0),
  tsi(2021, 7, 29, 12, 0),
  tsi(2021, 7, 30, 12, 0),
  tsi(2021, 8, 1, 12, 0),
]

/** Sahte yayılım modelinin parametreleri (bkz. model/yayilim.ts). */
export const yayilimParametreleri = {
  /** Tutuşma noktası (km). */
  tutusma: { x: -4, z: -18 },
  /** Ana yayılım yönü, kuzeyden saat yönünde derece (rüzgârın estiği yön). */
  yonDerece: 165,
  /** Arka cephenin baş cepheye oranı. */
  geriOrani: 0.15,
  /** Yarı genişliğin baş cephe mesafesine oranı. */
  genislikOrani: 0.32,
  /** Sınır düzensizliği (0 = düzgün elips). */
  duzensizlik: 0.2,
}

/** Hava modelinin temel değerleri (bkz. model/hava.ts). */
export const havaParametreleri = {
  ortalamaSicaklik: 31,
  sicaklikGenligi: 9,
  ortalamaNem: 32,
  nemGenligi: 20,
  ortalamaRuzgar: 24,
  ruzgarGenligi: 14,
  /** Rüzgârın geldiği yön (derece). */
  ruzgarYonu: 340,
}

export type YerTuru = 'tepe' | 'su'

export interface YerEtiketi {
  ad: string
  tur: YerTuru
  x: number
  z: number
}

/** Haritadaki yer etiketleri. Konumlar temsilidir. */
export const yerEtiketleri: YerEtiketi[] = [
  { ad: 'Kızıldağ', tur: 'tepe', x: -30, z: -30 },
  { ad: 'Çaltepe', tur: 'tepe', x: 22, z: -8 },
  { ad: 'Karadağ', tur: 'tepe', x: 14, z: 10 },
  { ad: 'Oymapınar Barajı', tur: 'su', x: 18, z: -30 },
  { ad: 'Akdeniz', tur: 'su', x: 0, z: 38 },
]

/** Baraj gölü: elips çanak ve su yüzeyi yüksekliği (m). */
export const baraj = { x: 18, z: -30, yaricapX: 7, yaricapZ: 2.4, aci: -0.5, suSeviyesiM: 420 }
