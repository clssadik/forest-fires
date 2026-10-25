from datetime import date

from orman.veri.firms import _gun_parcalari


def test_gun_parcalari_bes_gunluk_bolunur():
    parcalar = _gun_parcalari(date(2021, 7, 27), date(2021, 8, 10))
    assert parcalar == [(date(2021, 7, 27), 5), (date(2021, 8, 1), 5), (date(2021, 8, 6), 5)]


def test_gun_parcalari_tek_gun():
    assert _gun_parcalari(date(2021, 7, 28), date(2021, 7, 28)) == [(date(2021, 7, 28), 1)]
