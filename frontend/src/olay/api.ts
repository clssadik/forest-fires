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
    esit_alan_iou_sapma: number | null
    daire_iou: number | null
    /** Ana ölçüt: bitişte Sørensen (yakalama ve isabetin harmonik ortalaması). */
    bitis_dice: number | null
    bitis_dice_sapma: number | null
    daire_dice: number | null
    /** Model alanı gerçek alana eşitlenince karışıklık matrisi (ha) ve ölçütler. */
    esit_alan: {
      dogru_ha: number
      yanlis_alarm_ha: number
      kacirilan_ha: number
      iou: number
      dice: number
      kappa: number
    }
    /** Alanın eşitlendiği an (tutuşmadan sonra dakika); hata katmanı buna göre çizilir. */
    esit_alan_esik_dk: number
    /** Modelin bitişte yaktığı alan ve ölçütleri; isabet: tahminin doğru oranı, duyarlılık: yakalama. */
    bitis: { model_ha: number; iou: number; dice: number; isabet: number; duyarlilik: number } | null
    /** Model − FIRMS varış farkı (saat); pozitif: model geç. */
    zaman: {
      ortanca_saat: number
      ceyrek_alt_saat: number
      ceyrek_ust_saat: number
      oran_12_saat_icinde: number
    } | null
    /** `orman-dogrula` deneyleri: eşit alanda IoU ve bitişte Sørensen. */
    deneyler: { ad: string; aciklama: string; iou: number; dice: number }[]
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
  kanitlar: Kanitlar
}

interface SentinelDonemi {
  tarihler: string[]
  ana_tarih: string | null
  en_cok_bulut: number
}

/** Doğrulamanın dayandığı verilerin künyesi (Kanıtlar sekmesi). */
export interface Kanitlar {
  sentinel2: {
    once: SentinelDonemi
    sonra: SentinelDonemi
    esik: number
    yanmis_ha: number
    /** dNBR şiddet sınıflarına göre alan (ha). */
    siddet_ha: Record<string, number>
  } | null
  firms: { toplam: number; kaynaklar: Record<string, number>; gordugu_ha: number } | null
  hava: { nokta_sayisi: number; cozunurluk_km: number }
  dem: { cozunurluk_m: number }
  worldcover: { cozunurluk_m: number; yil: number }
  izgara: { cozunurluk_m: number; satir: number; sutun: number }
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
