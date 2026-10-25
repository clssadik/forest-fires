import numpy as np
import rasterio
from rasterio.io import MemoryFile
from rasterio.warp import Resampling

from orman.izgara import MANAVGAT_2021, Izgara, izgaraya_yansit


def test_manavgat_izgarasi_makul_boyutta():
    iz = MANAVGAT_2021
    assert iz.cozunurluk == 30.0
    # ~54 km x ~47 km
    assert 1700 < iz.genislik < 1900
    assert 1500 < iz.yukseklik < 1650
    # Kenarlar hücre boyutuna hizalı
    assert iz.transform.c % 30 == 0 and iz.transform.f % 30 == 0


def test_wgs84_sinirlari_istenen_kutuyu_kapsar():
    bati, guney, dogu, kuzey = MANAVGAT_2021.wgs84_sinirlari()
    assert bati <= 31.20 and guney <= 36.70 and dogu >= 31.80 and kuzey >= 37.12


def test_izgaraya_yansit_ayni_izgarada_degeri_korur():
    iz = Izgara.bboxtan("kucuk", (31.40, 36.90, 31.41, 36.91), "EPSG:32636", 30.0)
    veri = np.arange(iz.genislik * iz.yukseklik, dtype="float32").reshape(iz.sekil)
    with MemoryFile() as mf:
        with mf.open(**iz.rasterio_profili("float32")) as ds:
            ds.write(veri, 1)
        with mf.open() as ds:
            sonuc = izgaraya_yansit(ds, iz, Resampling.nearest)
    np.testing.assert_array_equal(sonuc, veri)
    assert isinstance(rasterio.__version__, str)
