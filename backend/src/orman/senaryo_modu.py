"""Senaryo modu: "şimdi burada yangın çıksa ne olur?"

Haritadan seçilen bir nokta için bölge paketi istek üzerine üretilir: noktanın çevresinde
`YARICAP_KM` yarıçaplı kare ızgara (noktanın UTM diliminde, 30 m), Copernicus DEM, WorldCover
ve Open-Meteo **tahmini** (önümüzdeki saatler). FIRMS ve Sentinel-2 gerekmez. Model v3
`CALISMA` tohumla `SURE_SA` saat çalışır.

Sonuç tek bir çizgi değil, olasılıktır: her hücre için çalıştırmaların %10, %50 ve %90'ında
yandığı en erken an (`ESIKLER`). Bir t anında "olasılık ≥ q" alanı, q eşiğinin TOA'sı ≤ t
olan hücrelerdir. Doğrulamada (docs/dogrulama.md) model alanı ve yakıtı iyi, yönü kısmen,
durmayı (söndürme) hiç bilmiyor; arayüz bunu açıkça yazar.

Çıktılar `data/islenmis/senaryolar/<kimlik>/`: paket katmanları, esik_toa.tif (3 bant, dk)
ve sonuc.json.
"""

import json
import math
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import rasterio

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import DENEYLER, GUNCEL_MODEL
from orman.izgara import Izgara
from orman.model.calistir import tutusma_hucresi
from orman.model.yayilim import Arazi, Ruzgar, coklu_yayilim
from orman.senaryo import Senaryo
from orman.veri.bolge_paketi import BolgePaketi, model_girdilerini_olustur, model_girdilerini_yukle

YARICAP_KM = 20.0  # ızgara: nokta merkezli 40 × 40 km
COZUNURLUK_M = 30.0
SURE_SA = 48  # model durmayı bilmediği için daha uzun süre anlamlı değil
CALISMA = 20
ESIKLER = (0.1, 0.5, 0.9)  # olasılık bantları: düşük, orta, yüksek
KIMLIK_HASSASIYETI = 2  # ondalık basamak (~1 km); yakın tıklamalar aynı paketi kullanır
KENAR_PAYI_HUCRE = 33  # ~1 km; olası alan bu kadar kenara yaklaşırsa "sınıra ulaştı"
MODEL_ADI = GUNCEL_MODEL
PARAMETRELER = DENEYLER[GUNCEL_MODEL][1]


def utm_crs(enlem: float, boylam: float) -> str:
    """Noktanın UTM dilimi (kuzey yarımküre 326xx, güney 327xx)."""
    dilim = math.floor((boylam + 180.0) / 6.0) % 60 + 1
    return f"EPSG:{(32600 if enlem >= 0 else 32700) + dilim}"


def kimlik(enlem: float, boylam: float) -> str:
    return f"{enlem:.{KIMLIK_HASSASIYETI}f}_{boylam:.{KIMLIK_HASSASIYETI}f}"


def senaryo_dizini(k: str) -> Path:
    return ISLENMIS_VERI_DIZINI / "senaryolar" / k


def noktadan_senaryo(
    enlem: float, boylam: float, tutusma_utc: datetime, yaricap_km: float = YARICAP_KM
) -> Senaryo:
    """Tutuşma noktası merkezli kare ızgara ve modelin çalışacağı zaman aralığı.

    Izgara kimliğe yuvarlanmış noktaya göre kurulur (arazi önbelleği yakın tıklamalarda
    yeniden kullanılsın); tutuşma tam tıklanan yerdedir.
    """
    k = kimlik(enlem, boylam)
    merkez_enlem, merkez_boylam = (float(v) for v in k.split("_"))
    d_enlem = yaricap_km / 111.32
    d_boylam = yaricap_km / (111.32 * math.cos(math.radians(merkez_enlem)))
    izgara = Izgara.bboxtan(
        f"senaryolar/{k}",
        (
            merkez_boylam - d_boylam,
            merkez_enlem - d_enlem,
            merkez_boylam + d_boylam,
            merkez_enlem + d_enlem,
        ),
        crs=utm_crs(merkez_enlem, merkez_boylam),
        cozunurluk=COZUNURLUK_M,
    )
    bitis = tutusma_utc + timedelta(hours=SURE_SA)
    return Senaryo(
        izgara=izgara,
        baslangic=(tutusma_utc - timedelta(days=1)).date(),
        bitis=(bitis + timedelta(hours=1)).date(),
        tutusma_utc=tutusma_utc,
        tutusma_konumu=(enlem, boylam),
        model_bitis_utc=bitis,
        baslik="Senaryo",
        konum=f"{enlem:.4f} K, {boylam:.4f} D",
    )


def esik_toalari(toalar: np.ndarray, esikler=ESIKLER) -> np.ndarray:
    """Her eşik q için hücrenin çalıştırmaların en az q'sünde yanmış olduğu en erken an.

    `toalar`: (çalıştırma, satır, sütun), NaN = yanmadı. Döner: (eşik, satır, sütun) float32;
    yeterince çalıştırmada yanmayan hücre NaN. q · n tam sayı değilse yukarı yuvarlanır
    (20 çalıştırmada %10 = 2, %50 = 10, %90 = 18 çalıştırma).
    """
    n = toalar.shape[0]
    sonuc = np.full((len(esikler), *toalar.shape[1:]), np.nan, dtype=np.float32)
    yandi = (~np.isnan(toalar)).any(axis=0)
    sirali = np.sort(toalar[:, yandi], axis=0)  # NaN'lar sona dizilir
    for i, q in enumerate(esikler):
        gereken = max(1, math.ceil(q * n - 1e-9))
        sonuc[i, yandi] = sirali[gereken - 1]
    return sonuc


def buyume(esik_toa: np.ndarray, saatler: list[int], hucre_ha: float) -> list[list[float]]:
    """Her eşik için saat saat alan (ha): [eşik][saat]."""
    return [
        [round(float(np.count_nonzero(bant <= s * 60.0)) * hucre_ha, 1) for s in saatler]
        for bant in esik_toa
    ]


def kenara_ulasma_saati(toa: np.ndarray, pay: int = KENAR_PAYI_HUCRE) -> float | None:
    """Yanan alanın ızgara kenarına `pay` hücreden fazla yaklaştığı ilk an (sa); yoksa None."""
    kenar = np.ones(toa.shape, dtype=bool)
    kenar[pay:-pay, pay:-pay] = False
    degerler = toa[kenar]
    degerler = degerler[~np.isnan(degerler)]
    return round(float(degerler.min()) / 60.0, 1) if degerler.size else None


def hava_ozeti(paket: BolgePaketi, hucre: tuple[int, int], saatler: list[int]) -> dict:
    """Tutuşma hücresinde saat saat rüzgâr (hız, geldiği yön), sıcaklık, bağıl nem."""
    alan = paket.hava_alani()
    r, c = hucre[0] // alan.carpan, hucre[1] // alan.carpan
    t0 = paket.senaryo.tutusma_utc.timestamp()
    zaman = (alan.saatler - t0) / 3600.0
    oku = lambda ad: np.interp(saatler, zaman, alan.alanlar[ad][:, r, c])
    u, v = oku("ruzgar_u"), oku("ruzgar_v")
    yon = (np.degrees(np.arctan2(-u, -v)) + 360.0) % 360.0  # geldiği yön (bkz. hava.ruzgar_uv)
    return {
        "saatler": saatler,
        "ruzgar_hizi_ms": np.round(oku("ruzgar_hizi_ms"), 1).tolist(),
        "ruzgar_yonu": np.round(yon).tolist(),
        "sicaklik_c": np.round(oku("sicaklik_c"), 1).tolist(),
        "bagil_nem": np.round(oku("bagil_nem")).tolist(),
    }


@dataclass
class SenaryoSonucu:
    senaryo: Senaryo
    esik_toa: np.ndarray  # (eşik, satır, sütun), dk, NaN = o olasılıkla yanmadı
    ozet: dict


def simdiki_saat() -> datetime:
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0)


def calistir(
    enlem: float, boylam: float, tutusma_utc: datetime | None = None, calisma: int = CALISMA
) -> SenaryoSonucu:
    """Paketi hazırlar (önbellekli arazi + güncel tahmin), modeli çalıştırır, sonucu yazar.

    Tutuşma noktası yanmaz bir hücredeyse (deniz, şehir, kaya) ve çevresinde yanabilir
    bitki yoksa `ValueError` yükselir.
    """
    tutusma_utc = tutusma_utc or simdiki_saat()
    senaryo = noktadan_senaryo(enlem, boylam, tutusma_utc)
    sureler = {}

    bas = time.perf_counter()
    model_girdilerini_olustur(senaryo, canli=True)
    paket = model_girdilerini_yukle(senaryo)
    sureler["veri_sn"] = round(time.perf_counter() - bas, 1)

    hucre = tutusma_hucresi(paket)
    bas = time.perf_counter()
    sonuc = coklu_yayilim(
        Arazi.paketten(paket),
        Ruzgar.hava_alanindan(paket.hava_alani(), tutusma_utc),
        [hucre],
        PARAMETRELER,
        range(calisma),
        SURE_SA * 60.0,
    )
    esik_toa = esik_toalari(sonuc.toalar)
    sureler["model_sn"] = round(time.perf_counter() - bas, 1)

    izgara = senaryo.izgara
    hucre_ha = izgara.cozunurluk**2 / 10_000
    saatler = list(range(SURE_SA + 1))
    yakit = paket.yakit[paket.gecerli]
    ozet = {
        "kimlik": kimlik(enlem, boylam),
        "model": MODEL_ADI,
        "calisma_sayisi": calisma,
        "tutusma_utc": tutusma_utc.isoformat(),
        "bitis_utc": senaryo.model_bitis_utc.isoformat(),
        "tutusma_konumu": {"enlem": enlem, "boylam": boylam},
        "olusturma_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "sureler": sureler,
        "esikler": list(ESIKLER),
        "saatler": saatler,
        "buyume_ha": buyume(esik_toa, saatler, hucre_ha),
        "kenar_saat": kenara_ulasma_saati(esik_toa[0]),
        "hava": hava_ozeti(paket, hucre, saatler),
        "tutusma_yakiti": int(paket.yakit[hucre]),
        "yakit_payi": {
            str(k): round(float(np.mean(yakit == k)), 3) for k in range(5)
        },  # ızgaradaki pay
    }
    d = senaryo_dizini(ozet["kimlik"])
    profil = izgara.rasterio_profili("float32", np.nan) | {"count": len(ESIKLER)}
    with rasterio.open(d / "esik_toa.tif", "w", **profil) as ds:
        ds.write(esik_toa)
    (d / "sonuc.json").write_text(json.dumps(ozet, ensure_ascii=False, indent=2))
    return SenaryoSonucu(senaryo, esik_toa, ozet)
