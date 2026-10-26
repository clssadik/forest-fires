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
# GLO-90: uzaktan okumada (senaryo modu) kullanılır. 30 m karodan bir senaryo penceresi ~20 MB
# ve bu kaynaktan dakikalar sürüyor; 90 m'de ~3 sn. Kalibre model (v3) eğimi kullanmadığı için
# (a = 0) kayıp küçük: yükseklik yalnızca hava alanının sıcaklık düzeltmesine girer.
KAYNAK_URL_90 = "https://copernicus-dem-90m.s3.amazonaws.com"
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


def karo_url(kod: str, glo90: bool = False) -> str:
    """Karonun S3 adresi (GLO-30 ya da GLO-90). Dosya ve klasör adı aynıdır."""
    ad = f"Copernicus_DSM_COG_{30 if glo90 else 10}_{kod}_DEM"
    return f"{KAYNAK_URL_90 if glo90 else KAYNAK_URL}/{ad}/{ad}.tif"


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


def uzak_karolar(bbox: BBox) -> list[str]:
    """Kutuyu kaplayan ve kaynakta bulunan GLO-90 karolarının adresleri (olmayanlar genelde
    deniz)."""
    adresler = []
    for kod in karo_kodlari(bbox):
        if requests.head(karo_url(kod, glo90=True), timeout=30).status_code == 200:
            adresler.append(karo_url(kod, glo90=True))
        else:
            log.info("DEM karosu yok, atlanıyor: %s", kod)
    return adresler


def mozaikle_ve_yansit(
    karolar: list[Path] | list[str], izgara: Izgara, sinirlar: BBox | None = None
) -> np.ndarray:
    """Karoları birleştirir ve ortak ızgaraya bilineer yöntemle oturtur (metre, float32).

    `karolar` yerel yol ya da uzak COG adresi olabilir. `sinirlar` (WGS84) verilirse yalnızca o
    pencere okunur: uzak karoda yalnızca gereken baytlar indirilir.
    """
    kaynaklar = [rasterio.open(k) for k in karolar]
    try:
        nodata = kaynaklar[0].nodata
        mozaik, donusum = merge(kaynaklar, bounds=sinirlar, nodata=nodata)
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


def hazirla(izgara: Izgara, uzaktan: bool = False) -> dict[str, Path]:
    """Karoları indirir, ızgaraya oturtur ve yükseklik, eğim, bakı katmanlarını yazar.

    `uzaktan=True` (senaryo modu): karolar indirilmez; GLO-90 uzak COG'dan yalnızca ızgaranın
    penceresi okunur (~3 sn) ve 30 m ızgaraya bilineer örneklenir.
    Döndürülen sözlük: {"yukseklik": ..., "egim": ..., "baki": ...} yolları.
    """
    sinirlar = izgara.wgs84_sinirlari()
    if uzaktan:
        bati, guney, dogu, kuzey = sinirlar
        pay = 0.01  # derece; bilineer örnekleme kenarda komşu piksele ihtiyaç duyar
        sinirlar = (bati - pay, guney - pay, dogu + pay, kuzey + pay)
        karolar = uzak_karolar(sinirlar)
    else:
        karolar = []
        for kod in karo_kodlari(sinirlar):
            yol = karo_indir(kod, HAM_VERI_DIZINI / izgara.ad / "dem")
            if yol is None:
                log.info("DEM karosu yok, atlanıyor: %s", kod)
            else:
                karolar.append(yol)
        sinirlar = None
    if not karolar:
        raise RuntimeError(f"{izgara.ad} için hiç DEM karosu bulunamadı")

    yukseklik = mozaikle_ve_yansit(karolar, izgara, sinirlar)
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
