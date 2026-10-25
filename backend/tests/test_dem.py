import numpy as np

from orman.veri.dem import NODATA, egim_ve_baki, karo_kodlari, karo_url


def _duzlem(satir: int, sutun: int, dogu_artis: float, kuzey_artis: float) -> np.ndarray:
    """Her hücre doğuya gidince `dogu_artis`, kuzeye gidince `kuzey_artis` metre yükselen düzlem.

    Satır indeksi güneye doğru arttığı için kuzey adımı satırı azaltır.
    """
    r, c = np.mgrid[0:satir, 0:sutun]
    return dogu_artis * c + kuzey_artis * (satir - 1 - r)


def _aci_farki(a: np.ndarray, b: float) -> np.ndarray:
    """Dairesel (360°) açı farkı; 359 ile 1 arası 2 derecedir."""
    return np.abs((a - b + 180) % 360 - 180)


def test_dogu_yukselen_duzlem_bati_bakar():
    # 30 m yatayda 30 m yükseliş: eğim 45°, yamaç batıya bakar
    egim, baki = egim_ve_baki(_duzlem(7, 7, 30.0, 0.0), 30.0)
    ic = (slice(1, -1), slice(1, -1))
    np.testing.assert_allclose(egim[ic], 45.0, atol=1e-4)
    np.testing.assert_allclose(baki[ic], 270.0, atol=1e-3)


def test_kuzey_yukselen_duzlem_guney_bakar():
    # Kuzeye doğru yükselen yamaç güneye bakar
    egim, baki = egim_ve_baki(_duzlem(7, 7, 0.0, 30.0), 30.0)
    ic = (slice(1, -1), slice(1, -1))
    np.testing.assert_allclose(egim[ic], 45.0, atol=1e-4)
    np.testing.assert_allclose(_aci_farki(baki[ic], 180.0), 0.0, atol=1e-3)


def test_kuzeye_dusen_duzlem_kuzey_bakar():
    # Güneye doğru yükselen yamaç kuzeye bakar
    _, baki = egim_ve_baki(_duzlem(7, 7, 0.0, -30.0), 30.0)
    ic = (slice(1, -1), slice(1, -1))
    np.testing.assert_allclose(_aci_farki(baki[ic], 0.0), 0.0, atol=1e-3)


def test_kuzeydogu_yukselen_duzlem_guneybati_bakar():
    egim, baki = egim_ve_baki(_duzlem(7, 7, 30.0, 30.0), 30.0)
    ic = (slice(1, -1), slice(1, -1))
    np.testing.assert_allclose(egim[ic], np.degrees(np.arctan(np.sqrt(2))), atol=1e-4)
    np.testing.assert_allclose(baki[ic], 225.0, atol=1e-3)


def test_duz_yuzey_eksi_bir():
    egim, baki = egim_ve_baki(np.full((7, 7), 100.0, dtype="float32"), 30.0)
    ic = (slice(1, -1), slice(1, -1))
    np.testing.assert_allclose(egim[ic], 0.0, atol=1e-6)
    assert np.all(baki[ic] == -1)


def test_kenar_ve_nodata_komsulugu_nodata_olur():
    veri = _duzlem(7, 7, 30.0, 0.0)
    veri[3, 3] = NODATA
    egim, baki = egim_ve_baki(veri, 30.0)
    # Eksik hücrenin 3x3 komşuluğu sonuçsuz kalır
    assert np.all(egim[2:5, 2:5] == NODATA)
    assert np.all(baki[2:5, 2:5] == NODATA)
    # Kenar hücreler de çıkmaz (3x3 pencere tamamlanamaz)
    assert np.all(egim[0, :] == NODATA)
    assert np.all(egim[:, -1] == NODATA)
    # Uzaktaki iç hücreler geçerli kalır
    assert np.isclose(egim[1, 5], 45.0, atol=1e-4)


def test_karo_kodlari_iki_enlem_kusagini_kapsar():
    kodlar = karo_kodlari((31.19, 36.69, 31.81, 37.13))
    assert kodlar == ["N36_00_E031_00", "N37_00_E031_00"]


def test_karo_kodlari_tam_sinirda_fazla_karo_uretmez():
    assert karo_kodlari((31.0, 36.0, 32.0, 37.0)) == ["N36_00_E031_00"]


def test_karo_kodlari_negatif_enlem_boylam():
    assert karo_kodlari((-0.5, -0.5, 0.5, 0.5)) == [
        "S01_00_W001_00",
        "S01_00_E000_00",
        "N00_00_W001_00",
        "N00_00_E000_00",
    ]


def test_karo_url_s3_adresini_uretir():
    assert karo_url("N36_00_E031_00") == (
        "https://copernicus-dem-30m.s3.amazonaws.com/"
        "Copernicus_DSM_COG_10_N36_00_E031_00_DEM/Copernicus_DSM_COG_10_N36_00_E031_00_DEM.tif"
    )
