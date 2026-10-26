from datetime import UTC, datetime

import numpy as np

from orman.senaryo_modu import (
    esik_toalari,
    kenara_ulasma_saati,
    kimlik,
    noktadan_senaryo,
    utm_crs,
)


def test_utm_dilimi():
    assert utm_crs(36.9, 31.4) == "EPSG:32636"  # Manavgat
    assert utm_crs(36.85, 28.09) == "EPSG:32635"  # Marmaris
    assert utm_crs(36.8, 34.6) == "EPSG:32636"  # Mersin
    assert utm_crs(-33.9, 18.4) == "EPSG:32734"  # güney yarımküre


def test_noktadan_senaryo_kare_izgara_ve_zaman():
    t = datetime(2026, 10, 26, 9, tzinfo=UTC)
    s = noktadan_senaryo(36.8123, 34.6411, t, yaricap_km=10)
    assert s.ad == "senaryolar/36.81_34.64"
    # ~20 km kenar, 30 m hücre; UTM'de kutu biraz eğik olduğu için birkaç hücre pay
    assert 660 <= s.izgara.genislik <= 700 and 660 <= s.izgara.yukseklik <= 700
    assert s.tutusma_konumu == (36.8123, 34.6411)
    assert (s.model_bitis_utc - t).total_seconds() == 48 * 3600
    assert s.baslangic.isoformat() == "2026-10-25" and s.bitis.isoformat() == "2026-10-28"


def test_yakin_tiklamalar_ayni_kimlik():
    assert kimlik(36.8123, 34.6411) == kimlik(36.8149, 34.6388)


def test_esik_toalari_siralama_istatistigi():
    # 10 çalıştırma, 1 hücre: 6 çalıştırmada yandı (10..60 dk), 4'ünde yanmadı.
    toalar = np.full((10, 1, 1), np.nan, dtype=np.float32)
    toalar[:6, 0, 0] = [60, 10, 50, 20, 40, 30]
    e = esik_toalari(toalar, (0.1, 0.5, 0.9))
    assert e[0, 0, 0] == 10  # 1 çalıştırma yeterli
    assert e[1, 0, 0] == 50  # 5. en erken
    assert np.isnan(e[2, 0, 0])  # 9 çalıştırma gerekirdi, yalnız 6'sında yandı


def test_esik_toalari_hic_yanmayan_hucre_nan():
    toalar = np.full((4, 2, 2), np.nan, dtype=np.float32)
    toalar[:, 0, 0] = 5
    e = esik_toalari(toalar, (0.5,))
    assert e[0, 0, 0] == 5 and np.isnan(e[0, 1, 1])


def test_kenara_ulasma():
    toa = np.full((100, 100), np.nan, dtype=np.float32)
    toa[50, 50] = 0
    assert kenara_ulasma_saati(toa, pay=10) is None
    toa[50, 5] = 600
    toa[3, 50] = 300
    assert kenara_ulasma_saati(toa, pay=10) == 5.0
