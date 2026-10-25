from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from affine import Affine

from orman.izgara import MANAVGAT_2021, Izgara
from orman.veri.hava import ruzgar_uv
from orman.veri.hava_alani import (
    ALAN_DEGISKENLERI,
    HavaAlani,
    idw_agirliklari,
    idw_ortalama,
    kaba_alan_hesapla,
    kaba_izgara,
    kaba_ortalama,
)

T0 = datetime(2021, 7, 28, 9, tzinfo=UTC)


def _kucuk_izgara() -> Izgara:
    """5 satır x 6 sütun, 30 m hücreli ince ızgara (kaba çarpan 2 ile 3 x 3 kaba ızgara)."""
    return Izgara(
        ad="test",
        crs="EPSG:32636",
        transform=Affine(30.0, 0, 500000.0, 0, -30.0, 4000000.0),
        genislik=6,
        yukseklik=5,
    )


def _alanlar(saat: int, kaba_sekil: tuple[int, int], deger: float = 0.0) -> dict[str, np.ndarray]:
    return {ad: np.full((saat, *kaba_sekil), deger, dtype=np.float32) for ad in ALAN_DEGISKENLERI}


def test_idw_nokta_uzerinde_nokta_degeri():
    kaynak = np.array([[0.0, 0.0], [1000.0, 0.0], [0.0, 1000.0]])
    agirlik = idw_agirliklari(kaynak[[1]], kaynak)
    degerler = np.array([[10.0, 20.0, 30.0]])
    assert idw_ortalama(agirlik, degerler)[0, 0] == pytest.approx(20.0)


def test_idw_iki_nokta_ortasi_ortalama():
    kaynak = np.array([[0.0, 0.0], [1000.0, 0.0]])
    orta = np.array([[500.0, 0.0]])
    agirlik = idw_agirliklari(orta, kaynak)
    assert idw_ortalama(agirlik, np.array([[10.0, 30.0]]))[0, 0] == pytest.approx(20.0)


def test_idw_nan_kaynagi_atlar():
    kaynak = np.array([[0.0, 0.0], [1000.0, 0.0]])
    agirlik = idw_agirliklari(np.array([[500.0, 0.0]]), kaynak)
    sonuc = idw_ortalama(agirlik, np.array([[np.nan, 30.0]]))
    assert sonuc[0, 0] == pytest.approx(30.0)


def test_ruzgar_yonu_350_ile_10_arasi_kuzey_olur():
    # Aynı hızda, 350° ve 10°'den esen iki nokta; orta hücre ikisine eşit uzaklıkta.
    nokta_xy = np.array([[0.0, 0.0], [2000.0, 0.0]])
    u1, v1 = ruzgar_uv(5.0, 350.0)
    u2, v2 = ruzgar_uv(5.0, 10.0)
    olcumler = {
        "ruzgar_u": np.array([[u1, u2]]),
        "ruzgar_v": np.array([[v1, v2]]),
        "sicaklik_c": np.array([[20.0, 20.0]]),
        "bagil_nem": np.array([[50.0, 50.0]]),
    }
    sonuc = kaba_alan_hesapla(
        nokta_xy, np.array([10.0, 10.0]), olcumler, np.array([[1000.0, 0.0]]), np.array([10.0])
    )
    u, v = sonuc["ruzgar_u"][0, 0], sonuc["ruzgar_v"][0, 0]
    # Rüzgarın geldiği yön: atan2(-u, -v); 0° kuzeydir.
    yon = np.degrees(np.arctan2(-u, -v)) % 360
    assert min(yon, 360 - yon) < 1.0
    assert np.hypot(u, v) == pytest.approx(5.0 * np.cos(np.deg2rad(10.0)), rel=1e-3)


def test_sicaklik_lapse_rate_deniz_seviyesi_ve_hucre_yuksekligi():
    # 1000 m'de 20 °C: deniz seviyesinde 26.5 °C. Hücre 0 m'de olduğunda aynı değer kalır.
    sonuc = kaba_alan_hesapla(
        np.array([[0.0, 0.0]]),
        np.array([1000.0]),
        {
            "ruzgar_u": np.zeros((1, 1)),
            "ruzgar_v": np.zeros((1, 1)),
            "sicaklik_c": np.array([[20.0]]),
            "bagil_nem": np.array([[50.0]]),
        },
        np.array([[0.0, 0.0]]),
        np.array([0.0]),
    )
    assert sonuc["sicaklik_c"][0, 0] == pytest.approx(26.5, abs=1e-4)


def test_yuksek_hucrede_sicaklik_duser():
    # 100 m'deki 30 °C ölçümü deniz seviyesinde 30.65 °C; 1000 m'deki hücrede 24.15 °C olur.
    sonuc = kaba_alan_hesapla(
        np.array([[0.0, 0.0]]),
        np.array([100.0]),
        {
            "ruzgar_u": np.zeros((1, 1)),
            "ruzgar_v": np.zeros((1, 1)),
            "sicaklik_c": np.array([[30.0]]),
            "bagil_nem": np.array([[50.0]]),
        },
        np.array([[0.0, 0.0]]),
        np.array([1000.0]),
    )
    assert sonuc["sicaklik_c"][0, 0] == pytest.approx(30.0 + 100 * 0.0065 - 1000 * 0.0065, abs=1e-4)


def test_deniz_noktasi_varsayilan_olarak_disarida():
    # Nokta 0 deniz (rakım 0), nokta 1 karada (rakım 500). Hücre (5, 0) ikisine de eşit uzak.
    nokta_xy = np.array([[0.0, 0.0], [10.0, 0.0]])
    olcumler = {ad: np.array([[1.0, 99.0]]) for ad in ALAN_DEGISKENLERI}
    hucre = np.array([[5.0, 0.0]])
    sonuc = kaba_alan_hesapla(nokta_xy, np.array([0.0, 500.0]), olcumler, hucre, np.array([0.0]))
    assert sonuc["bagil_nem"][0, 0] == pytest.approx(99.0)  # yalnızca karadaki nokta kullanılır
    sonuc = kaba_alan_hesapla(
        nokta_xy, np.array([0.0, 500.0]), olcumler, hucre, np.array([0.0]), deniz_dahil=True
    )
    assert sonuc["bagil_nem"][0, 0] == pytest.approx(50.0)  # eşit ağırlık: (1 + 99) / 2


def test_kaba_izgara_boyut_ve_kose():
    kaba = kaba_izgara(MANAVGAT_2021, 30)
    assert kaba.cozunurluk == 900.0
    assert (kaba.transform.c, kaba.transform.f) == (
        MANAVGAT_2021.transform.c,
        MANAVGAT_2021.transform.f,
    )
    assert kaba.sekil == (53, 61)


def test_kaba_ortalama_nan_yok_sayar():
    veri = np.arange(4, dtype=np.float64).reshape(2, 2)
    veri[0, 0] = np.nan
    sonuc = kaba_ortalama(veri, carpan=2, kaba_sekil=(1, 1))
    assert sonuc[0, 0] == pytest.approx(2.0)  # (1 + 2 + 3) / 3


def test_zaman_araya_dogrusal_ve_aralik_disi_kenetlenir():
    izgara = _kucuk_izgara()
    alanlar = _alanlar(2, (3, 3))
    alanlar["sicaklik_c"][0] = 10.0
    alanlar["sicaklik_c"][1] = 20.0
    alan = HavaAlani(izgara, 2, np.array([0, 3600]) + int(T0.timestamp()), alanlar)

    orta = alan.alan(T0 + timedelta(minutes=30))["sicaklik_c"]
    assert np.allclose(orta, 15.0)
    assert np.allclose(alan.alan(T0 - timedelta(hours=5))["sicaklik_c"], 10.0)
    assert np.allclose(alan.alan(T0 + timedelta(hours=5))["sicaklik_c"], 20.0)


def test_bilineer_sabit_alani_sabit_tutar_ve_sekil_dogru():
    izgara = _kucuk_izgara()
    alanlar = _alanlar(1, (3, 3), deger=7.0)
    alan = HavaAlani(izgara, 2, np.array([int(T0.timestamp())]), alanlar)
    sonuc = alan.alan(T0)
    for ad in ALAN_DEGISKENLERI:
        assert sonuc[ad].shape == izgara.sekil
        assert sonuc[ad].dtype == np.float32
        assert np.allclose(sonuc[ad], 7.0)


def test_bilineer_kaba_merkezler_arasinda_enterpole_eder():
    # Kaba sütun değerleri 0, 1, 2 (çarpan 2). İnce sütun c'nin kaba konumu c/2 - 0.25'tir;
    # kenarlarda kaba ızgaraya kenetlenir.
    izgara = _kucuk_izgara()
    alanlar = _alanlar(1, (3, 3))
    alanlar["sicaklik_c"][0] = np.tile(np.array([0.0, 1.0, 2.0]), (3, 1))
    alan = HavaAlani(izgara, 2, np.array([int(T0.timestamp())]), alanlar)
    satir = alan.alan(T0)["sicaklik_c"][0]
    assert np.allclose(satir, [0.0, 0.25, 0.75, 1.25, 1.75, 2.0])


def test_kaydet_ve_oku_ayni_sonucu_verir(tmp_path):
    izgara = _kucuk_izgara()
    rng = np.random.default_rng(0)
    alanlar = {ad: rng.uniform(0, 30, (3, 3, 3)).astype(np.float32) for ad in ALAN_DEGISKENLERI}
    saatler = np.array([0, 3600, 7200]) + int(T0.timestamp())
    alan = HavaAlani(izgara, 2, saatler, alanlar)
    yol = tmp_path / "hava_alani.npz"
    alan.kaydet(yol)

    geri = HavaAlani.oku(yol, izgara)
    zaman = T0 + timedelta(minutes=45)
    for ad in ALAN_DEGISKENLERI:
        assert np.allclose(alan.alan(zaman)[ad], geri.alan(zaman)[ad])

    baska = Izgara(ad="baska", crs=izgara.crs, transform=izgara.transform, genislik=6, yukseklik=5)
    with pytest.raises(ValueError):
        HavaAlani.oku(yol, baska)
