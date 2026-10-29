import numpy as np
import pytest
from fastapi.testclient import TestClient

from orman import api, olay
from orman.ayarlar import ISLENMIS_VERI_DIZINI

AD = "manavgat_2021"
paket_gerekli = pytest.mark.skipif(
    not (ISLENMIS_VERI_DIZINI / AD / "yanmis_alan.tif").exists(),
    reason="Bölge paketi yok (uv run orman-veri manavgat_2021)",
)


def test_kaba_carpan_en_uzun_kenari_sinirlar():
    assert olay.kaba_carpan((1583, 1808)) == 5
    assert olay.kaba_carpan((300, 200)) == 1


def test_kaba_ortalama_nan_atlar_ve_artani_kirpar():
    a = np.array([[1, 3, 9], [np.nan, 5, 9], [9, 9, 9]], dtype=np.float32)
    sonuc = olay.kaba_ortalama(a, 2)
    assert sonuc.shape == (1, 1)
    assert sonuc[0, 0] == pytest.approx(3.0)
    assert np.isnan(olay.kaba_ortalama(np.full((2, 2), np.nan), 2)[0, 0])


def test_kaba_zaman_blogun_yarisi_yaninca():
    # 4 hücreden ikisi yanık: ortanca (20 + inf) / 2 = inf → yarısı yanmamış sayılmaz.
    iki = np.array([[10, 20], [np.nan, np.nan]], dtype=np.float32)
    assert np.isnan(olay.kaba_zaman(iki, 2)[0, 0])
    uc = np.array([[10, 20], [30, np.nan]], dtype=np.float32)
    assert olay.kaba_zaman(uc, 2)[0, 0] == pytest.approx(25.0)


def test_kaba_mod_ve_ortu_sinifi():
    worldcover = np.array([[10, 10], [80, 40]], dtype=np.uint8)
    ortu = olay.ortu_sinifi(worldcover)
    assert ortu.tolist() == [[1, 1], [5, 4]]
    assert olay.kaba_mod(ortu, 2, len(olay.ORTU_SINIFLARI))[0, 0] == 1


def test_cephe_mesafesi_birikimli_en_uzak():
    toa = np.full((5, 5), np.nan, dtype=np.float32)
    toa[2, 2] = 0
    toa[2, 4] = 50  # 2 hücre doğuda, ilk saatte
    toa[0, 2] = 150  # 2 hücre kuzeyde, üçüncü saatte; en uzak değişmez
    toa[4, 0] = 170  # köşegende, daha uzak
    mesafe = olay.cephe_mesafesi(toa, (2, 2), 30.0, [0, 1, 2, 3])
    assert mesafe == pytest.approx([0, 60, 60, 30 * np.hypot(2, 2)])


def test_hiz_serisi_metre_dakika():
    hiz = olay.hiz_serisi([0, 600, 1200, 1800], yumusatma=1)
    assert hiz == pytest.approx([0, 10, 10, 10])


def test_hizli_buyume_tepeleri_ayri_ve_esik_ustu():
    alan = np.cumsum([0, 10, 10, 200, 10, 10, 10, 10, 10, 10, 10, 150, 10, 10]).tolist()
    tepeler = olay.hizli_buyume_saatleri(alan, adet=3, aralik=6)
    assert [s for s, _ in tepeler] == [2, 10]  # saat 2 → 3 ve 10 → 11
    assert all(v > 0 for _, v in tepeler)


def test_bilesenler_sekiz_komsulu():
    maske = np.zeros((4, 4), dtype=bool)
    maske[0, 0] = maske[1, 1] = True  # köşegen: aynı bileşen
    maske[3, 3] = True
    boyutlar = sorted(len(b) for b in olay.bilesenler(maske))
    assert boyutlar == [1, 2]


def test_kutu_ortalamasi_kenarda_icerideki_hucreler():
    a = np.arange(9, dtype=np.float32).reshape(3, 3)
    sonuc = olay.kutu_ortalamasi(a, 1)
    assert sonuc[1, 1] == pytest.approx(4.0)
    assert sonuc[0, 0] == pytest.approx((0 + 1 + 3 + 4) / 4)


def test_sirt_varisi_tepeye_ilk_ulasma():
    # 100 m hücreler; ortada 300 m'lik tepe, yangın batıdan doğuya 1 hücre/10 dk ilerliyor.
    n = 41
    satir, sutun = np.mgrid[0:n, 0:n]
    yukseklik = 300 * np.exp(-((satir - 20) ** 2 + (sutun - 20) ** 2) / 20).astype(np.float32)
    toa = (sutun * 10.0).astype(np.float32)
    varislar = olay.sirt_varislari(yukseklik, toa, 100.0)
    assert len(varislar) == 1
    dakika, (_, c), tepe = varislar[0]
    assert c < 20  # tepenin batı yamacından girer
    assert dakika == pytest.approx(c * 10.0)
    assert tepe == pytest.approx(300, abs=1)


def test_sentinel_ozeti_katkisi_olan_sahneler():
    meta = {
        "sahneler": {
            "once": [
                {"tarih": "2021-07-20", "bulut_yuzdesi_karo": 0.5, "katkı_hucre": 900},
                {"tarih": "2021-07-15", "bulut_yuzdesi_karo": 4.0, "katkı_hucre": 10},
                {"tarih": "2021-07-10", "bulut_yuzdesi_karo": 60.0, "katkı_hucre": 0},
            ],
            "sonra": [{"tarih": "2021-08-14", "bulut_yuzdesi_karo": 8.44, "katkı_hucre": 5}],
        },
        "esik": 0.1,
        "yanmis_alan_ha": 53384.8,
        "siddet_alanlari_ha": {"dusuk": 10.4, "yuksek": 20.6},
    }
    ozet = olay.sentinel_ozeti(meta)
    assert ozet["once"] == {
        "tarihler": ["2021-07-15", "2021-07-20"],
        "ana_tarih": "2021-07-20",
        "en_cok_bulut": 4.0,
    }
    assert ozet["sonra"]["en_cok_bulut"] == 8.4
    assert ozet["yanmis_ha"] == 53385
    assert ozet["siddet_ha"] == {"dusuk": 10, "yuksek": 21}


def test_firms_ozeti_kaynak_sayilari():
    import pandas as pd

    tespitler = pd.DataFrame({"kaynak": ["MODIS_SP", "VIIRS_SNPP_SP", "VIIRS_SNPP_SP"]})
    firms_toa = np.array([[10, np.nan], [np.nan, 30]], dtype=np.float32)
    ozet = olay.firms_ozeti(tespitler, firms_toa, 0.09)
    assert ozet["toplam"] == 3
    assert ozet["kaynaklar"] == {"VIIRS_SNPP_SP": 2, "MODIS_SP": 1}
    assert ozet["gordugu_ha"] == 0


@paket_gerekli
def test_olay_uc_noktalari():
    client = TestClient(api.app)
    bilgi = client.get(f"/api/yanginlar/{AD}/olay").json()
    izgara = bilgi["izgara"]
    hucre = izgara["satir"] * izgara["sutun"]
    assert izgara["hucre_m"] == 150
    seriler = bilgi["seriler"]
    assert len(seriler["model_ha"]) == len(seriler["saatler"]) == len(seriler["ruzgar_kmsa"])
    assert np.all(np.diff(seriler["model_ha"]) >= 0)
    turler = [o["tur"] for o in bilgi["olaylar"]]
    assert turler[0] == "tutusma"
    assert "uyduGecisi" in turler
    assert len(bilgi["eksen"]["yukseklik_m"]) == olay.PROFIL_NOKTASI + 1
    boyut = {"yukseklik": 4, "model_toa": 2, "firms_toa": 2}
    for bant in api.OLAY_BANTLARI:
        yanit = client.get(f"/api/yanginlar/{AD}/olay/{bant}")
        assert len(yanit.content) == hucre * boyut.get(bant, 1)
    assert client.get(f"/api/yanginlar/{AD}/olay/yok").status_code == 404
    model = bilgi["model"]
    ea = model["esit_alan"]
    # Alan eşitlenince yanlış alarm ile kaçırılan aynı büyüklükte olur; model gerçek alana
    # ulaşmadan durduysa (v4) yanlış alarm daha küçüktür.
    assert ea["yanlis_alarm_ha"] <= ea["kacirilan_ha"] * 1.01
    assert ea["dogru_ha"] + ea["kacirilan_ha"] == pytest.approx(bilgi["gercek_ha"], rel=0.01)
    assert model["esit_alan_esik_dk"] > 0
    assert any(d["ad"] == "daire" for d in model["deneyler"])
    kanit = bilgi["kanitlar"]
    assert kanit["firms"]["toplam"] == sum(kanit["firms"]["kaynaklar"].values())
    assert kanit["sentinel2"]["yanmis_ha"] == pytest.approx(bilgi["gercek_ha"], rel=0.01)
