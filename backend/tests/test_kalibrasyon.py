"""Kalibrasyon: hedef fonksiyonu ve parametre örneklemesi (elle hesaplanmış küçük örnekler)."""

from dataclasses import asdict

import numpy as np
import pytest

from orman.dogrulama.kalibrasyon import (
    ARALIKLAR,
    gecis_anlari,
    hedef,
    rastgele_parametreler,
    zamanli_iou,
)
from orman.dogrulama.olcutler import Referans
from orman.model.yayilim import V2_YAKIT

NAN = np.nan


def _referans(firms_toa: np.ndarray, gercek: np.ndarray | None = None) -> Referans:
    if gercek is None:
        gercek = ~np.isnan(firms_toa)
    return Referans(
        gercek=gercek,
        kapsam=np.ones(firms_toa.shape, dtype=bool),
        firms_toa=firms_toa.astype(np.float32),
        hucre_ha=0.09,
        bitis_dk=1e6,
    )


def test_gecis_anlari_gruplar_ve_suzer():
    # 3 sa'ten kısa aralıklı tespitler aynı geçiş; her geçişin son anı alınır. 72 sa'ten sonrası
    # ve gerçek alanın %5'ine ulaşmamış ilk geçiş atlanır.
    # 8 hücre: ilk geçiş 2 hücre (%25), ikinci 4 hücre, üçüncü 1, sonuncusu 72 sa'ten sonra.
    firms = np.array([[60, 70, 600, 610], [620, 630, 900, 6000]], dtype=float)
    kapsam = np.ones((2, 4), dtype=bool)
    assert list(gecis_anlari(firms, kapsam, en_az_oran=0.05)) == [70.0, 630.0, 900.0]
    # %30 eşiğiyle ilk geçiş (2/8 = %25) atlanır.
    anlar = gecis_anlari(firms, kapsam, en_az_oran=0.3)
    assert list(anlar) == [630.0, 900.0]


def test_zamanli_iou_elle():
    firms = np.array([[10.0, 10.0, 100.0, NAN]])
    referans = _referans(firms, gercek=np.array([[True, True, True, True]]))
    assert zamanli_iou(firms.copy(), referans, [10.0, 100.0]) == pytest.approx(1.0)
    # Model: ilk iki hücreye 50 dk'da, üçüncüye hiç, dördüncüye 5 dk'da. Dördüncü hücre gerçekte
    # yandı ama FIRMS onu görmedi; zamanlı ölçüt yalnızca FIRMS'in gördüğünü bilir.
    # t=10: model {3}, FIRMS {0,1} → 0. t=100: model {0,1,3}, FIRMS {0,1,2} → 2/4. Ortalama 0,25.
    model = np.array([[50.0, 50.0, NAN, 5.0]])
    assert zamanli_iou(model, referans, [10.0, 100.0]) == pytest.approx(0.25)


def test_hedef_sekil_ve_zaman_ortalamasi():
    assert hedef(0.4, 0.6) == pytest.approx(0.5)
    assert hedef(1.0, 0.0) == pytest.approx(0.5)


def test_rastgele_parametreler_araliklarda_ve_tekrarlanabilir():
    a = rastgele_parametreler(np.random.default_rng(7), V2_YAKIT)
    assert a == rastgele_parametreler(np.random.default_rng(7), V2_YAKIT)
    rng = np.random.default_rng(0)
    for _ in range(200):
        p = rastgele_parametreler(rng, V2_YAKIT)
        for ad, (alt, ust, _) in ARALIKLAR.items():
            assert alt <= getattr(p, ad) <= ust, ad
        # Aranmayan parametreler tabandan gelir (yakıt tablosu, yanma süresi).
        assert p.p_veg == V2_YAKIT.p_veg and p.yanma_suresi_dk == V2_YAKIT.yanma_suresi_dk
    assert set(ARALIKLAR) <= set(asdict(V2_YAKIT))
