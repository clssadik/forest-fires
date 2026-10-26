/** Olay ekranı uç noktaları (backend/src/orman/olay.py, api.py) ve yanıt tipleri. */
import { ApiHatasi } from '../dogrulama/api'

export type OlayTuru = 'tutusma' | 'uyduGecisi' | 'hizliBuyume' | 'sirtaUlasma'

/** Arka ucun bulduğu olay; konum sahne koordinatı (km: +x doğu, +z güney). */
export interface HamOlay {
  tur: OlayTuru
  /** Tutuşmadan sonra saat. */
  saat: number
  x: number
  z: number
  firms_ha?: number
  model_ha?: number
  ha_sa?: number
  yukseklik_m?: number
}

export interface OlayBilgisi {
  ad: string
  baslik: string
  konum: string
  tutusma_utc: string
  bitis_utc: string
  gercek_ha: number
  model: {
    ad: string
    aciklama: string
    calisma_sayisi: number
    esit_alan_iou: number
    daire_iou: number | null
  }
  izgara: {
    satir: number
    sutun: number
    hucre_m: number
    genislik_km: number
    yukseklik_km: number
    /** [boylam, enlem]: sol üst, sağ üst, sağ alt, sol alt */
    koseler: [number, number][]
  }
  ortu_siniflari: Record<string, string>
  tutusma: { x: number; z: number }
  /** Saatlik seriler; hepsi `saatler` ile aynı uzunlukta. */
  seriler: {
    saatler: number[]
    model_ha: number[]
    firms_ha: number[]
    cephe_m: number[]
    hiz_m_dk: number[]
    ruzgar_kmsa: number[]
    /** Rüzgârın geldiği yön (derece). */
    ruzgar_yon: number[]
    sicaklik_c: number[]
    bagil_nem: number[]
    /** Ölü ince yakıt nemi (%). */
    yakit_nemi: number[]
  }
  /** Ana yayılım ekseni: tutuşmadan, model alanı gerçek alana ulaştığında en uzak yanmış noktaya. */
  eksen: {
    bas: { x: number; z: number }
    son: { x: number; z: number }
    uzunluk_km: number
    saat: number
    yukseklik_m: number[]
    toa_saat: (number | null)[]
  } | null
  olaylar: HamOlay[]
}

export interface OlayRasterlari {
  yukseklik: Float32Array
  ortu: Uint8Array
  /** Gerçek yanmış oran, 0–255. */
  gercek: Uint8Array
  /** Model yanma olasılığı, 0–255. */
  olasilik: Uint8Array
  /** Tutuşmadan sonra dakika; YOK = yanmadı. */
  modelToa: Uint16Array
  firmsToa: Uint16Array
}

/** uint16 zaman rasterlarında "yanmadı / veri yok". */
export const YOK = 65_535

async function iste(yol: string): Promise<Response> {
  const yanit = await fetch(`/api/yanginlar/${yol}`)
  if (!yanit.ok) {
    const govde = await yanit.json().catch(() => null)
    throw new ApiHatasi(yanit.status, govde?.detail ?? yanit.statusText)
  }
  return yanit
}

/** İlk çağrıda simülasyon yoksa arka uç onu çalıştırır (~10 sn). */
export const olayBilgisi = async (ad: string): Promise<OlayBilgisi> => (await iste(`${ad}/olay`)).json()

const bant = async (ad: string, bantAdi: string) => (await iste(`${ad}/olay/${bantAdi}`)).arrayBuffer()

export async function olayRasterlari(ad: string): Promise<OlayRasterlari> {
  const [yukseklik, ortu, gercek, olasilik, modelToa, firmsToa] = await Promise.all(
    ['yukseklik', 'ortu', 'gercek', 'olasilik', 'model_toa', 'firms_toa'].map((b) => bant(ad, b)),
  )
  return {
    yukseklik: new Float32Array(yukseklik),
    ortu: new Uint8Array(ortu),
    gercek: new Uint8Array(gercek),
    olasilik: new Uint8Array(olasilik),
    modelToa: new Uint16Array(modelToa),
    firmsToa: new Uint16Array(firmsToa),
  }
}
