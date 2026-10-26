/** Senaryo modu uç noktaları (backend/src/orman/api.py, senaryo_modu.py) ve yanıt tipleri. */

import { ApiHatasi } from '../dogrulama/api'
import type { SenaryoRasterlari } from './boyama'

export interface SenaryoOzeti {
  kimlik: string
  model: string
  calisma_sayisi: number
  tutusma_utc: string
  bitis_utc: string
  tutusma_konumu: { enlem: number; boylam: number }
  olusturma_utc: string
  sureler: { veri_sn: number; model_sn: number }
  esikler: number[]
  saatler: number[]
  /** [bant][saat] ha; bant sırası düşük, orta, yüksek olasılık. */
  buyume_ha: number[][]
  /** Olası alanın hesap alanı kenarına dayandığı saat; dayanmadıysa null. */
  kenar_saat: number | null
  /** Tutuşma noktasında saatlik tahmin (saatler: tutuşmadan bu yana). */
  hava: {
    saatler: number[]
    ruzgar_hizi_ms: number[]
    /** Rüzgârın geldiği yön (derece, kuzeyden saat yönünde). */
    ruzgar_yonu: number[]
    sicaklik_c: number[]
    bagil_nem: number[]
  }
  /** Tutuşma hücresinin yakıt sınıfı: 1 orman, 2 maki, 3 ot, 4 tarım. */
  tutusma_yakiti: number
  harita: {
    genislik: number
    yukseklik: number
    /** [boylam, enlem]: sol üst, sağ üst, sağ alt, sol alt */
    koseler: [number, number][]
    sinirlar: [number, number, number, number]
  }
}

async function iste(yol: string, secenek?: RequestInit): Promise<Response> {
  const yanit = await fetch(`/api/senaryo${yol}`, secenek)
  if (!yanit.ok) {
    const govde = await yanit.json().catch(() => null)
    throw new ApiHatasi(yanit.status, typeof govde?.detail === 'string' ? govde.detail : yanit.statusText)
  }
  return yanit
}

export const senaryoCalistir = async (enlem: number, boylam: number): Promise<SenaryoOzeti> =>
  (await iste(`?enlem=${enlem.toFixed(5)}&boylam=${boylam.toFixed(5)}`, { method: 'POST' })).json()

/** Üç bant art arda gelir; her biri genişlik × yükseklik uint16. */
export async function rasterGetir(ozet: SenaryoOzeti): Promise<SenaryoRasterlari> {
  const tampon = await (await iste(`/${ozet.kimlik}/raster`)).arrayBuffer()
  const { genislik, yukseklik } = ozet.harita
  const n = genislik * yukseklik
  const bant = (k: number) => new Uint16Array(tampon, k * n * 2, n)
  return { genislik, yukseklik, bantlar: [bant(0), bant(1), bant(2)] }
}

export const altlikAdresi = (ozet: SenaryoOzeti) => `/api/senaryo/${ozet.kimlik}/altlik.png?v=${ozet.olusturma_utc}`
