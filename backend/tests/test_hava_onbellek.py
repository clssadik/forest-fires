import json
from datetime import date

from orman.veri.hava import _kapsiyor


def _yanit(ilk: str, son: str) -> str:
    return json.dumps([{"hourly": {"time": [ilk, son]}}])


def test_onbellek_yalnizca_ayni_gun_araliginda_kullanilir():
    metin = _yanit("2021-07-26T00:00", "2021-08-08T23:00")
    assert _kapsiyor(metin, date(2021, 7, 26), date(2021, 8, 8))
    # Marmaris 2022 hatası: başka bir senaryonun tarihleri önbellekten okunmamalı.
    assert not _kapsiyor(metin, date(2022, 6, 19), date(2022, 6, 28))
