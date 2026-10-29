import json

import numpy as np
import pytest

from orman.veri.hava import SUTUNLAR, topluluk_tabloya_cevir


def _konum(enlem: float, boylam: float) -> dict:
    """Open-Meteo Topluluk API'sinin tek konum yanıtı; 2 üye (kontrol + member01)."""
    return {
        "latitude": enlem,
        "longitude": boylam,
        "utc_offset_seconds": 0,
        "timezone": "GMT",
        "elevation": 12.0,
        "hourly_units": {
            "time": "iso8601",
            "temperature_2m": "°C",
            "wind_speed_10m": "m/s",
        },
        "hourly": {
            "time": ["2026-10-29T00:00", "2026-10-29T01:00"],
            "temperature_2m": [20.0, 21.0],
            "temperature_2m_member01": [22.0, 23.0],
            "relative_humidity_2m": [40.0, 41.0],
            "relative_humidity_2m_member01": [50.0, 51.0],
            "wind_speed_10m": [5.0, 6.0],
            "wind_speed_10m_member01": [7.0, 8.0],
            "wind_direction_10m": [0.0, 90.0],
            "wind_direction_10m_member01": [180.0, 270.0],
            "wind_gusts_10m": [7.0, 8.0],
            "wind_gusts_10m_member01": [9.0, 10.0],
            "precipitation": [0.0, 0.0],
            "precipitation_member01": [0.0, 0.0],
        },
    }


def test_topluluk_uyeleri_kontrol_ve_member_sutunlari():
    tablo = topluluk_tabloya_cevir(_konum(36.9, 31.4))
    assert list(tablo.columns) == ["uye", *SUTUNLAR]
    assert sorted(tablo["uye"].unique().tolist()) == [0, 1]
    # Üye başına 2 saat
    assert tablo.groupby("uye").size().tolist() == [2, 2]

    kontrol = tablo[(tablo["uye"] == 0) & (tablo["zaman_utc"] == "2026-10-29T00:00:00Z")].iloc[0]
    assert kontrol["sicaklik_c"] == 20.0
    assert kontrol["bagil_nem"] == 40.0
    # 0° (kuzeyden esen) 5 m/s: u = 0, v = -5
    assert kontrol["ruzgar_u"] == pytest.approx(0.0, abs=1e-9)
    assert kontrol["ruzgar_v"] == pytest.approx(-5.0)

    uye1 = tablo[(tablo["uye"] == 1) & (tablo["zaman_utc"] == "2026-10-29T01:00:00Z")].iloc[0]
    assert uye1["sicaklik_c"] == 23.0
    # 270° (batıdan esen) 8 m/s: u = +8, v = 0
    assert uye1["ruzgar_u"] == pytest.approx(8.0)
    assert uye1["ruzgar_v"] == pytest.approx(0.0, abs=1e-9)


def test_topluluk_coklu_konum_listesi():
    tablo = topluluk_tabloya_cevir([_konum(36.7, 31.2), _konum(36.9, 31.6)])
    assert len(tablo) == 8  # 2 konum x 2 üye x 2 saat
    assert sorted(tablo["nokta"].unique().tolist()) == [0, 1]
    assert sorted(tablo["uye"].unique().tolist()) == [0, 1]


def test_topluluk_utc_olmayan_yaniti_reddeder():
    konum = _konum(36.9, 31.4)
    konum["utc_offset_seconds"] = 10800
    with pytest.raises(ValueError):
        topluluk_tabloya_cevir(konum)


def test_onbellek_kapsama_topluluk_yanitinda_da_calisir():
    from datetime import date

    from orman.veri.hava import _kapsiyor

    metin = json.dumps([{"hourly": {"time": ["2026-10-28T00:00", "2026-10-31T23:00"]}}])
    assert _kapsiyor(metin, date(2026, 10, 28), date(2026, 10, 31))
    assert not _kapsiyor(metin, date(2021, 7, 26), date(2021, 8, 8))


def test_uye_sutunlari_eksikse_ortak_uyeler_kullanilir():
    konum = _konum(36.9, 31.4)
    # member02 yalnızca bir değişkende var: tüm değişkenlerde bulunmadığı için atlanmalı.
    konum["hourly"]["temperature_2m_member02"] = [24.0, 25.0]
    tablo = topluluk_tabloya_cevir(konum)
    assert sorted(tablo["uye"].unique().tolist()) == [0, 1]
    assert np.isfinite(tablo["sicaklik_c"]).all()
