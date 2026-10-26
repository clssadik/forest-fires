/**
 * Senaryo modunda yangın katmanını zaman kaydırıcısının her konumunda boyar.
 *
 * Arka uç üç bant gönderir: her hücrenin, modelin çalıştırmalarının %10, %50 ve %90'ında
 * yanmış olduğu en erken an (uint16 dakika, tutuşmadan bu yana; YOK = o olasılığa hiç
 * ulaşmadı). Bir t anında hücre, ulaştığı en yüksek bandın rengini alır: koyu kırmızı
 * "neredeyse kesin", turuncu "olası", sarı "düşük olasılık". Boyama aynı döngüde her bandın
 * alanını (hücre sayısı) da sayar; bantlar iç içedir (yüksek ⊂ orta ⊂ düşük).
 */

import { YOK, paketle } from '../dogrulama/boyama'

export type Bant = 'dusuk' | 'orta' | 'yuksek'
/** Arka ucun bant sırası (senaryo_modu.ESIKLER: 0,1 · 0,5 · 0,9). */
export const BANTLAR: Bant[] = ['dusuk', 'orta', 'yuksek']

export const BANT_RENKLERI: Record<Bant, string> = {
  dusuk: '#f3c04b',
  orta: '#e8692e',
  yuksek: '#a3221b',
}
const SAYDAMLIK: Record<Bant, number> = { dusuk: 150, orta: 205, yuksek: 235 }
const renkKodu = (b: Bant) => {
  const h = BANT_RENKLERI[b]
  return paketle(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), SAYDAMLIK[b])
}
const RENKLER = BANTLAR.map(renkKodu)

export interface SenaryoRasterlari {
  genislik: number
  yukseklik: number
  /** BANTLAR sırasıyla üç varış zamanı rasterı (dk). */
  bantlar: [Uint16Array, Uint16Array, Uint16Array]
}

/** Her bandın t anındaki hücre sayısı (BANTLAR sırasıyla). */
export type BantSayilari = [number, number, number]

/** `cikti`yı (ImageData'nın Uint32 görünümü) t anına göre boyar; bant alanlarını sayar. */
export function boya(r: SenaryoRasterlari, tDk: number, cikti: Uint32Array): BantSayilari {
  const [dusuk, orta, yuksek] = r.bantlar
  let nDusuk = 0
  let nOrta = 0
  let nYuksek = 0
  const n = r.genislik * r.yukseklik
  for (let i = 0; i < n; i++) {
    let renk = 0
    // Yüksek bant orta bandın, orta düşük bandın içinde: önce en genişine bakılır.
    if (dusuk[i] <= tDk) {
      nDusuk++
      renk = RENKLER[0]
      if (orta[i] <= tDk) {
        nOrta++
        renk = RENKLER[1]
        if (yuksek[i] <= tDk) {
          nYuksek++
          renk = RENKLER[2]
        }
      }
    }
    cikti[i] = renk
  }
  return [nDusuk, nOrta, nYuksek]
}

/** Hücrenin üç banda ulaşma anları (dk); ulaşmadıysa null. */
export function hucreZamanlari(r: SenaryoRasterlari, i: number): (number | null)[] {
  return r.bantlar.map((b) => (b[i] === YOK ? null : b[i]))
}
