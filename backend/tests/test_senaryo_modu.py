from datetime import UTC, datetime

import numpy as np
import pytest
from affine import Affine

from orman.izgara import Izgara
from orman.senaryo_modu import (
    esik_toalari,
    hava_ozeti,
    kenara_ulasma_saati,
    kimlik,
    noktadan_senaryo,
    topluluk_alanlari,
    utm_crs,
    uye_secimi,
)
from orman.veri.hava import ruzgar_uv
from orman.veri.hava_alani import HavaAlani, kaba_izgara


def test_utm_dilimi():
    assert utm_crs(36.9, 31.4) == "EPSG:32636"  # Manavgat
    assert utm_crs(36.85, 28.09) == "EPSG:32635"  # Marmaris
    assert utm_crs(36.8, 34.6) == "EPSG:32636"  # Mersin
    assert utm_crs(-33.9, 18.4) == "EPSG:32734"  # güney yarımküre


def test_noktadan_senaryo_kare_izgara_ve_zaman():
    t = datetime(2026, 10, 26, 9, tzinfo=UTC)
    s = noktadan_senaryo(36.8123, 34.6411, t, yaricap_km=10)
    assert s.ad == "senaryolar/36.81_34.64"
    # ~20 km kenar, 30 m hücre; UTM'de kutu biraz eğik olduğu için birkaç hücre pay
    assert 660 <= s.izgara.genislik <= 700 and 660 <= s.izgara.yukseklik <= 700
    assert s.tutusma_konumu == (36.8123, 34.6411)
    assert (s.model_bitis_utc - t).total_seconds() == 48 * 3600
    assert s.baslangic.isoformat() == "2026-10-25" and s.bitis.isoformat() == "2026-10-28"


def test_yakin_tiklamalar_ayni_kimlik():
    assert kimlik(36.8123, 34.6411) == kimlik(36.8149, 34.6388)


def test_esik_toalari_siralama_istatistigi():
    # 10 çalıştırma, 1 hücre: 6 çalıştırmada yandı (10..60 dk), 4'ünde yanmadı.
    toalar = np.full((10, 1, 1), np.nan, dtype=np.float32)
    toalar[:6, 0, 0] = [60, 10, 50, 20, 40, 30]
    e = esik_toalari(toalar, (0.1, 0.5, 0.9))
    assert e[0, 0, 0] == 10  # 1 çalıştırma yeterli
    assert e[1, 0, 0] == 50  # 5. en erken
    assert np.isnan(e[2, 0, 0])  # 9 çalıştırma gerekirdi, yalnız 6'sında yandı


def test_esik_toalari_hic_yanmayan_hucre_nan():
    toalar = np.full((4, 2, 2), np.nan, dtype=np.float32)
    toalar[:, 0, 0] = 5
    e = esik_toalari(toalar, (0.5,))
    assert e[0, 0, 0] == 5 and np.isnan(e[0, 1, 1])


def test_kenara_ulasma():
    toa = np.full((100, 100), np.nan, dtype=np.float32)
    toa[50, 50] = 0
    assert kenara_ulasma_saati(toa, pay=10) is None
    toa[50, 5] = 600
    toa[3, 50] = 300
    assert kenara_ulasma_saati(toa, pay=10) == 5.0


def test_uye_secimi_esit_aralikli_ve_kontrol_uyesi():
    secilen = uye_secimi(51, 20)
    assert len(secilen) == 20
    assert len(set(secilen)) == 20  # her çalıştırma farklı üye
    assert secilen[0] == 0  # kontrol üyesi
    assert secilen[-1] == 50
    assert secilen == sorted(secilen)


def test_uye_secimi_az_uyede_dongu():
    assert uye_secimi(5, 12) == [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1]
    assert uye_secimi(20, 20) == list(range(20))
    with pytest.raises(ValueError):
        uye_secimi(0, 20)


def _sabit_alan(hiz: float, yon: float, sicaklik: float = 25.0) -> HavaAlani:
    """3 x 2 kaba hücreli, her yerde aynı rüzgâr/sıcaklık/nem veren küçük alan."""
    izgara = Izgara(
        ad="test",
        crs="EPSG:32636",
        transform=Affine(30.0, 0, 500000.0, 0, -30.0, 4000000.0),
        genislik=6,
        yukseklik=5,
    )
    carpan = 2
    kaba = kaba_izgara(izgara, carpan)
    sekil = (2, kaba.yukseklik, kaba.genislik)
    u, v = ruzgar_uv(hiz, yon)
    dizi = lambda x: np.full(sekil, x, dtype=np.float32)
    t0 = int(datetime(2026, 10, 29, 9, tzinfo=UTC).timestamp())
    return HavaAlani(
        izgara,
        carpan,
        np.array([t0, t0 + 3600]),
        {
            "ruzgar_u": dizi(u),
            "ruzgar_v": dizi(v),
            "ruzgar_hizi_ms": dizi(hiz),
            "sicaklik_c": dizi(sicaklik),
            "bagil_nem": dizi(40.0),
        },
    )


def test_hava_ozeti_uyelerin_ortalamasi_ve_yayilimi():
    t = datetime(2026, 10, 29, 9, tzinfo=UTC)
    ozet = hava_ozeti([_sabit_alan(5.0, 0.0, 20.0), _sabit_alan(10.0, 0.0, 30.0)], t, (0, 0), [0])
    assert ozet["ruzgar_hizi_ms"] == [7.5]  # üyelerin ortalaması
    assert ozet["sicaklik_c"] == [25.0]
    assert ozet["bagil_nem"] == [40.0]
    assert list(ozet["ruzgar_hizi_ms_yayilim"]) == ["p10", "p90"]
    assert ozet["ruzgar_hizi_ms_yayilim"]["p10"][0] == pytest.approx(5.5)
    assert ozet["ruzgar_hizi_ms_yayilim"]["p90"][0] == pytest.approx(9.5)
    # Mevcut alanlar korunmalı (ön yüz bunları okuyor).
    for ad in ("saatler", "ruzgar_hizi_ms", "ruzgar_yonu", "sicaklik_c", "bagil_nem"):
        assert ad in ozet


def test_hava_ozeti_yon_yayilimi_kuzey_cevresinde_dogru():
    # 350° ve 10°: vektör ortalaması 0° (kuzey); yayılım 360° çevresinde sarmalı.
    t = datetime(2026, 10, 29, 9, tzinfo=UTC)
    ozet = hava_ozeti([_sabit_alan(5.0, 350.0), _sabit_alan(5.0, 10.0)], t, (0, 0), [0])
    assert ozet["ruzgar_yonu"][0] in (0, 360)
    p10 = ozet["ruzgar_yonu_yayilim"]["p10"][0]
    p90 = ozet["ruzgar_yonu_yayilim"]["p90"][0]
    assert abs((p10 - 352 + 180) % 360 - 180) < 1
    assert abs((p90 - 8 + 180) % 360 - 180) < 1


def test_topluluk_alinamazsa_hata_doner(monkeypatch):
    t = datetime(2026, 10, 29, 9, tzinfo=UTC)
    senaryo = noktadan_senaryo(36.95, 31.45, t)

    def patlat(*args, **kwargs):
        raise RuntimeError("topluluk sunucusu yok")

    monkeypatch.setattr("orman.senaryo_modu.hava_modulu.topluluk_hazirla", patlat)
    alanlar, hata = topluluk_alanlari(senaryo, np.zeros(senaryo.izgara.sekil))
    assert alanlar is None
    assert "topluluk sunucusu yok" in hata
