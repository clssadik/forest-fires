"""Yakıt nemi: denge nemi (Simard 1968) ve Rothermel nem sönümü; modelde gece yavaşlaması."""

from dataclasses import replace

import numpy as np
import pytest

from orman.model.nem import denge_nemi, nem_sonumu
from orman.model.yayilim import Arazi, Parametreler, Ruzgar, yayilim

BOYUT = 201
MERKEZ = (BOYUT // 2, BOYUT // 2)
HIZLI = Parametreler(hiz_olcegi=Parametreler().hiz_olcegi * 8, yanma_suresi_dk=15.0)


def test_denge_nemi_simard_uc_araligi():
    # Elle hesap; Simard formülünde sıcaklık °F: 40 °C = 104 °F, 20 °C = 68 °F.
    assert denge_nemi(40.0, 5.0) == pytest.approx(
        (0.03229 + 0.281073 * 5 - 0.000578 * 5 * 104) / 100, rel=1e-4
    )
    assert denge_nemi(40.0, 10.0) == pytest.approx(
        (2.22749 + 0.160107 * 10 - 0.01478 * 104) / 100, rel=1e-4
    )
    assert denge_nemi(20.0, 60.0) == pytest.approx(
        (21.0606 + 0.005565 * 3600 - 0.00035 * 60 * 68 - 0.483199 * 60) / 100, rel=1e-4
    )


def test_denge_nemi_nemle_artar_sicaklikla_azalir():
    nem = np.arange(5.0, 95.0, 5.0)
    d = denge_nemi(np.full_like(nem, 25.0), nem)
    assert np.all(np.diff(d) > 0)
    assert denge_nemi(15.0, 40.0) > denge_nemi(40.0, 40.0)


def test_nem_sonumu_rothermel():
    assert nem_sonumu(0.0, 0.25) == pytest.approx(1.0)
    assert nem_sonumu(0.25, 0.25) == pytest.approx(0.0, abs=1e-12)
    assert nem_sonumu(0.40, 0.25) == 0.0  # sönme neminin üstü: yanmaz
    r = 0.1 / 0.25
    assert nem_sonumu(0.1, 0.25) == pytest.approx(1 - 2.59 * r + 5.11 * r**2 - 3.52 * r**3)
    m = np.linspace(0.0, 0.25, 26)
    assert np.all(np.diff([nem_sonumu(x, 0.25) for x in m]) < 0)
    assert nem_sonumu(0.2, 0.0) == 1.0  # sönme nemi 0: nem etkisi kapalı (v1, v2)


def _duz_arazi() -> Arazi:
    return Arazi(
        yukseklik=np.zeros((BOYUT, BOYUT), dtype=np.float32),
        yanabilir=np.ones((BOYUT, BOYUT), dtype=bool),
        yakit=np.ones((BOYUT, BOYUT), dtype=np.uint8),
        cozunurluk=30.0,
    )


def _yanan(ruzgar, parametreler, tohumlar=range(4)) -> float:
    return np.mean(
        [
            np.count_nonzero(
                ~np.isnan(yayilim(_duz_arazi(), ruzgar, [MERKEZ], parametreler, t, 20))
            )
            for t in tohumlar
        ]
    )


def test_nemli_yakit_yavas_yanar():
    nemli = replace(HIZLI, sonme_nemi=0.25)
    kuru, islak = Ruzgar.sabit(0.0, 0.0, nem=0.03), Ruzgar.sabit(0.0, 0.0, nem=0.15)
    assert _yanan(islak, nemli) < 0.6 * _yanan(kuru, nemli)
    # Nem etkisi kapalıyken yakıt nemi sonucu değiştirmez.
    assert np.array_equal(
        yayilim(_duz_arazi(), kuru, [MERKEZ], HIZLI, 3, 20),
        yayilim(_duz_arazi(), islak, [MERKEZ], HIZLI, 3, 20),
        equal_nan=True,
    )


def test_nem_zamanla_degisir():
    # İlk 10 dk kuru, sonra sönme neminin üstü. Hücre hızlarını tutuştuğu anın havasıyla
    # belirlediği için 10. dakikadan sonra tutuşan hiçbir hücre komşusunu tutuşturamaz: varışlar
    # en geç 10 dk + yanma süresi.
    ruzgar = Ruzgar(
        dakikalar=np.array([0.0, 10.0, 10.001, 100.0]),
        u=np.zeros((4, 1, 1), dtype=np.float32),
        v=np.zeros((4, 1, 1), dtype=np.float32),
        hiz=np.zeros((4, 1, 1), dtype=np.float32),
        nem=np.array([0.03, 0.03, 0.5, 0.5], dtype=np.float32).reshape(4, 1, 1),
    )
    assert ruzgar.ornekle(0, 0, 5.0)[3] == pytest.approx(0.03)
    p = replace(HIZLI, sonme_nemi=0.25)
    toa = yayilim(_duz_arazi(), ruzgar, [MERKEZ], p, 0, 60)
    assert np.nanmax(toa) <= 10.001 + p.yanma_suresi_dk
    assert np.count_nonzero(~np.isnan(toa)) > 5
