import { Color } from 'three'

/**
 * Güneşin gökyüzündeki konumu (NOAA'nın basitleştirilmiş formülü; ±0,5° yeterli) ve
 * güneş yüksekliğine göre gökyüzü, ışık ve sis renkleri. Sahne, global zaman ile
 * yangının konumundan güneşi hesaplar: gün batımı, gece ve sabah zaman kaydırıcısıyla gelir.
 */

const DERECE = Math.PI / 180

export interface GunesKonumu {
  /** Ufka göre yükseklik (derece; negatif: ufkun altında). */
  yukseklik: number
  /** Kuzeyden saat yönünde (derece). */
  azimut: number
}

export function gunesKonumu(zamanMs: number, enlem: number, boylam: number): GunesKonumu {
  const d = zamanMs / 86_400_000 + 2_440_587.5 - 2_451_545
  const g = (357.529 + 0.98560028 * d) * DERECE
  const q = 280.459 + 0.98564736 * d
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DERECE
  const e = (23.439 - 0.00000036 * d) * DERECE
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L))
  const dek = Math.asin(Math.sin(e) * Math.sin(L))
  const gmst = 18.697374558 + 24.06570982441908 * d
  const H = ((gmst * 15 + boylam) * DERECE - ra) % (2 * Math.PI)
  const fi = enlem * DERECE
  const yukseklik = Math.asin(Math.sin(fi) * Math.sin(dek) + Math.cos(fi) * Math.cos(dek) * Math.cos(H))
  const azimut = Math.atan2(-Math.sin(H), Math.tan(dek) * Math.cos(fi) - Math.sin(fi) * Math.cos(H))
  return { yukseklik: yukseklik / DERECE, azimut: ((azimut / DERECE) % 360 + 360) % 360 }
}

/** Güneşe doğru birim vektör, sahne ekseninde (+x doğu, +y yukarı, +z güney). */
export function gunesYonu({ yukseklik, azimut }: GunesKonumu): [number, number, number] {
  const y = yukseklik * DERECE
  const a = azimut * DERECE
  return [Math.sin(a) * Math.cos(y), Math.sin(y), -Math.cos(a) * Math.cos(y)]
}

export interface GokRenkleri {
  tepe: Color
  ufuk: Color
  /** Ana ışığın (güneş ya da ay) rengi ve şiddeti. */
  isik: Color
  isikSiddeti: number
  /** Yarıküre ışığı: gök ve zemin rengi, şiddet. */
  ortamGok: Color
  ortamZemin: Color
  ortamSiddeti: number
}

/** Güneş yüksekliğine (derece) göre anahtar kareler; aralarda doğrusal karışım. */
const ANAHTARLAR: { y: number; tepe: string; ufuk: string; isik: string; s: number; gok: string; zemin: string; o: number }[] = [
  // Gece: ay ışığı; analiz katmanları okunabilsin diye tam karanlık değil.
  { y: -18, tepe: '#04070f', ufuk: '#0d1424', isik: '#9db2dd', s: 0.55, gok: '#7d8fb8', zemin: '#1c1a22', o: 0.55 },
  { y: -8, tepe: '#0b1530', ufuk: '#2a2c48', isik: '#a9b4d8', s: 0.6, gok: '#7f8cb4', zemin: '#2a2428', o: 0.6 },
  { y: -2, tepe: '#1e3360', ufuk: '#b0604a', isik: '#e0906a', s: 0.9, gok: '#8a8eb0', zemin: '#3d3029', o: 0.62 },
  { y: 3, tepe: '#3a5f96', ufuk: '#f0a066', isik: '#ffab6b', s: 1.8, gok: '#a6a9c0', zemin: '#4f4033', o: 0.65 },
  { y: 12, tepe: '#4a7cbc', ufuk: '#e6c7a4', isik: '#ffd9a8', s: 2.7, gok: '#c4cfdd', zemin: '#5e4e3b', o: 0.68 },
  { y: 30, tepe: '#3d77c6', ufuk: '#bcd2e6', isik: '#fff1dc', s: 3.1, gok: '#dbe4ee', zemin: '#62513d', o: 0.7 },
  { y: 90, tepe: '#2f6cc4', ufuk: '#aecbe6', isik: '#ffffff', s: 3.2, gok: '#e2eaf3', zemin: '#665540', o: 0.72 },
]

const gecici = { a: new Color(), b: new Color() }

function karistir(hedef: Color, a: string, b: string, t: number) {
  return hedef.copy(gecici.a.set(a)).lerp(gecici.b.set(b), t)
}

/** `hedef` verilirse içine yazar (her karede yeni nesne üretmemek için). */
export function gokRenkleri(yukseklik: number, hedef?: GokRenkleri): GokRenkleri {
  const r = hedef ?? {
    tepe: new Color(),
    ufuk: new Color(),
    isik: new Color(),
    isikSiddeti: 0,
    ortamGok: new Color(),
    ortamZemin: new Color(),
    ortamSiddeti: 0,
  }
  let i = 0
  while (i < ANAHTARLAR.length - 2 && yukseklik > ANAHTARLAR[i + 1].y) i++
  const a = ANAHTARLAR[i]
  const b = ANAHTARLAR[i + 1]
  const t = Math.min(Math.max((yukseklik - a.y) / (b.y - a.y), 0), 1)
  karistir(r.tepe, a.tepe, b.tepe, t)
  karistir(r.ufuk, a.ufuk, b.ufuk, t)
  karistir(r.isik, a.isik, b.isik, t)
  karistir(r.ortamGok, a.gok, b.gok, t)
  karistir(r.ortamZemin, a.zemin, b.zemin, t)
  r.isikSiddeti = a.s + (b.s - a.s) * t
  r.ortamSiddeti = a.o + (b.o - a.o) * t
  return r
}
