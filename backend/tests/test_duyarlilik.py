"""Duyarlılık analizi: oynatma listesi (model çalıştırmadan)."""

from dataclasses import replace

import pytest

from orman.dogrulama.duyarlilik import oynatmalar
from orman.dogrulama.kalibrasyon import ARALIKLAR
from orman.model.yayilim import V2_YAKIT


def test_oynatmalar_her_parametreyi_tek_tek_oynatir():
    taban = replace(V2_YAKIT, a=0.0, c1=0.1, sonme_nemi=0.2)
    liste = oynatmalar(taban, 0.2)
    # Sıfır olmayan her parametre iki kez (−, +), sıfır olan (a) bir kez (+).
    assert [(p, y) for p, y, _ in liste if p == "c1"] == [("c1", "-"), ("c1", "+")]
    assert [(p, y) for p, y, _ in liste if p == "a"] == [("a", "+")]
    assert len(liste) == 2 * len(ARALIKLAR) - 1
    eksi, arti = (p for ad, _, p in liste if ad == "c1")
    assert eksi.c1 == pytest.approx(0.08) and arti.c1 == pytest.approx(0.12)
    alt, ust, _ = ARALIKLAR["a"]
    assert next(p for ad, _, p in liste if ad == "a").a == pytest.approx(0.2 * (ust - alt))
    # Yalnızca oynatılan parametre değişir.
    for ad, _, p in liste:
        farkli = {k for k in taban.__dict__ if getattr(p, k) != getattr(taban, k)}
        assert farkli == {ad}
