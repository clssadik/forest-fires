import numpy as np

from orman.veri.bolge_paketi import (
    DENIZ_RENGI,
    SIDDET_RENKLERI,
    SINIR_RENGI,
    YAKIT_RENKLERI,
    golgelendirme,
    siddet_rgb,
    yakit_rgb,
)


def test_golgelendirme_duz_arazide_sabit():
    golge = golgelendirme(np.zeros((5, 5)), 30.0, aci=45.0)
    np.testing.assert_allclose(golge, np.sin(np.deg2rad(45.0)))


def test_golgelendirme_isiga_bakan_yamac_daha_parlak():
    # Batıya doğru yükselen düzlem doğuya bakar; kuzeybatıdan gelen ışığa sırtını döner.
    sutun = np.tile(np.arange(5), (5, 1))
    doguya_bakan = golgelendirme(-30.0 * sutun.astype(float), 30.0)
    batiya_bakan = golgelendirme(30.0 * sutun.astype(float), 30.0)
    assert batiya_bakan[2, 2] > doguya_bakan[2, 2]


def test_yakit_rgb_renkleri_ve_deniz():
    yakit = np.array([[0, 1, 2], [3, 4, 0]], dtype=np.uint8)
    deniz = np.array([[False, False, False], [False, False, True]])
    rgb = yakit_rgb(yakit, deniz)
    assert tuple(rgb[0, 1]) == YAKIT_RENKLERI[1]
    assert tuple(rgb[1, 1]) == YAKIT_RENKLERI[4]
    assert tuple(rgb[1, 2]) == DENIZ_RENGI


def test_siddet_rgb_sinir_ve_deniz():
    dnbr = np.full((5, 5), 0.8, dtype="float32")
    dnbr[0, 0] = np.nan
    yanmis = np.zeros((5, 5), dtype=np.uint8)
    yanmis[1:4, 1:4] = 1
    deniz = np.zeros((5, 5), bool)
    deniz[4, 4] = True
    rgb = siddet_rgb(dnbr, yanmis, deniz, np.ones((5, 5)))
    assert tuple(rgb[2, 2]) == SIDDET_RENKLERI[6]  # maskenin içi: şiddet rengi
    assert tuple(rgb[1, 1]) == SINIR_RENGI  # maskenin kenarı
    assert tuple(rgb[0, 0]) == SIDDET_RENKLERI[0]  # veri yok
    assert tuple(rgb[4, 4]) == DENIZ_RENGI
