import numpy as np
import rasterio
from rasterio.transform import from_bounds

from orman.izgara import MANAVGAT_2021, Izgara
from orman.veri.arazi_ortusu import (
    WORLDCOVER_SINIFLARI,
    YAKIT_SINIFLARI,
    _arazi_ortusunu_hizala,
    karo_adlari,
    yakit_sinifina_cevir,
)


def test_yakit_sinifina_cevir_tum_worldcover_kodlarini_esler():
    arazi = np.array(
        [[0, 10, 20, 30, 40], [50, 60, 70, 80, 90], [95, 100, 0, 255, 0]], dtype=np.uint8
    )
    beklenen = np.array([[0, 1, 2, 3, 4], [0, 0, 0, 0, 3], [2, 3, 0, 0, 0]], dtype=np.uint8)
    sonuc = yakit_sinifina_cevir(arazi)
    assert sonuc.dtype == np.uint8
    np.testing.assert_array_equal(sonuc, beklenen)


def test_worldcover_tablosu_tum_kodlari_icerir_ve_yakit_kodlari_gecerli():
    assert set(WORLDCOVER_SINIFLARI) == {10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100}
    assert {yakit for _, yakit in WORLDCOVER_SINIFLARI.values()} <= set(YAKIT_SINIFLARI)


def test_karo_adlari_manavgat_tek_karo():
    assert karo_adlari(MANAVGAT_2021.wgs84_sinirlari()) == ["N36E030"]


def test_karo_adlari_boylam_siniri_gecer():
    assert karo_adlari((2.9, 36.5, 3.2, 37.0)) == ["N36E000", "N36E003"]


def test_karo_adlari_enlem_siniri_gecer():
    assert karo_adlari((31.2, 35.5, 31.5, 36.5)) == ["N33E030", "N36E030"]


def test_karo_adlari_negatif_koordinatlar():
    assert karo_adlari((-6.5, -3.5, -5.5, -2.5)) == [
        "S06W009",
        "S06W006",
        "S03W009",
        "S03W006",
    ]


def test_karo_adlari_karo_kenarina_denk_gelen_kutu():
    # Kutunun doğu kenarı tam 33. derecede; W033 karosu gerekmez.
    assert karo_adlari((31.0, 36.5, 33.0, 37.0)) == ["N36E030"]


def test_arazi_ortusunu_hizala_30m_hucrede_cogunluk_sinifini_alir(tmp_path):
    iz = Izgara.bboxtan("test", (31.40, 36.90, 31.41, 36.91), "EPSG:32636", 30.0)
    bati, guney, dogu, kuzey = iz.wgs84_sinirlari()

    # 10 m'ye yakın kaynak (0.0001 derece): sol yarısı orman (10), sağ yarısı yapılaşma (50).
    pad, res = 0.002, 0.0001
    x0, x1 = bati - pad, dogu + pad
    y0, y1 = guney - pad, kuzey + pad
    genislik = round((x1 - x0) / res)
    yukseklik = round((y1 - y0) / res)
    orta = (bati + dogu) / 2
    boylamlar = x0 + (np.arange(genislik) + 0.5) * res
    satir = np.where(boylamlar < orta, 10, 50).astype(np.uint8)
    veri = np.tile(satir, (yukseklik, 1))

    kirpma = tmp_path / "kirpma.tif"
    with rasterio.open(
        kirpma,
        "w",
        driver="GTiff",
        height=yukseklik,
        width=genislik,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_bounds(x0, y0, x1, y1, genislik, yukseklik),
        nodata=0,
    ) as ds:
        ds.write(veri, 1)

    hedef = tmp_path / "arazi_ortusu.tif"
    _arazi_ortusunu_hizala(kirpma, iz, hedef)

    with rasterio.open(hedef) as ds:
        sonuc = ds.read(1)
        assert ds.crs.to_epsg() == 32636
        assert ds.nodata == 0
    assert sonuc.shape == iz.sekil
    assert (sonuc[:, 0] == 10).all()
    assert (sonuc[:, -1] == 50).all()
