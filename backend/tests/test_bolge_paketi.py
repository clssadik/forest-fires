import numpy as np

from orman.veri.bolge_paketi import DENIZ_RENGI, YAKIT_RENKLERI, golgelendirme, yakit_rgb


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
