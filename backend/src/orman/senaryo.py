"""Model senaryoları: bir yangın için ızgara, zaman aralığı ve tutuşma bilgisi."""

from dataclasses import dataclass
from datetime import UTC, date, datetime

from orman.izgara import MANAVGAT_2021 as MANAVGAT_2021_IZGARASI
from orman.izgara import MARMARIS_2022 as MARMARIS_2022_IZGARASI
from orman.izgara import Izgara


@dataclass(frozen=True)
class Senaryo:
    izgara: Izgara
    baslangic: date  # veri aralığının ilk günü (UTC)
    bitis: date  # veri aralığının son günü (UTC)
    tutusma_utc: datetime
    tutusma_konumu: tuple[float, float]  # (enlem, boylam), WGS84
    model_bitis_utc: datetime | None = None  # simülasyonun duracağı an (yaklaşık söndürme)
    baslik: str = ""  # arayüzde görünen ad
    konum: str = ""  # arayüzde görünen yer adı

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
    baslik="Manavgat 2021",
    konum="Manavgat, Antalya",
)

# Genelleme testi: kalibrasyonda hiç kullanılmaz. Tutuşma zamanı haberlerden (21 Haz 2022 20:02
# yerel = 17:02 UTC; FIRMS'in ilk geçişi 3,7 sa sonra, 20:45 UTC). Konum: o ilk geçişin
# (MODIS) en güçlü tespiti; yer adı Hisarönü, Bördübet mevkii. Ayrıntı: docs/06 (yalnızca yerelde).
MARMARIS_2022 = Senaryo(
    izgara=MARMARIS_2022_IZGARASI,
    baslangic=date(2022, 6, 19),
    bitis=date(2022, 6, 28),
    tutusma_utc=datetime(2022, 6, 21, 17, 2, tzinfo=UTC),
    tutusma_konumu=(36.8529, 28.0941),
    # Son FIRMS tespiti 24 Haz 00:25 UTC; yangın 24–25 Haz'da kontrol altına alındı.
    model_bitis_utc=datetime(2022, 6, 24, 6, 0, tzinfo=UTC),
    baslik="Marmaris 2022",
    konum="Marmaris, Muğla",
)
