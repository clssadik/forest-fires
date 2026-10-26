"""Saatlik hava verisi (Open-Meteo Historical Weather API, ERA5 tabanlı, anahtarsız).

Izgara alanını kapsayan düzgün bir nokta kafesi (boylam x enlem) örneklenir; tüm noktalar
tek istekte sorgulanır. Open-Meteo değerleri ERA5 model hücresinden (~25 km) verir; her
satırın `enlem`, `boylam` ve `rakim` değerleri, değerin geldiği model hücresine aittir
(istenen kafes noktasına değil). Ham yanıt `data/ham/` altında saklanır.

Birimler: sıcaklık °C, bağıl nem %, rüzgar hızı ve esintisi m/s, yağış mm.
Rüzgar yönü meteorolojik kuraldır: rüzgarın GELDİĞİ yön (kuzeyden esen rüzgar 0°).
"""

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from numpy.typing import ArrayLike

from orman.ayarlar import HAM_VERI_DIZINI, ISLENMIS_VERI_DIZINI
from orman.izgara import BBox, Izgara

ARSIV_API = "https://archive-api.open-meteo.com/v1/archive"
TAHMIN_API = "https://api.open-meteo.com/v1/forecast"
DEGISKENLER = {
    "temperature_2m": "sicaklik_c",
    "relative_humidity_2m": "bagil_nem",
    "wind_speed_10m": "ruzgar_hizi_ms",
    "wind_direction_10m": "ruzgar_yonu",
    "wind_gusts_10m": "ruzgar_esinti_ms",
    "precipitation": "yagis_mm",
}
SUTUNLAR = [
    "zaman_utc",
    "nokta",
    "enlem",
    "boylam",
    "rakim",
    "sicaklik_c",
    "bagil_nem",
    "ruzgar_hizi_ms",
    "ruzgar_yonu",
    "ruzgar_esinti_ms",
    "yagis_mm",
    "ruzgar_u",
    "ruzgar_v",
]


def kafes_noktalari(bbox: BBox, nx: int = 4, ny: int = 3) -> list[tuple[float, float]]:
    """Kutu içinde köşeler dahil düzgün nx x ny (boylam x enlem) kafes noktalarını döndürür.

    Sıra: enlem önce (güneyden kuzeye), her enlemde batıdan doğuya.
    """
    if nx < 2 or ny < 2:
        raise ValueError("Kafes en az 2 x 2 olmalı (köşeler dahil).")
    bati, guney, dogu, kuzey = bbox
    boylamlar = np.linspace(bati, dogu, nx)
    enlemler = np.linspace(guney, kuzey, ny)
    return [(float(enlem), float(boylam)) for enlem in enlemler for boylam in boylamlar]


def ruzgar_uv(hiz: ArrayLike, yon: ArrayLike) -> tuple[np.ndarray, np.ndarray]:
    """Rüzgar hızı ve geliş yönünden (derece) doğu (u) ve kuzey (v) bileşenlerini hesaplar (m/s).

    Yön, rüzgarın geldiği yöndür: kuzeyden (0°) esen rüzgar v < 0 verir (hava güneye akar),
    doğudan (90°) esen rüzgar u < 0 verir (hava batıya akar).
    """
    radyan = np.deg2rad(yon)
    return -hiz * np.sin(radyan), -hiz * np.cos(radyan)


def tabloya_cevir(yanit: dict | list[dict]) -> pd.DataFrame:
    """Open-Meteo yanıtını uzun tabloya çevirir.

    Tek konum için sözlük, birden çok konum için (sorgudaki sırayla) liste döner.
    `nokta` sütunu bu sıradaki indeksi (0'dan başlayan) gösterir.
    """
    konumlar = [yanit] if isinstance(yanit, dict) else yanit
    parcalar = []
    for no, konum in enumerate(konumlar):
        if konum.get("utc_offset_seconds", 0) != 0:
            raise ValueError("Yanıt UTC değil; sorguda timezone=GMT kullanılmalı.")
        saatlik = konum["hourly"]
        zamanlar = pd.to_datetime(saatlik["time"]).tz_localize("UTC")
        satir = {
            "zaman_utc": list(zamanlar.strftime("%Y-%m-%dT%H:%M:%SZ")),
            "nokta": no,
            "enlem": konum["latitude"],
            "boylam": konum["longitude"],
            "rakim": konum["elevation"],
        }
        for kaynak_ad, hedef_ad in DEGISKENLER.items():
            satir[hedef_ad] = saatlik[kaynak_ad]
        parcalar.append(pd.DataFrame(satir))

    tablo = pd.concat(parcalar, ignore_index=True)
    tablo["ruzgar_u"], tablo["ruzgar_v"] = ruzgar_uv(
        tablo["ruzgar_hizi_ms"].to_numpy(dtype=float), tablo["ruzgar_yonu"].to_numpy(dtype=float)
    )
    return tablo[SUTUNLAR]


def _indir(noktalar: list[tuple[float, float]], baslangic: date, bitis: date, api: str) -> str:
    """Tüm noktaları tek istekte sorgular; ham JSON metnini döndürür."""
    yanit = requests.get(
        api,
        params={
            "latitude": ",".join(f"{enlem:.4f}" for enlem, _ in noktalar),
            "longitude": ",".join(f"{boylam:.4f}" for _, boylam in noktalar),
            "start_date": baslangic.isoformat(),
            "end_date": bitis.isoformat(),
            "hourly": ",".join(DEGISKENLER),
            "wind_speed_unit": "ms",
            "timezone": "GMT",
        },
        timeout=120,
    )
    if yanit.status_code != 200:
        raise RuntimeError(f"Open-Meteo: {yanit.status_code} {yanit.text[:200]}")
    return yanit.text


def _kapsiyor(metin: str, baslangic: date, bitis: date) -> bool:
    """Önbellekteki yanıt tam olarak istenen gün aralığını mı içeriyor?"""
    konum = json.loads(metin)
    saatler = (konum if isinstance(konum, dict) else konum[0])["hourly"]["time"]
    return saatler[0][:10] == baslangic.isoformat() and saatler[-1][:10] == bitis.isoformat()


def hazirla(
    izgara: Izgara,
    baslangic: date,
    bitis: date,
    nx: int = 4,
    ny: int = 3,
    tahmin: bool = False,
) -> dict[str, Path]:
    """Izgara alanı için `baslangic`–`bitis` (UTC günleri, ikisi dahil) saatlik havayı indirir,
    kaydeder ve CSV'ye yazar.

    `tahmin=False`: geçmiş (ERA5 arşivi, ~5 gün gecikmeli). `tahmin=True`: Open-Meteo tahmin
    API'si (son birkaç gün + önümüzdeki günler; "şimdi" senaryoları için).
    Döner: {"ham": ham JSON yolu, "islenmis": hava.csv yolu}. Saatler UTC'dir.
    """
    ham_yol = HAM_VERI_DIZINI / izgara.ad / "open_meteo.json"
    # Önbellek: geçmiş veri değişmez; ama başka bir tarih aralığına aitse yeniden indirilir.
    if ham_yol.exists() and _kapsiyor(ham_yol.read_text(encoding="utf-8"), baslangic, bitis):
        metin = ham_yol.read_text(encoding="utf-8")
    else:
        metin = _indir(
            kafes_noktalari(izgara.wgs84_sinirlari(), nx, ny),
            baslangic,
            bitis,
            TAHMIN_API if tahmin else ARSIV_API,
        )
        ham_yol.parent.mkdir(parents=True, exist_ok=True)
        ham_yol.write_text(metin, encoding="utf-8")

    tablo = tabloya_cevir(json.loads(metin))
    islenmis_yol = ISLENMIS_VERI_DIZINI / izgara.ad / "hava.csv"
    islenmis_yol.parent.mkdir(parents=True, exist_ok=True)
    tablo.to_csv(islenmis_yol, index=False)
    return {"ham": ham_yol, "islenmis": islenmis_yol}
