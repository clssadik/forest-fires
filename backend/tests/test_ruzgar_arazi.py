"""WindNinja çıktısı okuma ve yön kuralı testleri (WindNinja çağrılmadan)."""

import math
from datetime import UTC, datetime

import numpy as np
import pytest
from affine import Affine

from orman.izgara import Izgara
from orman.model.yayilim import Ruzgar
from orman.veri.hava import ruzgar_uv
from orman.veri.hava_alani import HavaAlani
from orman.veri.ruzgar_arazi import (
    _tasi,
    alan_ortalamasi,
    ascii_oku,
    izgaraya_oturt,
    saat_gruplari,
)

T0 = datetime(2021, 7, 28, 9, tzinfo=UTC)


def _izgara(ad: str, carpan: int = 1, sol: float = 500000.0) -> Izgara:
    return Izgara(
        ad=ad,
        crs="EPSG:32636",
        transform=Affine(120.0 * carpan, 0, sol, 0, -120.0 * carpan, 4000000.0),
        genislik=4,
        yukseklik=3,
    )


def _ascii_yaz(yol, veri: np.ndarray, xll: float = 500000.0, yll: float = 3999640.0) -> None:
    """Standart ESRI ASCII ızgarası (kuzeyden güneye satırlar)."""
    satir, sutun = veri.shape
    with open(yol, "w", encoding="ascii") as dosya:
        dosya.write(
            f"ncols\t{sutun}\nnrows\t{satir}\nxllcorner\t{xll:.6f}\nyllcorner\t{yll:.6f}\n"
            f"cellsize\t120.0\nNODATA_value\t-9999\n"
        )
        dosya.writelines(" ".join(f"{x:.3f}" for x in veri[i]) + "\n" for i in range(satir))


def test_ascii_basligi_ve_nodata_okunur(tmp_path):
    veri = np.arange(12, dtype=np.float64).reshape(3, 4)
    veri[0, 0] = -9999.0
    yol = tmp_path / "deneme_vel.asc"
    _ascii_yaz(yol, veri)

    okunan, transform = ascii_oku(yol)
    assert okunan.shape == (3, 4)
    assert math.isnan(okunan[0, 0])
    assert okunan[1, 2] == 6.0
    # Sol üst köşe: xll, yll + satır * hücre; satır güneye artar.
    assert transform == Affine(120.0, 0, 500000.0, 0, -120.0, 4000000.0)


def test_ascii_xllcenter_kaydirilir(tmp_path):
    yol = tmp_path / "deneme.asc"
    yol.write_text(
        "ncols 2\nnrows 2\nxllcenter 500060\nyllcenter 3999700\ncellsize 120\n"
        "NODATA_value -9999\n1 2\n3 4\n",
        encoding="ascii",
    )
    _, transform = ascii_oku(yol)
    assert transform.c == pytest.approx(500000.0)
    assert transform.f == pytest.approx(3999880.0)


def test_windninja_uv_kurali_hava_ruzgar_uv_ile_ayni():
    """WindNinja `_u`/`_v` ızgaraları rüzgârın estiği yönü verir; kural `hava.ruzgar_uv`."""
    # Kaynak koddaki wind_sd_to_uv: u = -hız·sin(yön), v = -hız·cos(yön).
    for yon in (0.0, 45.0, 90.0, 135.0, 180.0, 270.0, 350.0):
        u, v = ruzgar_uv(7.0, yon)
        assert u == pytest.approx(-7.0 * math.sin(math.radians(yon)))
        assert v == pytest.approx(-7.0 * math.cos(math.radians(yon)))
    # Kuzeyden esen rüzgâr güneye akar (v < 0), doğudan esen batıya (u < 0).
    assert ruzgar_uv(5.0, 0.0)[1] < 0
    assert ruzgar_uv(5.0, 90.0)[0] < 0


def test_ascii_uv_alan_olarak_okunur_ve_ruzgara_cevrilir(tmp_path):
    """Üç ASCII ızgarası (hız, u, v) → HavaAlani → Ruzgar: yön ve hız korunur."""
    izgara = _izgara("test")
    kuzeyden = np.array([[3.0, 4.0, 5.0, 6.0]] * 3)
    u, v = ruzgar_uv(kuzeyden, 0.0)  # kuzeyden esen: u = 0, v = -hız
    yollar = {}
    for ad, veri in (("vel", kuzeyden), ("u", u), ("v", v)):
        yollar[ad] = tmp_path / f"deneme_{ad}.asc"
        _ascii_yaz(yollar[ad], veri[::-1])  # ASCII kuzeyden güneye; matris satırı da öyle

    alanlar = {"ruzgar_hizi_ms": np.zeros((1, 3, 4), np.float32)}
    for ad in ("u", "v", "vel"):
        veri, transform = ascii_oku(yollar[ad])
        alanlar[{"vel": "ruzgar_hizi_ms", "u": "ruzgar_u", "v": "ruzgar_v"}[ad]] = izgaraya_oturt(
            veri, transform, izgara
        )[None]
    alanlar["sicaklik_c"] = np.full((1, 3, 4), 30.0, np.float32)
    alanlar["bagil_nem"] = np.full((1, 3, 4), 20.0, np.float32)
    alan = HavaAlani(izgara, 1, np.array([T0.timestamp()]), alanlar)

    ruzgar = Ruzgar.hava_alanindan(alan, T0)
    u_, v_, hiz, _ = ruzgar.ornekle(1, 2, 0.0)
    assert hiz == pytest.approx(5.0)
    assert u_ == pytest.approx(0.0, abs=1e-6)
    assert v_ == pytest.approx(-5.0, abs=1e-6)
    assert math.degrees(math.atan2(-u_, -v_)) % 360.0 == pytest.approx(0.0, abs=1e-3)


def test_alan_ortalamasi_yonu_vektor_ortalamasindan_hesaplar():
    izgara = _izgara("test")
    alanlar = {
        ad: np.zeros((1, 3, 4), np.float32)
        for ad in ("ruzgar_u", "ruzgar_v", "ruzgar_hizi_ms", "sicaklik_c", "bagil_nem")
    }
    # İki hücre: doğudan (u=-1) ve batıdan (u=+1) esen eşit hız → vektör ortalaması sıfır.
    # Hız skaler ortalaması 2, yön tanımsız (atan2(0,0)=0) olur; ayrı testte yön kontrol edilir.
    alanlar["ruzgar_u"][0, :, :2], alanlar["ruzgar_u"][0, :, 2:] = -1.0, 1.0
    alanlar["ruzgar_hizi_ms"][:] = 2.0
    izgara_kaba = HavaAlani(izgara, 1, np.array([T0.timestamp()]), alanlar)
    hiz, yon = alan_ortalamasi(izgara_kaba, np.array([True]))
    assert hiz[0] == pytest.approx(2.0)

    # Tek yönlü alan: kuzeyden 4 m/s → yön 0°.
    alanlar["ruzgar_u"][:] = 0.0
    alanlar["ruzgar_v"][:] = -4.0
    alanlar["ruzgar_hizi_ms"][:] = 4.0
    izgara_kaba = HavaAlani(izgara, 1, np.array([T0.timestamp()]), alanlar)
    _, yon = alan_ortalamasi(izgara_kaba, np.array([True]))
    assert yon[0] == pytest.approx(0.0, abs=1e-4)


def test_saat_gruplari_benzer_saatleri_birler():
    hiz = np.array([3.0, 3.1, 3.0, 8.0, 3.05])
    yon = np.array([40.0, 42.0, 41.0, 200.0, 39.0])
    indeks, temsiller = saat_gruplari(hiz, yon)
    assert indeks[0] == indeks[1] == indeks[2] == indeks[4]
    assert indeks[3] != indeks[0]
    assert len(temsiller) == 2
    assert temsiller[indeks[0]][0] == pytest.approx(np.mean([3.0, 3.1, 3.0, 3.05]))


def test_tasi_eski_kaba_alanı_yeni_ızgaraya_taşır():
    # Aynı alanı kaplayan iki kaba ızgara: eski 240 m (3 x 3), yeni 120 m (6 x 6).
    eski = Izgara("eski", "EPSG:32636", Affine(240.0, 0, 0.0, 0, -240.0, 720.0), 3, 3)
    yeni = Izgara("yeni", "EPSG:32636", Affine(120.0, 0, 0.0, 0, -120.0, 720.0), 6, 6)
    sabit = np.full((2, 3, 3), 7.0, dtype=np.float32)
    assert np.allclose(_tasi(sabit, eski, yeni), 7.0)

    # Satır yönünde artan alan: çift doğrusal taşıma ara değerleri üretmeli, eksen karışmamalı.
    satir_artisli = np.tile(np.arange(3, dtype=np.float32).reshape(3, 1), (1, 3))
    tasinan = _tasi(satir_artisli[None], eski, yeni)
    assert tasinan.shape == (1, 6, 6)
    assert np.allclose(tasinan[0, :, 0], [0.0, 0.25, 0.75, 1.25, 1.75, 2.0])
    assert np.allclose(tasinan[0, 0, :], 0.0)
