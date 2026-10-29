"""Yayılım modeli v1: yapay senaryolarla fiziksel davranış testleri (bkz. docs/model.md)."""

import math
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import numpy as np
import pytest
from affine import Affine

from orman.izgara import Izgara
from orman.model.yayilim import (
    V2_YAKIT,
    Arazi,
    Parametreler,
    Ruzgar,
    _rastgele,
    coklu_yayilim,
    yakit_carpani,
    yayilim,
)
from orman.veri.hava_alani import ALAN_DEGISKENLERI, HavaAlani

BOYUT = 201
MERKEZ = (BOYUT // 2, BOYUT // 2)
# 8 yön: (satır adımı, sütun adımı). Satır güneye doğru artar.
YONLER = {
    "K": (-1, 0),
    "KD": (-1, 1),
    "D": (0, 1),
    "GD": (1, 1),
    "G": (1, 0),
    "GB": (1, -1),
    "B": (0, -1),
    "KB": (-1, -1),
}


def _duz_arazi(boyut: int = BOYUT) -> Arazi:
    return Arazi(
        yukseklik=np.zeros((boyut, boyut), dtype=np.float32),
        yanabilir=np.ones((boyut, boyut), dtype=bool),
        yakit=np.ones((boyut, boyut), dtype=np.uint8),
        cozunurluk=30.0,
    )


def _menziller(toa: np.ndarray, merkez=MERKEZ) -> dict[str, float]:
    """Her yönde, merkezden yanmış hücreler boyunca kesintisiz gidilebilen uzaklık (m)."""
    sonuc = {}
    for ad, (dr, dc) in YONLER.items():
        k = 0
        while True:
            r, c = merkez[0] + (k + 1) * dr, merkez[1] + (k + 1) * dc
            if not (0 <= r < toa.shape[0] and 0 <= c < toa.shape[1]) or np.isnan(toa[r, c]):
                break
            k += 1
        sonuc[ad] = k * 30.0 * np.hypot(dr, dc)
    return sonuc


# Hızlı zaman ölçeği (hız ve yanma süresi birlikte ölçeklenir): şekil aynı, testler küçük ızgarada
# kısa sürede biter. Varsayılanla aynı "hız × yanma süresi" çarpımı korunur.
HIZLI = Parametreler(
    hiz_olcegi=Parametreler().hiz_olcegi * 8,
    yanma_suresi_dk=Parametreler().yanma_suresi_dk / 8,
)


def _ortalama_menzil(arazi, ruzgar, bitis_dk, tohumlar=range(5), parametreler=HIZLI):
    """Birkaç tohumun ortalama yön menzilleri (rastgele dalgalanmayı azaltır)."""
    toplam = dict.fromkeys(YONLER, 0.0)
    for tohum in tohumlar:
        toa = yayilim(arazi, ruzgar, [MERKEZ], parametreler, tohum=tohum, bitis_dk=bitis_dk)
        for ad, m in _menziller(toa).items():
            toplam[ad] += m / len(tohumlar)
    return toplam


def test_tutusma_hucresi_sifirda_ve_toa_bitisi_asmaz():
    toa = yayilim(_duz_arazi(), Ruzgar.sabit(0.0, 0.0), [MERKEZ], HIZLI, 0, bitis_dk=30)
    assert toa[MERKEZ] == 0.0
    assert np.nanmax(toa) <= 30.0
    assert np.nanmin(toa) == 0.0
    assert toa.dtype == np.float32


def test_duz_ruzgarsiz_yaklasik_daire():
    menzil = _ortalama_menzil(_duz_arazi(), Ruzgar.sabit(0.0, 0.0), bitis_dk=60)
    degerler = np.array(list(menzil.values()))
    assert degerler.min() > 600  # yangın gerçekten büyüdü (> 20 hücre)
    # Daire: en uzun ve en kısa yön arasındaki fark küçük; köşegenler eksenlerden farklı değil.
    assert degerler.max() / degerler.min() < 1.25
    eksen = np.mean([menzil[y] for y in ("K", "D", "G", "B")])
    kosegen = np.mean([menzil[y] for y in ("KD", "GD", "GB", "KB")])
    assert kosegen / eksen == pytest.approx(1.0, abs=0.12)


def test_ruzgar_yonunde_uzar():
    # Batıdan esen 8 m/s rüzgar (doğuya doğru): yangın doğuya uzar.
    duz = _ortalama_menzil(_duz_arazi(), Ruzgar.sabit(0.0, 0.0), bitis_dk=60)
    menzil = _ortalama_menzil(_duz_arazi(), Ruzgar.sabit(8.0, 270.0), bitis_dk=60)
    assert menzil["D"] > duz["D"]  # rüzgar yönünde rüzgarsızdan hızlı
    assert menzil["D"] > 3.0 * menzil["B"]
    assert menzil["D"] > 1.3 * menzil["K"]
    assert menzil["K"] == pytest.approx(menzil["G"], rel=0.2)


def test_ruzgar_yonu_meteorolojik_kurala_uyar():
    # Kuzeyden esen rüzgar (0°) güneye iter.
    menzil = _ortalama_menzil(_duz_arazi(), Ruzgar.sabit(8.0, 0.0), bitis_dk=60)
    assert menzil["G"] > 2.0 * menzil["K"]


def test_yokus_yukari_hizlanir():
    # Kuzeye doğru 15° yükselen düzlem.
    arazi = _duz_arazi()
    satir = np.arange(BOYUT, dtype=np.float32)[:, None]
    arazi.yukseklik[:] = (BOYUT - satir) * 30.0 * np.tan(np.deg2rad(15.0))
    menzil = _ortalama_menzil(arazi, Ruzgar.sabit(0.0, 0.0), bitis_dk=30)
    assert menzil["K"] < 2900  # ızgara kenarına ulaşmadı
    assert menzil["K"] > 1.5 * menzil["G"]
    assert menzil["D"] == pytest.approx(menzil["B"], rel=0.2)


def test_yanmaz_bariyeri_gecmez():
    arazi = _duz_arazi()
    arazi.yanabilir[:, 130] = False  # tek hücre genişliğinde dikey şerit (ör. dere, yol)
    ruzgar = Ruzgar.sabit(10.0, 270.0)  # rüzgar bariyere doğru
    toa = yayilim(arazi, ruzgar, [MERKEZ], HIZLI, tohum=1, bitis_dk=600)
    assert not np.isnan(toa[:, 129]).all()  # yangın bariyere ulaştı
    assert np.isnan(toa[:, 130:]).all()


def test_v2_yakit_carpani_alexandridis_tablosu():
    # (1 + p_veg) · (1 + p_den): orman = kızılçam, normal yoğunluk; maki = çalılık;
    # ot ve tarım = tarım, seyrek (Alexandridis vd. 2008, Tablo 1).
    carpan = yakit_carpani(V2_YAKIT)
    assert carpan[1] == pytest.approx(1.4)
    assert carpan[2] == pytest.approx(1.0)
    assert carpan[3] == pytest.approx(0.7 * 0.6)
    assert carpan[4] == pytest.approx(0.7 * 0.6)
    assert yakit_carpani(Parametreler()) == pytest.approx([1.0] * 5)  # v1: yakıt farkı yok


def test_tarim_ormandan_yavas_yanar():
    # Batı yarısı tarım, doğu yarısı orman; rüzgârsız düz arazi.
    arazi = _duz_arazi()
    arazi.yakit[:, : MERKEZ[1]] = 4
    v2 = Parametreler(
        hiz_olcegi=HIZLI.hiz_olcegi, yanma_suresi_dk=HIZLI.yanma_suresi_dk,
        p_veg=V2_YAKIT.p_veg, p_den=V2_YAKIT.p_den,
    )  # fmt: skip
    menzil = _ortalama_menzil(arazi, Ruzgar.sabit(0.0, 0.0), bitis_dk=30, parametreler=v2)
    assert menzil["D"] < 2900  # ızgara kenarına ulaşmadı
    assert menzil["D"] > 2.0 * menzil["B"]  # beklenen hız oranı 1,4 / 0,42 ≈ 3,3
    v1 = _ortalama_menzil(arazi, Ruzgar.sabit(0.0, 0.0), bitis_dk=30)
    assert v1["D"] == pytest.approx(v1["B"], rel=0.2)


def test_yanmaz_hucreler_hic_yanmaz():
    arazi = _duz_arazi()
    rng = np.random.default_rng(0)
    arazi.yanabilir[rng.random(arazi.yanabilir.shape) < 0.2] = False
    arazi.yanabilir[MERKEZ] = True
    toa = yayilim(arazi, Ruzgar.sabit(3.0, 90.0), [MERKEZ], HIZLI, 2, bitis_dk=120)
    assert np.isnan(toa[~arazi.yanabilir]).all()


def test_ayni_tohum_ayni_sonuc_farkli_tohum_farkli():
    arazi, ruzgar = _duz_arazi(), Ruzgar.sabit(5.0, 45.0)
    a = yayilim(arazi, ruzgar, [MERKEZ], HIZLI, tohum=7, bitis_dk=60)
    b = yayilim(arazi, ruzgar, [MERKEZ], HIZLI, tohum=7, bitis_dk=60)
    c = yayilim(arazi, ruzgar, [MERKEZ], HIZLI, tohum=8, bitis_dk=60)
    np.testing.assert_array_equal(a, b)
    assert not np.array_equal(a, c, equal_nan=True)


def _tek_komsu_ortalama_bekleme(komsu: tuple[int, int], tekrar: int = 3000) -> float:
    """3 x 3 alanda yalnızca merkez ve tek komşu yanabilir: komşunun ortalama TOA'sı."""
    arazi = _duz_arazi(3)
    arazi.yanabilir[:] = False
    arazi.yanabilir[1, 1] = arazi.yanabilir[komsu] = True
    p = Parametreler(yanma_suresi_dk=1e9)
    return float(
        np.mean(
            [
                yayilim(arazi, Ruzgar.sabit(0.0, 0.0), [(1, 1)], p, tohum=t, bitis_dk=1e9)[komsu]
                for t in range(tekrar)
            ]
        )
    )


def test_bekleme_ortalamasi_eksende_bir_bolu_hiz_kosegende_karekok_iki_kat():
    p = Parametreler()
    beklenen = 1.0 / (p.hiz_olcegi * p.p_h)
    assert _tek_komsu_ortalama_bekleme((1, 2)) == pytest.approx(beklenen, rel=0.06)
    assert _tek_komsu_ortalama_bekleme((2, 2)) == pytest.approx(np.sqrt(2) * beklenen, rel=0.06)


def test_yanma_suresi_bitince_tutusturamaz():
    # Çok kısa yanma süresi: yangın ilk hücrelerde söner.
    p = Parametreler(yanma_suresi_dk=0.01)
    toa = yayilim(_duz_arazi(), Ruzgar.sabit(0.0, 0.0), [MERKEZ], p, tohum=0, bitis_dk=1e9)
    assert (~np.isnan(toa)).sum() < 20


def test_ruzgar_zamanla_degisir():
    # İlk saat batıdan, sonra doğudan esen rüzgar: hava alanı saatlik güncelleniyor.
    ruzgar = Ruzgar(
        dakikalar=np.array([0.0, 60.0, 61.0, 600.0]),
        u=np.array([8, 8, -8, -8], dtype=np.float32).reshape(4, 1, 1),
        v=np.zeros((4, 1, 1), dtype=np.float32),
        hiz=np.full((4, 1, 1), 8.0, dtype=np.float32),
    )
    assert ruzgar.ornekle(0, 0, 30.0)[0] == pytest.approx(8.0)
    assert ruzgar.ornekle(0, 0, 300.0)[0] == pytest.approx(-8.0)
    toa = yayilim(_duz_arazi(), ruzgar, [MERKEZ], HIZLI, tohum=0, bitis_dk=140)
    menzil = _menziller(toa)
    assert menzil["B"] > 0.5 * menzil["D"]  # sonradan batıya dönen yangın


def test_hava_alanindan_ornekleme_tam_alanla_ayni():
    izgara = Izgara("test", "EPSG:32636", Affine(30.0, 0, 500000.0, 0, -30.0, 4000000.0), 7, 5)
    rng = np.random.default_rng(3)
    alanlar = {ad: rng.uniform(-5, 5, (3, 3, 4)).astype(np.float32) for ad in ALAN_DEGISKENLERI}
    t0 = datetime(2021, 7, 28, 9, tzinfo=UTC)
    saatler = np.array([(t0 + timedelta(hours=h)).timestamp() for h in range(3)])
    alan = HavaAlani(izgara, 2, saatler, alanlar)
    ruzgar = Ruzgar.hava_alanindan(alan, t0)
    tam = alan.alan(t0 + timedelta(minutes=75))
    for r, c in [(0, 0), (2, 3), (4, 6)]:
        u, v, hiz, _ = ruzgar.ornekle(r, c, 75.0)
        assert u == pytest.approx(tam["ruzgar_u"][r, c], abs=1e-5)
        assert v == pytest.approx(tam["ruzgar_v"][r, c], abs=1e-5)
        assert hiz == pytest.approx(tam["ruzgar_hizi_ms"][r, c], abs=1e-5)


def test_coklu_calistirma_olasilik_haritasi():
    sonuc = coklu_yayilim(
        _duz_arazi(), Ruzgar.sabit(5.0, 270.0), [MERKEZ], HIZLI, range(6), bitis_dk=40
    )
    assert sonuc.olasilik[MERKEZ] == 1.0
    assert 0.0 <= sonuc.olasilik.min() and sonuc.olasilik.max() <= 1.0
    assert ((sonuc.olasilik > 0) & (sonuc.olasilik < 1)).any()  # sınırda belirsizlik var
    assert sonuc.toa_ortanca[MERKEZ] == 0.0
    assert np.isnan(sonuc.toa_ortanca[sonuc.olasilik == 0]).all()
    # Topluluk TOA'sı: t anında en az yarısında yanan alan = toa_topluluk ≤ t alanı.
    assert sonuc.toalar.shape == (6, BOYUT, BOYUT)
    for t in (10.0, 25.0, 40.0):
        yarisinda = (np.nan_to_num(sonuc.toalar, nan=np.inf) <= t).sum(axis=0) >= 3
        assert np.array_equal(yarisinda, sonuc.toa_topluluk <= t)
    assert np.array_equal(~np.isnan(sonuc.toa_topluluk), sonuc.olasilik >= 0.5)


def test_coklu_yayilim_tohum_basina_farkli_ruzgar():
    arazi = _duz_arazi(81)
    merkez = (40, 40)
    doguya = Ruzgar.sabit(8.0, 270.0)  # batıdan esen: doğuya
    batiya = Ruzgar.sabit(8.0, 90.0)  # doğudan esen: batıya
    tohumlar = range(6)

    tek_doguya = coklu_yayilim(arazi, doguya, [merkez], HIZLI, tohumlar, bitis_dk=20)
    tek_batiya = coklu_yayilim(arazi, batiya, [merkez], HIZLI, tohumlar, bitis_dk=20)
    karisik = coklu_yayilim(arazi, [doguya, batiya], [merkez], HIZLI, tohumlar, bitis_dk=20)

    # Tohum i → ruzgarlar[i % 2]: çift tohumlar doğuya, tek tohumlar batıya.
    for i in range(6):
        beklenen = tek_doguya.toalar[i] if i % 2 == 0 else tek_batiya.toalar[i]
        np.testing.assert_array_equal(karisik.toalar[i], beklenen)


def test_coklu_yayilim_tek_ruzgar_eski_davranisla_ayni():
    arazi = _duz_arazi(61)
    merkez = (30, 30)
    ruzgar = Ruzgar.sabit(6.0, 200.0)
    tohumlar = range(4)

    coklu = coklu_yayilim(arazi, ruzgar, [merkez], HIZLI, tohumlar, bitis_dk=20)
    for i in tohumlar:
        tek = yayilim(arazi, ruzgar, [merkez], HIZLI, tohum=i, bitis_dk=20)
        np.testing.assert_array_equal(coklu.toalar[i], tek)


def test_engel_gecisi_yavaslatir_ve_tam_guc_durdurur():
    """Ortadan geçen dikey bir engel: etki 0'da yok sayılır, tam güçte ateş öbür yakaya geçemez."""
    arazi = _duz_arazi(41)
    engel = np.zeros((41, 41), dtype=np.float32)
    engel[:, 25] = 1.0
    arazi.engel = engel
    ruzgar = Ruzgar.sabit(0.0, 0.0)
    acik = yayilim(arazi, ruzgar, [(20, 20)], replace(V2_YAKIT, engel_etkisi=0.0), 0, 2000.0)
    kapali = yayilim(arazi, ruzgar, [(20, 20)], replace(V2_YAKIT, engel_etkisi=1.0), 0, 2000.0)
    assert np.isfinite(acik[:, 30]).any()
    assert np.isnan(kapali[:, 25:]).all()


def test_sondurme_esigi_ve_kacak():
    """Eşik her geçişin üstündeyse ateş tutuşma hücresinde kalır; kaçak payı varsa yayılır."""
    arazi = _duz_arazi(41)
    ruzgar = Ruzgar.sabit(0.0, 0.0)
    tam = replace(V2_YAKIT, sondurme_esigi=10.0)
    kacak = replace(tam, sondurme_olasiligi=0.5)
    tutulan = yayilim(arazi, ruzgar, [(20, 20)], tam, 0, 2000.0)
    kacan = yayilim(arazi, ruzgar, [(20, 20)], kacak, 0, 2000.0)
    assert np.count_nonzero(np.isfinite(tutulan)) == 1
    assert np.count_nonzero(np.isfinite(kacan)) > 10


def test_sondurme_doygunlugu_sifirken_rasgele_dizisi_degismez():
    """Doygunluk 0 (v1–v5): söndürme eski sırayla aynı sayıları tüketir, sonuç tohum tohum aynı."""
    assert Parametreler().sondurme_doygunluk_ha_sa == 0.0
    arazi = _duz_arazi(3)
    arazi.yanabilir[:] = False
    arazi.yanabilir[1, 1] = arazi.yanabilir[1, 2] = True
    p = Parametreler(sondurme_esigi=0.6, sondurme_baslangic_dk=0.0, sondurme_olasiligi=0.8)
    for tohum in range(200):
        # Eski çekirdek: ilk çekiliş tutma, ikincisi bekleme. p = p_h = 0,58 < eşik.
        durum = np.array([np.uint64((tohum * 0x2545F4914F6CDD1D) & (2**64 - 1))], dtype=np.uint64)
        tutuldu = _rastgele(durum) < p.sondurme_olasiligi
        bekleme = -math.log(_rastgele(durum)) / (p.hiz_olcegi * p.p_h)
        beklenen = np.nan if tutuldu or bekleme > p.yanma_suresi_dk else bekleme
        toa = yayilim(arazi, Ruzgar.sabit(0.0, 0.0), [(1, 1)], p, tohum, 1e9)
        assert toa[1, 2] == pytest.approx(beklenen, nan_ok=True)

    # Doygunluk alanı varsayılan 0 iken hiçbir şeyi değiştirmez (rastgele dizi dahil).
    arazi = _duz_arazi(41)
    arazi.yanabilir[5:20, 7:30] = False
    ruzgar = Ruzgar.sabit(4.0, 60.0)
    v5 = replace(V2_YAKIT, sondurme_esigi=0.6, sondurme_baslangic_dk=120.0,
                 sondurme_olasiligi=0.8)  # fmt: skip
    for tohum in range(3):
        a = yayilim(arazi, ruzgar, [(20, 20)], v5, tohum, 240.0)
        # Pencere değeri doygunluk kapalıyken etkisiz olmalı.
        b = yayilim(arazi, ruzgar, [(20, 20)], replace(v5, sondurme_pencere_dk=15.0), tohum, 240.0)
        np.testing.assert_array_equal(a, b)


def test_sondurme_gucu_buyume_hizina_baglanir():
    """Hızlı büyüyen yangında söndürme etkisiz (kapalıyla birebir), yavaş büyüyende etkili."""
    # Aynı yayılma, yalnızca hücre alanı farklı: 30 m hücrede saatlik büyüme doygunluğu aşar,
    # 1 m hücrede aşmaz. Eşik her geçişi kapsar (p < 10), böylece fark yalnızca tutma gücünden.
    p = replace(
        HIZLI,
        sondurme_esigi=10.0,
        sondurme_baslangic_dk=30.0,
        sondurme_olasiligi=1.0,
        sondurme_doygunluk_ha_sa=10.0,
    )
    ruzgar = Ruzgar.sabit(0.0, 0.0)
    hizli = _duz_arazi(201)
    yavas = _duz_arazi(201)
    yavas.cozunurluk = 1.0
    hizli_toa = yayilim(hizli, ruzgar, [MERKEZ], p, 0, 120.0)
    kapali = yayilim(hizli, ruzgar, [MERKEZ], replace(p, sondurme_esigi=0.0), 0, 120.0)
    yavas_toa = yayilim(yavas, ruzgar, [MERKEZ], p, 0, 120.0)
    # Büyüme doygunluğun çok üstünde: ekipler yetişemez, söndürme hiçbir geçişi tutmaz.
    np.testing.assert_array_equal(hizli_toa, kapali)
    # Aynı yangın 1 m hücrede 100× küçük alanla büyür: ekipler kenarı tutar, alan küçük kalır.
    assert np.count_nonzero(~np.isnan(yavas_toa)) < 0.25 * np.count_nonzero(~np.isnan(hizli_toa))


def test_zamanli_ek_tutusma_o_anda_baslar():
    """(satır, sütun, dakika): ikinci yangın 100. dakikada başlar; o ana kadar oraya ateş ulaşmaz."""
    arazi = _duz_arazi(81)
    ruzgar = Ruzgar.sabit(0.0, 0.0)
    ilk, ikinci = (10, 10), (70, 70)
    tek = yayilim(arazi, ruzgar, [ilk], Parametreler(), 0, 200.0)
    iki = yayilim(arazi, ruzgar, [ilk, (*ikinci, 100.0)], Parametreler(), 0, 200.0)
    assert np.isnan(tek[ikinci])  # tek yangın 200 dk'da oraya varmıyor
    assert iki[ikinci] == pytest.approx(100.0)
    r, c = ikinci
    komsular = iki[r - 3 : r + 4, c - 3 : c + 4]
    assert np.nanmin(komsular) == pytest.approx(
        100.0
    )  # ikinci yangın çevresi 100. dk'dan önce yanmaz
    assert np.count_nonzero(~np.isnan(iki)) > np.count_nonzero(~np.isnan(tek))
    # Dakika verilmezse 0 sayılır (eski çağrılar aynı sonucu verir).
    np.testing.assert_array_equal(
        tek, yayilim(arazi, ruzgar, [(*ilk, 0.0)], Parametreler(), 0, 200.0)
    )
