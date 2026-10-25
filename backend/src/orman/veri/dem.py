"""Copernicus DEM GLO-30 yükseklik verisi ve türevleri (eğim, bakı).

Kaynak: copernicus-dem-30m S3 kovası (anahtarsız, kamuya açık). Karo kodu, karonun
sol-alt (güney-batı) köşesinin enlem/boylamını verir: N36_00_E031_00 → 36°K, 31°D.

Çıktılar ortak ızgaraya oturur:
- yukseklik.tif: metre, nodata -9999
- egim.tif: derece (0-90), nodata -9999
- baki.tif: derece, saat yönünde kuzeyden (0 kuzey, 90 doğu, 180 güney, 270 batı);
  yamacın baktığı yön. Düz hücreler -1.
"""

import logging
import math
import os
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.io import MemoryFile
from rasterio.merge import merge
from rasterio.warp import Resampling

from orman.ayarlar import HAM_VERI_DIZINI, ISLENMIS_VERI_DIZINI
from orman.izgara import BBox, Izgara, izgaraya_yansit

log = logging.getLogger(__name__)

KAYNAK_URL = "https://copernicus-dem-30m.s3.amazonaws.com"
NODATA = -9999.0
DUZ_ESIK_DERECE = 0.5  # bu eğimin altındaki hücreler düz kabul edilir


def karo_kodu(enlem: int, boylam: int) -> str:
    """Sol-alt köşesi (enlem, boylam) olan 1°x1° karonun kodu, ör. N36_00_E031_00."""
    enlem_isareti = "N" if enlem >= 0 else "S"
    boylam_isareti = "E" if boylam >= 0 else "W"
    return f"{enlem_isareti}{abs(enlem):02d}_00_{boylam_isareti}{abs(boylam):03d}_00"


def karo_kodlari(bbox: BBox) -> list[str]:
    """Kutuyu kaplayan karoların kodları. Kutunun kuzey/doğu kenarı tam tamsayıysa
    bir sonraki karo gerekmez."""
    bati, guney, dogu, kuzey = bbox
    return [
        karo_kodu(enlem, boylam)
        for enlem in range(math.floor(guney), math.ceil(kuzey))
        for boylam in range(math.floor(bati), math.ceil(dogu))
    ]


def karo_url(kod: str) -> str:
    """Karonun S3 adresi. Dosya ve klasör adı aynıdır."""
    ad = f"Copernicus_DSM_COG_10_{kod}_DEM"
    return f"{KAYNAK_URL}/{ad}/{ad}.tif"


def karo_indir(kod: str, hedef_dizin: Path) -> Path | None:
    """Karoyu indirir; zaten varsa tekrar indirmez. Karo yoksa (404, genelde deniz) None döner."""
    hedef = hedef_dizin / f"{kod}.tif"
    if hedef.exists():
        return hedef
    with requests.get(karo_url(kod), stream=True, timeout=120) as yanit:
        if yanit.status_code == 404:
            return None
        yanit.raise_for_status()
        hedef_dizin.mkdir(parents=True, exist_ok=True)
        gecici = hedef_dizin / (hedef.name + ".part")
        with gecici.open("wb") as dosya:
            for parca in yanit.iter_content(chunk_size=1 << 20):
                dosya.write(parca)
    os.replace(gecici, hedef)
    return hedef


def mozaikle_ve_yansit(karo_yollari: list[Path], izgara: Izgara) -> np.ndarray:
    """Karoları birleştirir ve ortak ızgaraya bilineer yöntemle oturtur (metre, float32)."""
    kaynaklar = [rasterio.open(yol) for yol in karo_yollari]
    try:
        nodata = kaynaklar[0].nodata
        mozaik, donusum = merge(kaynaklar, nodata=nodata)
        with MemoryFile() as bellek:
            with bellek.open(
                driver="GTiff",
                height=mozaik.shape[1],
                width=mozaik.shape[2],
                count=1,
                dtype=mozaik.dtype,
                crs=kaynaklar[0].crs,
                transform=donusum,
                nodata=nodata,
            ) as ds:
                ds.write(mozaik)
            with bellek.open() as ds:
                return izgaraya_yansit(ds, izgara, Resampling.bilinear, "float32", NODATA)
    finally:
        for kaynak in kaynaklar:
            kaynak.close()


def egim_ve_baki(yukseklik: np.ndarray, cozunurluk: float) -> tuple[np.ndarray, np.ndarray]:
    """Horn yöntemiyle eğim (derece) ve bakı (derece, -1 düz) hesaplar.

    Satır indeksi güneye doğru arttığı için kuzey yönündeki türev satır türevinin
    ters işaretlisidir. Yamacın baktığı yön, en dik iniş vektörünün (-dz/dx, -dz/dy)
    pusula açısıdır: atan2(doğu bileşeni, kuzey bileşeni).
    Hücrenin kendisinde ya da 8 komşusunda veri yoksa (kenar hücreler dahil) sonuç NODATA.
    """
    z = np.where(yukseklik == NODATA, np.nan, yukseklik.astype(np.float64))
    p = np.pad(z, 1, constant_values=np.nan)
    kb = p[:-2, :-2]  # kuzeybatı
    k = p[:-2, 1:-1]  # kuzey
    kd = p[:-2, 2:]  # kuzeydoğu
    b = p[1:-1, :-2]  # batı
    d = p[1:-1, 2:]  # doğu
    gb = p[2:, :-2]  # güneybatı
    g = p[2:, 1:-1]  # güney
    gd = p[2:, 2:]  # güneydoğu

    dogu_egim = ((kd + 2 * d + gd) - (kb + 2 * b + gb)) / (8 * cozunurluk)
    kuzey_egim = -((gb + 2 * g + gd) - (kb + 2 * k + kd)) / (8 * cozunurluk)

    egim = np.degrees(np.arctan(np.hypot(dogu_egim, kuzey_egim)))
    baki = np.degrees(np.arctan2(-dogu_egim, -kuzey_egim)) % 360
    baki = np.where(egim < DUZ_ESIK_DERECE, -1.0, baki)

    gecersiz = np.isnan(egim) | np.isnan(z)  # Horn çekirdeği merkezi kullanmaz; onu ayrıca ele al
    egim = np.where(gecersiz, NODATA, egim)
    baki = np.where(gecersiz, NODATA, baki)
    return egim.astype(np.float32), baki.astype(np.float32)


def _yaz(yol: Path, veri: np.ndarray, izgara: Izgara) -> None:
    yol.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(yol, "w", **izgara.rasterio_profili("float32", NODATA)) as ds:
        ds.write(veri, 1)


def hazirla(izgara: Izgara) -> dict[str, Path]:
    """Karoları indirir, ızgaraya oturtur ve yükseklik, eğim, bakı katmanlarını yazar.

    Döndürülen sözlük: {"yukseklik": ..., "egim": ..., "baki": ...} yolları.
    """
    karo_dizini = HAM_VERI_DIZINI / izgara.ad / "dem"
    karolar = []
    for kod in karo_kodlari(izgara.wgs84_sinirlari()):
        yol = karo_indir(kod, karo_dizini)
        if yol is None:
            log.info("DEM karosu yok, atlanıyor: %s", kod)
        else:
            karolar.append(yol)
    if not karolar:
        raise RuntimeError(f"{izgara.ad} için hiç DEM karosu bulunamadı")

    yukseklik = mozaikle_ve_yansit(karolar, izgara)
    egim, baki = egim_ve_baki(yukseklik, izgara.cozunurluk)

    cikti_dizini = ISLENMIS_VERI_DIZINI / izgara.ad
    yollar = {
        "yukseklik": cikti_dizini / "yukseklik.tif",
        "egim": cikti_dizini / "egim.tif",
        "baki": cikti_dizini / "baki.tif",
    }
    _yaz(yollar["yukseklik"], yukseklik, izgara)
    _yaz(yollar["egim"], egim, izgara)
    _yaz(yollar["baki"], baki, izgara)
    return yollar
