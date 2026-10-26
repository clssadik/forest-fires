"""Doğrulama ölçütleri: sonucu elle hesaplanabilen küçük dizilerle testler."""

from datetime import UTC, datetime

import numpy as np
import pandas as pd
import pytest

from orman.dogrulama.olcutler import (
    Referans,
    buyume_egrisi,
    daire_toa,
    dogrula,
    esit_alan_esigi,
    firms_varis_zamani,
    mekansal_olcutler,
    zaman_olcutleri,
)

T0 = datetime(2021, 7, 28, 9, 0, tzinfo=UTC)


def _maske(*hucreler, sekil=(4, 4)):
    m = np.zeros(sekil, dtype=bool)
    for r, c in hucreler:
        m[r, c] = True
    return m


def test_mekansal_olcutler_elle_hesaplanan_ornek():
    # 4x4 = 16 hücre. Gerçek: 4 hücre; tahmin: 6 hücre, 3'ü gerçekle ortak.
    gercek = _maske((0, 0), (0, 1), (1, 0), (1, 1))
    tahmin = _maske((0, 0), (0, 1), (1, 0), (2, 0), (2, 1), (2, 2))
    o = mekansal_olcutler(tahmin, gercek, np.ones((4, 4), bool), hucre_ha=1.0)
    assert (o.dogru_ha, o.yanlis_alarm_ha, o.kacirilan_ha) == (3, 3, 1)
    assert (o.model_ha, o.gercek_ha) == (6, 4)
    assert o.iou == pytest.approx(3 / 7)
    assert o.dice == pytest.approx(2 * 3 / (6 + 4))
    assert o.isabet == pytest.approx(3 / 6)  # modelin yaktığının ne kadarı doğru
    assert o.duyarlilik == pytest.approx(3 / 4)  # gerçeğin ne kadarı yakalandı
    # Kappa: po = (3 + 9) / 16; pe = (6·4 + 10·12) / 16²
    po, pe = 12 / 16, (6 * 4 + 10 * 12) / 256
    assert o.kappa == pytest.approx((po - pe) / (1 - pe))


def test_mekansal_olcutler_kusursuz_ve_kapsam_disi():
    gercek = _maske((1, 1), (1, 2))
    kapsam = np.ones((4, 4), bool)
    kapsam[3] = False  # son satır değerlendirme dışı
    tahmin = gercek | _maske((3, 0), (3, 3))  # kapsam dışındaki fazlalık sayılmaz
    o = mekansal_olcutler(tahmin, gercek, kapsam, hucre_ha=0.09)
    assert o.iou == o.dice == o.kappa == pytest.approx(1.0)
    assert o.yanlis_alarm_ha == 0
    assert o.model_ha == pytest.approx(0.18)


def test_mekansal_olcutler_bos_tahmin():
    o = mekansal_olcutler(np.zeros((4, 4), bool), _maske((0, 0)), np.ones((4, 4), bool), 1.0)
    assert o.iou == o.dice == o.isabet == o.duyarlilik == 0.0
    assert o.kappa == pytest.approx(0.0)


def test_esit_alan_esigi_hedef_alani_veren_en_erken_an():
    toa = np.array([[0, 10, 20], [30, np.nan, 50], [60, 70, np.nan]], dtype=np.float32)
    kapsam = np.ones((3, 3), bool)
    assert esit_alan_esigi(toa, kapsam, hedef_hucre=3) == 20
    assert np.count_nonzero(toa <= esit_alan_esigi(toa, kapsam, 5)) == 5
    kapsam[0, 1] = False  # kapsam dışı hücre sayılmaz
    assert esit_alan_esigi(toa, kapsam, hedef_hucre=3) == 30
    # Model hedefe hiç ulaşamazsa: yaktığı her şey (en geç an).
    assert esit_alan_esigi(toa, kapsam, hedef_hucre=50) == 70


def _tespitler(*satirlar):
    return pd.DataFrame(satirlar, columns=["zaman_utc", "satir", "sutun", "scan", "track"])


def test_firms_varis_zamani_ayak_izi_ve_en_erken_tespit():
    # 30 m hücre; scan 0,09 km -> 3 sütun (yarı genişlik 1), track 0,03 km -> 1 satır.
    tablo = _tespitler(
        (pd.Timestamp("2021-07-28 10:00", tz="UTC"), 2, 2, 0.09, 0.03),
        (pd.Timestamp("2021-07-28 12:00", tz="UTC"), 2, 3, 0.09, 0.03),
        (pd.Timestamp("2021-07-28 08:00", tz="UTC"), 0, 0, 0.09, 0.03),  # tutuşmadan önce
    )
    varis = firms_varis_zamani(tablo, (5, 6), T0, cozunurluk=30.0)
    assert varis[2, 1] == varis[2, 2] == 60  # ilk tespitin ayak izi
    assert varis[2, 3] == 60  # iki tespit üst üste: en erkeni
    assert varis[2, 4] == 180  # yalnızca ikinci tespit
    assert np.isnan(varis[1, 2]) and np.isnan(varis[0, 0])
    assert np.count_nonzero(~np.isnan(varis)) == 4


def test_zaman_olcutleri_fark_dagilimi():
    firms = np.full((2, 3), np.nan, np.float32)
    firms[0] = [60, 120, 180]
    firms[1, 0] = 240
    model = np.array([[0, 240, 120], [np.nan, 10, 20]], dtype=np.float32)
    z = zaman_olcutleri(model, firms)
    # Farklar (saat, model − uydu): −1, +2, −1; bir hücreyi model hiç yakmadı.
    assert z.hucre_sayisi == 4
    assert z.yanmayan_oran == pytest.approx(0.25)
    assert z.ortanca_saat == pytest.approx(-1.0)
    assert z.mutlak_ortanca_saat == pytest.approx(1.0)
    assert z.oran_12_saat_icinde == pytest.approx(1.0)


def test_buyume_egrisi_ve_daire():
    toa = np.array([[0, 60], [120, np.nan]], dtype=np.float32)
    assert buyume_egrisi(toa, np.ones((2, 2), bool), [0, 1, 2, 3], hucre_ha=2.0) == [2, 4, 6, 6]

    yanabilir = np.ones((5, 5), bool)
    yanabilir[0, 0] = False
    d = daire_toa((2, 2), yanabilir, cozunurluk=30.0)
    assert d[2, 2] == 0 and d[2, 4] == 60 and d[4, 4] == pytest.approx(60 * np.sqrt(2))
    assert np.isnan(d[0, 0])


def test_dogrula_mukemmel_tahmin_ve_esit_alan():
    gercek = _maske((1, 1), (1, 2), (2, 1), (2, 2), sekil=(5, 5))
    firms = np.where(gercek, 60.0, np.nan).astype(np.float32)
    ref = Referans(gercek=gercek, kapsam=np.ones((5, 5), bool), firms_toa=firms,
                   hucre_ha=1.0, bitis_dk=600.0)  # fmt: skip
    toa = np.where(gercek, 60.0, 300.0).astype(np.float32)  # gerçek alan önce, sonra fazlası
    o = dogrula(toa, ref)
    assert o.esit_alan.iou == pytest.approx(1.0)
    assert o.esit_alan_saat == pytest.approx(1.0)
    assert o.bitis.iou == pytest.approx(4 / 25)  # bitişte her yer yanmış
    assert o.zaman.ortanca_saat == pytest.approx(0.0)
    assert o.yari_alan_saat == pytest.approx(1.0)

    zamansiz = dogrula(toa, ref, zamanli=False)
    assert zamansiz.bitis is None and zamansiz.zaman is None and zamansiz.esit_alan_saat is None
    assert zamansiz.esit_alan_esik == 60.0
    assert zamansiz.esit_alan.iou == pytest.approx(1.0)
