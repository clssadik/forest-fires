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
    # Sonradan başlayan ayrı yangınlar: (UTC an, enlem, boylam). Kayıtlı kundaklamalar ve yayılmayla
    # açıklanamayacak kadar uzakta beliren uydu tespitleri; model bunları o anda tutuşturur.
    ek_tutusmalar: tuple[tuple[datetime, float, float], ...] = ()
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
    # Manavgat yangını tek yangın değil, ayrı kundaklamalardan oluşan bir küme (Nature npj Natural
    # Hazards 2025, "Up in flames": 28 Tem'de 4 kundaklama ve 7 ayrı noktada alev, 29 Tem'de barajın
    # yakınında yeni bir kundaklama). İlk dördü: ana tespitten 70 dk sonraki VIIRS geçişinde, önceki
    # her tespitten 2 km + 2 km/sa × geçen süreden uzakta beliren noktalar (yayılmayla varılamaz);
    # her odağın en güçlü tespiti. Sonuncusu: 29 Tem kundaklaması; Saraçlı köyünün 5 km içindeki ilk
    # geçişin en güçlü tespiti (02:22 yerel). Zaman tespit anıdır (gerçek tutuşma biraz önce).
    ek_tutusmalar=(
        (datetime(2021, 7, 28, 10, 11, tzinfo=UTC), 36.83870, 31.65840),
        (datetime(2021, 7, 28, 10, 11, tzinfo=UTC), 36.79631, 31.42257),
        (datetime(2021, 7, 28, 10, 12, tzinfo=UTC), 36.86535, 31.31508),
        (datetime(2021, 7, 28, 10, 12, tzinfo=UTC), 36.87107, 31.35931),
        (datetime(2021, 7, 28, 23, 22, tzinfo=UTC), 36.88373, 31.56738),
    ),
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
