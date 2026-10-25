"""TOA önizlemesi testleri: yalnızca sentetik diziler kullanılır (gerçek veri okunmaz)."""

from types import SimpleNamespace

import numpy as np
import rasterio

from orman.model.onizleme import (
    GERCEK_SINIR_RENGI,
    ISARET_MERKEZ_RENGI,
    ISARET_RENGI,
    ISOKRON_RENGI,
    onizleme_yaz,
    toa_rgb,
)
from orman.veri.bolge_paketi import DENIZ_RENGI

SATIR, SUTUN = 20, 30


def _sahne():
    """Sol iki sütun deniz. Yanan alan satır 5..14, sütun 5..24; TOA her sütunda 60 dk artar
    (sütun 5 = 0 saat, sütun 24 = 19 saat). Gerçek yanmış alan satır 3..16, sütun 3..26."""
    toa = np.full((SATIR, SUTUN), np.nan, dtype=np.float32)
    toa[5:15, 5:25] = (np.arange(5, 25) - 5) * 60.0
    deniz = np.zeros((SATIR, SUTUN), dtype=bool)
    deniz[:, :2] = True
    golge = np.full((SATIR, SUTUN), 0.5)
    gercek = np.zeros((SATIR, SUTUN), dtype=np.uint8)
    gercek[3:17, 3:27] = 1
    return toa, golge, deniz, gercek


def test_cikti_sekli_ve_tipi():
    rgb = toa_rgb(*_sahne()[:4])
    assert rgb.shape == (SATIR, SUTUN, 3)
    assert rgb.dtype == np.uint8


def test_yanmamis_kara_gri():
    toa, golge, deniz, gercek = _sahne()
    rgb = toa_rgb(toa, golge, deniz, gercek)
    maske = np.isnan(toa) & ~deniz & (gercek == 0)
    assert maske.sum() > 0
    assert np.all(rgb[maske, 0] == rgb[maske, 1])
    assert np.all(rgb[maske, 1] == rgb[maske, 2])


def test_deniz_rengi():
    toa, golge, deniz, gercek = _sahne()
    rgb = toa_rgb(toa, golge, deniz, gercek)
    assert np.all(rgb[deniz] == DENIZ_RENGI)


def test_erken_ve_gec_hucre_farkli_renk():
    rgb = toa_rgb(*_sahne()[:4])
    erken, gec = rgb[10, 5], rgb[10, 24]
    assert not np.array_equal(erken, gec)
    assert erken.sum() > gec.sum()  # erken açık sarı, geç koyu mor


def test_izokron_iki_zaman_bandi_arasinda_siyah():
    rgb = toa_rgb(*_sahne()[:4], aralik_saat=12.0)
    # 12 saat sınırı sütun 16 ile 17 arasındadır: her iki sütunun satır 5..14 hücreleri izokron.
    izokron = np.all(rgb == ISOKRON_RENGI, axis=2)
    assert izokron.sum() == 20
    assert set(np.unique(np.nonzero(izokron)[1])) == {16, 17}
    assert not np.array_equal(rgb[10, 10], ISOKRON_RENGI)


def test_gercek_yanmis_sinir_camgobegi():
    rgb = toa_rgb(*_sahne()[:4])
    for satir, sutun in [(3, 10), (16, 10), (8, 3), (8, 26)]:
        assert tuple(rgb[satir, sutun]) == GERCEK_SINIR_RENGI
    assert tuple(rgb[8, 8]) != GERCEK_SINIR_RENGI  # maske içi, sınır değil


def test_tutusma_isareti():
    rgb = toa_rgb(*_sahne()[:4], tutusma=(8, 10))
    assert tuple(rgb[8, 10]) == ISARET_MERKEZ_RENGI
    assert tuple(rgb[5, 7]) == ISARET_RENGI
    assert tuple(rgb[11, 13]) == ISARET_RENGI
    assert tuple(rgb[12, 10]) != ISARET_RENGI  # 7x7 dışında


def test_tutusma_isareti_kenarda_kirpilir():
    rgb = toa_rgb(*_sahne()[:4], tutusma=(0, 0))
    assert tuple(rgb[0, 0]) == ISARET_MERKEZ_RENGI
    assert tuple(rgb[3, 3]) == ISARET_RENGI


def test_onizleme_yaz_png_uretir(tmp_path):
    toa, _golge, deniz, gercek = _sahne()
    arazi = np.where(deniz, 80, 40).astype(np.uint8)
    paket = SimpleNamespace(
        yukseklik=np.zeros((SATIR, SUTUN), dtype=np.float32),
        arazi_ortusu=arazi,
        yanmis_alan=gercek,
        senaryo=SimpleNamespace(izgara=SimpleNamespace(cozunurluk=30.0)),
    )
    yol = onizleme_yaz(paket, toa, tmp_path / "toa.png", tutusma=(8, 10))
    with rasterio.open(yol) as ds:
        veri = ds.read()
    assert veri.shape == (3, SATIR, SUTUN)
    assert tuple(veri[:, 8, 10]) == ISARET_MERKEZ_RENGI
