from datetime import UTC, datetime

import numpy as np
import pandas as pd
from affine import Affine

from orman import gosterim
from orman.izgara import Izgara

# Antalya kıyısında 3 km × 3 km'lik küçük bir UTM 36N ızgarası (30 m, 100 × 100).
IZGARA = Izgara("deneme", "EPSG:32636", Affine(30.0, 0, 350_000.0, 0, -30.0, 4_090_000.0), 100, 100)


def test_dakika_kodla_nan_yok_negatif_sifir():
    dakika = np.array([np.nan, -5.0, 0.4, 12.6, 1e9], dtype=np.float32)
    kod = gosterim.dakika_kodla(dakika)
    assert kod.dtype == np.uint16
    assert kod.tolist() == [gosterim.YOK, 0, 0, 13, gosterim.YOK - 1]


def test_harita_izgarasi_hucresi_yerde_model_hucresi_kadar():
    harita = gosterim.harita_izgarasi(IZGARA)
    assert harita.crs == "EPSG:3857"
    # Mercator ızgarası UTM ızgarasını kapsar ve hücre sayısı aşağı yukarı aynıdır
    # (dönme yüzünden biraz fazla).
    assert 100 <= harita.genislik <= 110 and 100 <= harita.yukseklik <= 110


def test_koseler_izgara_sinirlarini_kapsiyor():
    harita = gosterim.harita_izgarasi(IZGARA)
    sol_ust, sag_ust, sag_alt, sol_alt = gosterim.koseler(harita)
    bati, guney, dogu, kuzey = IZGARA.wgs84_sinirlari()
    assert sol_ust[0] == sol_alt[0] and sag_ust[0] == sag_alt[0]  # Mercator'da eksene paralel
    assert sol_ust[1] == sag_ust[1] and sol_alt[1] == sag_alt[1]
    assert sol_ust[0] <= bati + 1e-4 and sag_ust[0] >= dogu - 1e-4
    assert sol_alt[1] <= guney + 1e-4 and sol_ust[1] >= kuzey - 1e-4


def test_haritaya_yansit_alani_ve_degeri_koruyor():
    harita = gosterim.harita_izgarasi(IZGARA)
    veri = np.full(IZGARA.sekil, np.nan, dtype=np.float32)
    veri[30:60, 40:70] = 125.0  # 900 hücrelik kare
    sonuc = gosterim.haritaya_yansit(veri, IZGARA, harita, np.nan)
    dolu = ~np.isnan(sonuc)
    assert np.unique(sonuc[dolu]).tolist() == [125.0]  # en yakın komşu: değer uydurmaz
    assert abs(dolu.sum() - 900) / 900 < 0.05  # yerde aynı alan


def test_sinir_geojson_tek_parca_ve_alan():
    maske = np.zeros(IZGARA.sekil, dtype=bool)
    maske[10:50, 10:50] = True
    maske[25:35, 25:35] = False  # delik
    geojson = gosterim.sinir_geojson(maske, IZGARA)
    (ozellik,) = geojson["features"]
    assert ozellik["properties"]["ha"] == round((1600 - 100) * 0.09)
    geometri = ozellik["geometry"]
    assert geometri["type"] == "Polygon"
    assert len(geometri["coordinates"]) == 2  # dış halka + delik
    lon, lat = geometri["coordinates"][0][0]
    assert 30 < lon < 32 and 36 < lat < 38


def test_firms_geojson_saat_tutusmaya_gore():
    tespitler = pd.DataFrame(
        {
            "latitude": [36.93, 36.94],
            "longitude": [31.38, 31.39],
            "zaman_utc": ["2021-07-28 08:00:00+00:00", "2021-07-28 12:30:00+00:00"],
            "instrument": ["VIIRS", "MODIS"],
            "satellite": ["N", "Terra"],
            "frp": [5.0, np.nan],
        }
    )
    geojson = gosterim.firms_geojson(tespitler, datetime(2021, 7, 28, 9, tzinfo=UTC))
    ozellikler = [f["properties"] for f in geojson["features"]]
    assert [o["saat"] for o in ozellikler] == [-1.0, 3.5]
    assert ozellikler[1]["frp"] is None
    assert geojson["features"][0]["geometry"]["coordinates"] == [31.38, 36.93]


def test_png_imzasi():
    rgba = np.zeros((4, 6, 4), dtype=np.uint8)
    assert gosterim.png(rgba)[:8] == b"\x89PNG\r\n\x1a\n"
