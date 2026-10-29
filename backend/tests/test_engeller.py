"""OSM engel katmanı: etiket -> güç tablosu ve ızgaraya işleme."""

import numpy as np

from orman.izgara import MANAVGAT_2021
from orman.veri.engeller import engel_haritasi, oge_gucu


def test_oge_gucu_etiketlerden():
    assert oge_gucu({"highway": "trunk"}) == 0.9
    assert oge_gucu({"highway": "trunk_link"}) == 0.9
    assert oge_gucu({"waterway": "stream"}) == 0.2
    assert oge_gucu({"highway": "footway"}) == 0.0


def test_engel_haritasi_en_guclu_engeli_tutar():
    izgara = MANAVGAT_2021
    bati, guney, dogu, kuzey = izgara.wgs84_sinirlari()
    orta = (guney + kuzey) / 2
    yatay = [{"lon": bati + 0.05, "lat": orta}, {"lon": dogu - 0.05, "lat": orta}]
    ogeler = [
        {"tags": {"highway": "track"}, "geometry": yatay},
        {"tags": {"waterway": "river"}, "geometry": yatay},
        {"tags": {"highway": "primary"}, "geometry": yatay[:1]},  # tek nokta: atlanır
    ]
    harita = engel_haritasi(ogeler, izgara)
    assert harita.shape == izgara.sekil
    assert np.allclose(harita[harita > 0], 0.8)  # nehir, üstündeki toprak yolu ezer
    assert (harita > 0).sum() > izgara.genislik * 0.8  # çizgi kutuyu baştan başa geçer
