import { describe, expect, it } from 'vitest'
import { YOK, type OlayBilgisi, type OlayRasterlari } from './api'
import { aradegerle, firmsKaynakAdi, OlayVerisi, pusulaYonu } from './veri'

const SAAT = 3_600_000

/** 2 satır × 3 sütun, 1 km hücre; batıdan doğuya yükselen arazi. */
function ornekVeri() {
  const bilgi = {
    ad: 'deneme',
    baslik: 'Deneme',
    konum: 'Bir yer',
    tutusma_utc: '2021-07-28T09:00:00Z',
    bitis_utc: '2021-07-28T13:00:00Z',
    gercek_ha: 100,
    model: {
      ad: 'model_v3',
      aciklama: 'v3',
      calisma_sayisi: 20,
      esit_alan_iou: 0.5,
      esit_alan_iou_sapma: 0.01,
      daire_iou: 0.4,
      esit_alan: { dogru_ha: 67, yanlis_alarm_ha: 33, kacirilan_ha: 33, iou: 0.5, dice: 0.67, kappa: 0.6 },
      esit_alan_esik_dk: 120,
      bitis: { model_ha: 400, iou: 0.25 },
      zaman: { ortanca_saat: -0.5, ceyrek_alt_saat: -2, ceyrek_ust_saat: 1, oran_12_saat_icinde: 0.9 },
      deneyler: [{ ad: 'daire', aciklama: 'Daire', iou: 0.4 }],
    },
    izgara: {
      satir: 2,
      sutun: 3,
      hucre_m: 1000,
      genislik_km: 3,
      yukseklik_km: 2,
      koseler: [
        [30, 37],
        [31, 37],
        [31, 36],
        [30, 36],
      ],
    },
    ortu_siniflari: {},
    tutusma: { x: -1, z: -0.5 },
    seriler: {
      saatler: [0, 1, 2, 3, 4],
      model_ha: [0, 100, 200, 300, 400],
      firms_ha: [0, 0, 50, 50, 80],
      cephe_m: [0, 1000, 2000, 2000, 2000],
      hiz_m_dk: [0, 16, 16, 0, 0],
      ruzgar_kmsa: [10, 20, 20, 20, 20],
      ruzgar_yon: [350, 10, 10, 10, 10],
      sicaklik_c: [30, 30, 30, 30, 30],
      bagil_nem: [20, 20, 20, 20, 20],
      yakit_nemi: [3, 3, 3, 3, 3],
    },
    eksen: {
      bas: { x: -1, z: -0.5 },
      son: { x: 1, z: -0.5 },
      uzunluk_km: 2,
      saat: 4,
      yukseklik_m: [0, 100, 200],
      toa_saat: [0, 1, null],
    },
    olaylar: [{ tur: 'tutusma', saat: 0, x: -1, z: -0.5 }],
    kanitlar: {
      sentinel2: null,
      firms: null,
      hava: { nokta_sayisi: 4, cozunurluk_km: 25 },
      dem: { cozunurluk_m: 30 },
      worldcover: { cozunurluk_m: 10, yil: 2020 },
      izgara: { cozunurluk_m: 30, satir: 10, sutun: 15 },
    },
  } satisfies OlayBilgisi
  const rasterlar: OlayRasterlari = {
    yukseklik: new Float32Array([0, 100, 200, 0, 100, 200]),
    ortu: new Uint8Array([1, 2, 5, 1, 1, 1]),
    gercek: new Uint8Array([255, 0, 0, 0, 0, 0]),
    olasilik: new Uint8Array([255, 51, 0, 0, 0, 0]),
    modelToa: new Uint16Array([0, 60, YOK, YOK, YOK, YOK]),
    firmsToa: new Uint16Array([90, YOK, YOK, YOK, YOK, YOK]),
  }
  return new OlayVerisi(bilgi, rasterlar)
}

describe('OlayVerisi', () => {
  const v = ornekVeri()

  it('hücre merkezleri ızgaranın ortasına göre km', () => {
    expect(v.hucreKonumu(0, 0)).toEqual({ x: -1, z: -0.5 })
    expect(v.indeks(1, 0.5)).toBe(5)
    expect(v.indeks(2, 0)).toBe(-1)
  })

  it('yükseklik bilineer, eğim ve bakı doğuya yükselen yamaçta batıya bakar', () => {
    expect(v.yukseklikM(-0.5, -0.5)).toBeCloseTo(50)
    const { egim, baki } = v.egimVeBaki(0, 0)
    expect(egim).toBeCloseTo((Math.atan(0.1) * 180) / Math.PI, 1)
    expect(baki).toBeCloseTo(270)
  })

  it('rasterlardan örtü, varış, olasılık, gerçek alan', () => {
    expect(v.ortu(-1, -0.5)).toBe('orman')
    expect(v.ortu(1, -0.5)).toBe('su')
    expect(v.toaSaat(0, -0.5)).toBe(1)
    expect(v.toaSaat(1, -0.5)).toBe(Infinity)
    expect(v.firmsSaat(-1, -0.5)).toBe(1.5)
    expect(v.olasilik(0, -0.5)).toBeCloseTo(0.2)
    expect(v.gercek(-1, -0.5)).toBe(1)
  })

  it('seriler zamanda doğrusal, tutuşmadan önce sıfır', () => {
    expect(v.yananAlanHa(v.tutusmaMs - SAAT)).toBe(0)
    expect(v.yananAlanHa(v.tutusmaMs + 1.5 * SAAT)).toBeCloseTo(150)
    expect(v.hava(v.tutusmaMs + 0.5 * SAAT).ruzgarKmSa).toBeCloseTo(15)
    // 350° ile 10° arasının ortası kuzeydir, 180° değil.
    const yon = v.hava(v.tutusmaMs + 0.5 * SAAT).ruzgarYonu
    expect(Math.min(yon, 360 - yon)).toBeLessThan(1)
  })

  it('eksen: cephe konumu ve izokron noktası', () => {
    expect(v.eksendeCepheKm(v.tutusmaMs + 2 * SAAT)).toBe(1)
    expect(v.eksenIzokronu(0.5)).toBeNull()
    expect(v.eksenIzokronu(1)).toEqual({ x: 0, z: -0.5 })
  })

  it('WGS84 konumu köşelerden', () => {
    const { enlem, boylam } = v.konum(0, 0)
    expect(boylam).toBeCloseTo(30.5)
    expect(enlem).toBeCloseTo(36.5)
  })

  it('olaylar Unix ms ve sahne konumuyla', () => {
    expect(v.olaylar[0]).toMatchObject({ tur: 'tutusma', zaman: v.tutusmaMs, x: -1 })
  })
})

describe('yardımcılar', () => {
  it('aradegerle kenarlara kenetlenir', () => {
    expect(aradegerle([0, 10], [0, 100], -5)).toBe(0)
    expect(aradegerle([0, 10], [0, 100], 2.5)).toBe(25)
    expect(aradegerle([0, 10], [0, 100], 50)).toBe(100)
  })

  it('pusula yönü', () => {
    expect(pusulaYonu(0)).toBe('K')
    expect(pusulaYonu(359)).toBe('K')
    expect(pusulaYonu(225)).toBe('GB')
  })
})

describe('firmsKaynakAdi', () => {
  it('uydu ve algılayıcı adını okunur yazar', () => {
    expect(firmsKaynakAdi('VIIRS_NOAA20_SP')).toBe('VIIRS NOAA-20')
    expect(firmsKaynakAdi('VIIRS_SNPP_NRT')).toBe('VIIRS S-NPP')
    expect(firmsKaynakAdi('MODIS_SP')).toBe('MODIS')
    expect(firmsKaynakAdi('BILINMEYEN')).toBe('BILINMEYEN')
  })
})
