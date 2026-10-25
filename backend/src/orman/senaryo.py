"""Model senaryoları: bir yangın için ızgara, zaman aralığı ve tutuşma bilgisi."""

from dataclasses import dataclass
from datetime import UTC, date, datetime

from orman.izgara import MANAVGAT_2021 as MANAVGAT_2021_IZGARASI
from orman.izgara import Izgara


@dataclass(frozen=True)
class Senaryo:
    izgara: Izgara
    baslangic: date  # veri aralığının ilk günü (UTC)
    bitis: date  # veri aralığının son günü (UTC)
    tutusma_utc: datetime
    tutusma_konumu: tuple[float, float]  # (enlem, boylam), WGS84
    model_bitis_utc: datetime | None = None  # simülasyonun duracağı an (yaklaşık söndürme)

    @property
    def ad(self) -> str:
        return self.izgara.ad


# Tutuşma: FIRMS'in ilk güçlü tespiti (MODIS, 28 Tem 2021 12:00 yerel = 09:00 UTC).
# Ayrıntı: docs/06-dogrulama-yanginlari.md (yalnızca yerelde).
MANAVGAT_2021 = Senaryo(
    izgara=MANAVGAT_2021_IZGARASI,
    baslangic=date(2021, 7, 26),
    bitis=date(2021, 8, 8),
    tutusma_utc=datetime(2021, 7, 28, 9, 0, tzinfo=UTC),
    tutusma_konumu=(36.9313, 31.3838),
    # FIRMS tespitlerinin %94'ü bu andan önce; sonrası dağınık, söner hâldeki noktalar.
    model_bitis_utc=datetime(2021, 8, 4, 0, 0, tzinfo=UTC),
)
