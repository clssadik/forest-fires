"""Modeli bir senaryoda çalıştırır ve sonucu `data/islenmis/<ad>/model_v1/` altına yazar.

    uv run orman-model manavgat_2021              # tek çalıştırma (tohum 0)
    uv run orman-model manavgat_2021 --calisma 20 # 20 tohum: olasılık haritası + TOA ortancası

Çıktılar: toa.tif (dakika, NaN = yanmadı), çoklu çalıştırmada olasilik.tif, ozet.json
(parametreler, süre, zamana göre yanan alan, bitişte gerçek yanmış alanla örtüşme) ve
onizleme_toa.png (12 saatlik izokronlar, camgöbeği: gerçek yanmış alan sınırı).
Baseline'larla karşılaştırma ve alan eşitlenmiş ölçütler: `orman-dogrula`.
"""

import argparse
import json
import time
from dataclasses import asdict
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.olcutler import mekansal_olcutler
from orman.model.onizleme import onizleme_yaz
from orman.model.yayilim import Arazi, Parametreler, Ruzgar, coklu_yayilim, yayilim
from orman.senaryo import Senaryo
from orman.veri.bolge_paketi import SENARYOLAR, BolgePaketi, yukle

MODEL_SURUMU = "model_v1"
ALAN_SAATLERI = (3, 6, 12, 24, 48, 72, 96, 120, 144)  # ozet.json'daki yanan alan anları
TUTUSMA_ARAMA_YARICAPI = 10  # hücre; tutuşma noktası yanmaz hücreye düşerse en yakın yanabilir


def tutusma_hucresi(paket: BolgePaketi) -> tuple[int, int]:
    """Senaryonun tutuşma konumundaki (yanmazsa en yakın yanabilir) ızgara hücresi."""
    return _yanabilir_hucre(paket, *paket.senaryo.tutusma_konumu)


def tutusma_hucreleri(paket: BolgePaketi) -> list[tuple[int, int, float]]:
    """Ana tutuşma (0. dk) ve senaryonun ek tutuşmaları: (satır, sütun, tutuşmadan bu yana dk)."""
    senaryo = paket.senaryo
    hucreler = [(*tutusma_hucresi(paket), 0.0)]
    for an, enlem, boylam in senaryo.ek_tutusmalar:
        dakika = (an - senaryo.tutusma_utc).total_seconds() / 60.0
        hucreler.append((*_yanabilir_hucre(paket, enlem, boylam), dakika))
    return hucreler


def _yanabilir_hucre(paket: BolgePaketi, enlem: float, boylam: float) -> tuple[int, int]:
    izgara = paket.senaryo.izgara
    x, y = Transformer.from_crs("EPSG:4326", izgara.crs, always_xy=True).transform(boylam, enlem)
    sutun, satir = ~izgara.transform * (x, y)
    r, c = int(np.floor(satir)), int(np.floor(sutun))
    k = TUTUSMA_ARAMA_YARICAPI
    pencere = paket.yanabilir[r - k : r + k + 1, c - k : c + k + 1]
    if not pencere.any():
        raise ValueError(f"Tutuşma noktasının {k} hücre çevresinde yanabilir hücre yok.")
    dr, dc = np.nonzero(pencere)
    en_yakin = np.argmin((dr - k) ** 2 + (dc - k) ** 2)
    return r + int(dr[en_yakin]) - k, c + int(dc[en_yakin]) - k


def yaz_raster(yol: Path, veri: np.ndarray, senaryo: Senaryo) -> None:
    with rasterio.open(yol, "w", **senaryo.izgara.rasterio_profili("float32", np.nan)) as ds:
        ds.write(veri.astype("float32"), 1)


def calistir(
    senaryo: Senaryo, parametreler: Parametreler, calisma: int = 1, tohum: int = 0
) -> dict[str, Path]:
    paket = yukle(senaryo)
    arazi = Arazi.paketten(paket)
    ruzgar = Ruzgar.hava_alanindan(paket.hava_alani(), senaryo.tutusma_utc)
    hucre = tutusma_hucresi(paket)
    bitis_dk = (senaryo.model_bitis_utc - senaryo.tutusma_utc).total_seconds() / 60.0

    tutusmalar = tutusma_hucreleri(paket)
    yayilim(arazi, ruzgar, tutusmalar, parametreler, tohum, 1.0)  # Numba derlemesi ölçüme girmesin
    baslangic = time.perf_counter()
    if calisma == 1:
        toa, olasilik = yayilim(arazi, ruzgar, tutusmalar, parametreler, tohum, bitis_dk), None
    else:
        sonuc = coklu_yayilim(
            arazi, ruzgar, tutusmalar, parametreler, range(tohum, tohum + calisma), bitis_dk
        )
        toa, olasilik = sonuc.toa_ortanca, sonuc.olasilik
    sure = time.perf_counter() - baslangic

    d = ISLENMIS_VERI_DIZINI / senaryo.ad / MODEL_SURUMU
    d.mkdir(parents=True, exist_ok=True)
    yollar = {"toa": d / "toa.tif", "ozet": d / "ozet.json"}
    yaz_raster(yollar["toa"], toa, senaryo)
    if olasilik is not None:
        yollar["olasilik"] = d / "olasilik.tif"
        yaz_raster(yollar["olasilik"], olasilik, senaryo)

    # Çoklu çalıştırmada "yanan" = çalıştırmaların en az yarısında yanan hücre.
    yanan = ~np.isnan(toa) if olasilik is None else olasilik >= 0.5
    gercek = paket.yanmis_alan.astype(bool)
    ozet = {
        "senaryo": senaryo.ad,
        "model": MODEL_SURUMU,
        "parametreler": asdict(parametreler),
        "tutusma_hucresi": list(hucre),
        "tutusma_utc": senaryo.tutusma_utc.isoformat(),
        "bitis_utc": senaryo.model_bitis_utc.isoformat(),
        "calisma_sayisi": calisma,
        "ilk_tohum": tohum,
        "sure_sn": round(sure, 2),
        "yanan_alan_ha_saate_gore": {
            str(s): round(float(((toa <= s * 60.0) & yanan).sum()) * 0.09) for s in ALAN_SAATLERI
        },
        "ortusme": {
            k: round(v, 3)
            for k, v in asdict(
                mekansal_olcutler(yanan, gercek, paket.gecerli, senaryo.izgara.cozunurluk**2 / 1e4)
            ).items()
        },
    }
    yollar["ozet"].write_text(json.dumps(ozet, ensure_ascii=False, indent=2))
    yollar["onizleme"] = onizleme_yaz(
        paket, np.where(yanan, toa, np.nan), d / "onizleme_toa.png", tutusma=hucre
    )
    return yollar


def main() -> None:
    ayristirici = argparse.ArgumentParser(description="Yayılım modelini bir senaryoda çalıştırır.")
    ayristirici.add_argument("senaryo", choices=sorted(SENARYOLAR))
    ayristirici.add_argument("--calisma", type=int, default=1, help="tohum sayısı (varsayılan 1)")
    ayristirici.add_argument("--tohum", type=int, default=0, help="ilk tohum (varsayılan 0)")
    secim = ayristirici.parse_args()
    yollar = calistir(SENARYOLAR[secim.senaryo], Parametreler(), secim.calisma, secim.tohum)
    print(yollar["ozet"].read_text())
