/** Arka uç doğrulama uç noktaları (backend/src/orman/api.py) ve yanıt tipleri. */

export interface BaselineDeneyi {
  ad: string
  aciklama: string
  esit_alan_iou: number
  esit_alan_iou_sapma: number | null
  bitis_iou: number | null
}

export interface YanginBilgisi {
  ad: string
  baslik: string
  konum: string
  tutusma_utc: string
  bitis_utc: string
  tutusma_konumu: { enlem: number; boylam: number }
  harita: {
    genislik: number
    yukseklik: number
    /** [boylam, enlem]: sol üst, sağ üst, sağ alt, sol alt */
    koseler: [number, number][]
    sinirlar: [number, number, number, number]
  }
  gercek_ha: number
  tespit_sayisi: number
  baseline: { calisma_sayisi: number; deneyler: BaselineDeneyi[] } | null
}

export interface MekansalOlcutler {
  dogru_ha: number
  yanlis_alarm_ha: number
  kacirilan_ha: number
  model_ha: number
  gercek_ha: number
  iou: number
  dice: number
  kappa: number
  isabet: number
  duyarlilik: number
}

export interface SimulasyonSonucu {
  model: string
  aciklama: string
  calisma_sayisi: number
  olusturma_utc: string
  sure_sn: number
  olcutler: {
    esit_alan: MekansalOlcutler
    esit_alan_saat: number
    bitis: MekansalOlcutler
    zaman: {
      ortanca_saat: number
      ceyrek_alt_saat: number
      ceyrek_ust_saat: number
      oran_12_saat_icinde: number
    }
    yari_alan_saat: number | null
  }
  tohumlar: Record<string, { ortalama: number; sapma: number }>
  buyume_saatleri: number[]
  buyume_ha: number[]
  firms_buyume_ha: number[]
}

export class ApiHatasi extends Error {
  durum: number
  constructor(durum: number, mesaj: string) {
    super(mesaj)
    this.durum = durum
  }
}

async function iste(yol: string, secenek?: RequestInit): Promise<Response> {
  const yanit = await fetch(`/api/yanginlar/${yol}`, secenek)
  if (!yanit.ok) {
    const govde = await yanit.json().catch(() => null)
    throw new ApiHatasi(yanit.status, govde?.detail ?? yanit.statusText)
  }
  return yanit
}

export const yanginBilgisi = async (ad: string): Promise<YanginBilgisi> => (await iste(ad)).json()

/** Son simülasyon sonucu; henüz çalıştırılmadıysa null. */
export async function sonucGetir(ad: string): Promise<SimulasyonSonucu | null> {
  try {
    return await (await iste(`${ad}/sonuc`)).json()
  } catch (e) {
    if (e instanceof ApiHatasi && e.durum === 404) return null
    throw e
  }
}

export const simulasyonCalistir = async (ad: string, calisma = 20): Promise<SimulasyonSonucu> =>
  (await iste(`${ad}/simulasyon?calisma=${calisma}`, { method: 'POST' })).json()

export async function rasterGetir(ad: string, katman: 'model_toa' | 'firms_varis'): Promise<Uint16Array>
export async function rasterGetir(ad: string, katman: 'gercek'): Promise<Uint8Array>
export async function rasterGetir(ad: string, katman: string): Promise<Uint16Array | Uint8Array> {
  const tampon = await (await iste(`${ad}/raster/${katman}`)).arrayBuffer()
  return katman === 'gercek' ? new Uint8Array(tampon) : new Uint16Array(tampon)
}

export const altlikAdresi = (ad: string) => `/api/yanginlar/${ad}/altlik.png`
export const gercekAlanAdresi = (ad: string) => `/api/yanginlar/${ad}/gercek_alan`
export const firmsAdresi = (ad: string) => `/api/yanginlar/${ad}/firms`
