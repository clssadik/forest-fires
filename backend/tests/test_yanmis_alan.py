import numpy as np
import rasterio
from affine import Affine

from orman.izgara import Izgara
from orman.veri.yanmis_alan import (
    SIDDET_NODATA,
    _kirp,
    mozaikle,
    nbr,
    sahne_nbr,
    siddet_sinifi,
    tespitlerden_uzaklik_maskesi,
    yangin_maskesi,
    yansima_ayari,
)

# 30 m'lik 40 x 40 test ızgarası; sol üst köşe (300000, 4100000), UTM 36N.
IZGARA = Izgara("test", "EPSG:32636", Affine(30.0, 0, 300000.0, 0, -30.0, 4100000.0), 40, 40)


def hucre_merkezi(satir: int, sutun: int) -> tuple[float, float]:
    return IZGARA.transform @ (sutun + 0.5, satir + 0.5)


def test_nbr_bilinen_degerler_ve_sifir_toplam():
    nir = np.array([0.4, 0.1, 0.0, 0.3])
    swir2 = np.array([0.1, 0.4, 0.0, 0.3])
    sonuc = nbr(nir, swir2)
    np.testing.assert_allclose(sonuc[:2], [0.6, -0.6], rtol=1e-6)
    assert np.isnan(sonuc[2])
    assert sonuc[3] == 0
    assert sonuc.dtype == np.float32


def test_siddet_sinifi_key_benson_sinirlari():
    dnbr = np.array([-0.3, -0.1, 0.0, 0.1, 0.27, 0.44, 0.66, 1.2, np.nan])
    np.testing.assert_array_equal(siddet_sinifi(dnbr), [1, 2, 2, 3, 4, 5, 6, 6, SIDDET_NODATA])


def test_mozaikle_ilk_gecerli_degeri_alir():
    a = np.array([[1.0, np.nan], [np.nan, np.nan]], dtype="float32")
    b = np.array([[9.0, 2.0], [np.nan, 9.0]], dtype="float32")
    c = np.array([[9.0, 9.0], [3.0, 9.0]], dtype="float32")
    np.testing.assert_array_equal(mozaikle([a, b, c]), [[1.0, 2.0], [3.0, 9.0]])


def test_sahne_nbr_bulut_golge_ve_suyu_maskeler():
    nir = np.full(6, 0.4)
    swir2 = np.full(6, 0.1)
    scl = np.array([4, 5, 3, 6, 9, 0], dtype=np.uint8)  # bitki, çıplak, gölge, su, bulut, yok
    sonuc = sahne_nbr(nir, swir2, scl)
    assert not np.isnan(sonuc[:2]).any()
    assert np.isnan(sonuc[2:]).all()


def test_yangin_maskesi_tespite_yakin_buyuk_lekeyi_tutar_digerlerini_atar():
    dnbr = np.zeros(IZGARA.sekil, dtype="float32")
    dnbr[5:15, 5:15] = 0.5  # yangın lekesi, tespit içinde
    dnbr[25:35, 25:35] = 0.5  # büyük ama tespitlerden uzak leke (ör. hasat)
    dnbr[5:7, 30:32] = 0.5  # küçük leke (4 hücre), tespitin hemen yanında
    dnbr[8, 8] = np.nan  # leke içinde veri boşluğu
    tespit = np.array([hucre_merkezi(10, 10), hucre_merkezi(6, 31)])

    maske = yangin_maskesi(dnbr, 0.27, IZGARA, tespit, elek_hucre=11, yakinlik_m=100.0)

    assert maske.dtype == np.uint8
    assert maske[5:15, 5:15].sum() == 99  # 100 hücre - veri boşluğu
    assert maske[25:35, 25:35].sum() == 0
    assert maske[5:7, 30:32].sum() == 0
    assert maske.sum() == 99


def test_yangin_maskesi_esik_altini_almaz_ve_tespitsiz_bos_doner():
    dnbr = np.full(IZGARA.sekil, 0.2, dtype="float32")
    tespit = np.array([hucre_merkezi(20, 20)])
    assert yangin_maskesi(dnbr, 0.27, IZGARA, tespit).sum() == 0
    assert yangin_maskesi(dnbr, 0.1, IZGARA, np.empty((0, 2))).sum() == 0
    assert yangin_maskesi(dnbr, 0.1, IZGARA, tespit).sum() == 40 * 40


def test_tespitlerden_uzaklik_maskesi_yaricap():
    maske = tespitlerden_uzaklik_maskesi(IZGARA, np.array([hucre_merkezi(20, 20)]), 150.0)
    assert maske[20, 20] and maske[20, 24] and maske[16, 20]
    assert not maske[20, 26] and not maske[0, 0]


def test_kirp_ham_degerleri_ve_pencereyi_korur(tmp_path):
    # 20 m'lik sahte Sentinel-2 bandı, ızgaradan geniş; DN 0 = veri yok.
    kaynak = tmp_path / "bant.tif"
    transform = Affine(20.0, 0, 299000.0, 0, -20.0, 4101000.0)
    dn = np.full((200, 200), 3000, dtype=np.uint16)
    with rasterio.open(
        kaynak,
        "w",
        driver="GTiff",
        height=200,
        width=200,
        count=1,
        dtype="uint16",
        crs="EPSG:32636",
        transform=transform,
        nodata=0,
    ) as ds:
        ds.write(dn, 1)

    hedef = tmp_path / "kirpma.tif"
    _kirp(str(kaynak), IZGARA, hedef)

    with rasterio.open(hedef) as ds:
        veri = ds.read(1)
        sol, alt, sag, ust = ds.bounds
        assert ds.nodata == 0
    assert veri.dtype == np.uint16 and (veri == 3000).all()
    assert sol <= 300000 and ust >= 4100000
    assert sag >= 300000 + 40 * 30 and alt <= 4100000 - 40 * 30
    assert sag - sol < 4000  # yalnızca pencere okunmuş, tüm sahne değil


def test_yansima_ayari_earth_search_ofsetini_iki_kez_uygulamaz():
    bant = {"scale": 0.0001, "offset": -0.1, "nodata": 0}
    assert yansima_ayari({"earthsearch:boa_offset_applied": True}, bant) == (0.0001, 0.0, 0)
    assert yansima_ayari({"earthsearch:boa_offset_applied": False}, bant) == (0.0001, -0.1, 0)
    assert yansima_ayari({}, {}) == (1.0, 0.0, None)
