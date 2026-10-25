import numpy as np
import pytest

from orman.veri.hava import SUTUNLAR, kafes_noktalari, ruzgar_uv, tabloya_cevir


def _konum(enlem: float, boylam: float, sicaklik: list[float]) -> dict:
    """Open-Meteo'nun tek konum yanıtıyla aynı şekilde, 2 saatlik elle yazılmış bir örnek."""
    return {
        "latitude": enlem,
        "longitude": boylam,
        "utc_offset_seconds": 0,
        "timezone": "GMT",
        "elevation": 12.0,
        "hourly_units": {"time": "iso8601", "temperature_2m": "°C", "wind_speed_10m": "m/s"},
        "hourly": {
            "time": ["2021-07-28T09:00", "2021-07-28T10:00"],
            "temperature_2m": sicaklik,
            "relative_humidity_2m": [40, None],
            "wind_speed_10m": [5.0, 2.0],
            "wind_direction_10m": [0, 270],
            "wind_gusts_10m": [7.5, 3.0],
            "precipitation": [0.0, 0.2],
        },
    }


def test_ruzgar_uv_pusula_yonleri():
    # Rüzgar GELDİĞİ yönden: kuzeyden esen rüzgar güneye akar (v < 0).
    u, v = ruzgar_uv(10.0, 0)
    assert u == pytest.approx(0.0, abs=1e-9) and v == pytest.approx(-10.0)
    # Doğudan esen: batıya akar (u < 0).
    u, v = ruzgar_uv(10.0, 90)
    assert u == pytest.approx(-10.0) and v == pytest.approx(0.0, abs=1e-9)
    # Güneyden esen: kuzeye akar (v > 0).
    u, v = ruzgar_uv(10.0, 180)
    assert u == pytest.approx(0.0, abs=1e-9) and v == pytest.approx(10.0)
    # Batıdan esen: doğuya akar (u > 0).
    u, v = ruzgar_uv(10.0, 270)
    assert u == pytest.approx(10.0) and v == pytest.approx(0.0, abs=1e-9)


def test_ruzgar_uv_kuzeydogu_kosegeni():
    # 45°: kuzeydoğudan esen rüzgar güneybatıya akar; u ve v ikisi de negatif.
    u, v = ruzgar_uv(np.sqrt(2) * 10, 45)
    assert u == pytest.approx(-10.0) and v == pytest.approx(-10.0)


def test_ruzgar_uv_dizi_uzerinde_calisir():
    u, v = ruzgar_uv(np.array([10.0, 10.0]), np.array([0.0, 180.0]))
    assert np.allclose(u, [0.0, 0.0], atol=1e-9)
    assert np.allclose(v, [-10.0, 10.0])


def test_kafes_noktalari_sayi_ve_kose():
    bbox = (31.19, 36.69, 31.81, 37.13)
    noktalar = kafes_noktalari(bbox, nx=4, ny=3)
    assert len(noktalar) == 12
    assert len(set(noktalar)) == 12
    # Dört köşe de kafeste olmalı (enlem, boylam sırası)
    for enlem, boylam in [(36.69, 31.19), (36.69, 31.81), (37.13, 31.19), (37.13, 31.81)]:
        assert any(
            np.isclose(e, enlem) and np.isclose(b, boylam) for e, b in noktalar
        ), (enlem, boylam)
    # Kutunun dışına çıkılmamalı
    assert all(bbox[0] <= b <= bbox[2] and bbox[1] <= e <= bbox[3] for e, b in noktalar)


def test_kafes_noktalari_boyut_parametresi():
    assert len(kafes_noktalari((31.0, 36.0, 32.0, 37.0), nx=2, ny=2)) == 4
    assert len(kafes_noktalari((31.0, 36.0, 32.0, 37.0), nx=5, ny=4)) == 20
    with pytest.raises(ValueError):
        kafes_noktalari((31.0, 36.0, 32.0, 37.0), nx=1, ny=3)


def test_tabloya_cevir_tek_konum_sozlugu():
    tablo = tabloya_cevir(_konum(36.8, 31.4, [30.0, 31.5]))
    assert list(tablo.columns) == SUTUNLAR
    assert len(tablo) == 2
    ilk = tablo.iloc[0]
    assert ilk["zaman_utc"] == "2021-07-28T09:00:00Z"
    assert ilk["nokta"] == 0
    assert ilk["enlem"] == 36.8 and ilk["boylam"] == 31.4 and ilk["rakim"] == 12.0
    assert ilk["sicaklik_c"] == 30.0
    assert ilk["ruzgar_esinti_ms"] == 7.5
    # Rüzgar 0° (kuzey): v = -5, u = 0
    assert ilk["ruzgar_u"] == pytest.approx(0.0, abs=1e-9)
    assert ilk["ruzgar_v"] == pytest.approx(-5.0)


def test_tabloya_cevir_coklu_konum_listesi_ve_eksik_deger():
    yanit = [_konum(36.7, 31.2, [30.0, 31.0]), _konum(36.9, 31.6, [29.0, 28.5])]
    tablo = tabloya_cevir(yanit)
    assert len(tablo) == 4
    assert sorted(tablo["nokta"].unique().tolist()) == [0, 1]
    assert tablo.loc[tablo["nokta"] == 1, "enlem"].unique().tolist() == [36.9]
    # Saat dizisi her noktada 09:00 ile başlar ve UTC olarak yazılır
    assert tablo["zaman_utc"].str.endswith("Z").all()
    # Eksik nem (None) NaN olmalı, satır atılmamalı
    eksik = tablo[tablo["bagil_nem"].isna()]
    assert len(eksik) == 2
    # 270° (batıdan esen): u = +2 m/s, v = 0 (ikinci saat)
    ikinci = tablo[(tablo["nokta"] == 0) & (tablo["zaman_utc"] == "2021-07-28T10:00:00Z")].iloc[0]
    assert ikinci["ruzgar_u"] == pytest.approx(2.0)
    assert ikinci["ruzgar_v"] == pytest.approx(0.0, abs=1e-9)


def test_tabloya_cevir_utc_olmayan_yaniti_reddeder():
    konum = _konum(36.8, 31.4, [30.0, 31.5])
    konum["utc_offset_seconds"] = 10800
    with pytest.raises(ValueError):
        tabloya_cevir(konum)
