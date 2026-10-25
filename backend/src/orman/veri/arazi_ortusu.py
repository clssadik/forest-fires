"""ESA WorldCover 2020 arazi örtüsünden yakıt sınıflarına.

Kaynak: ESA WorldCover 10 m, 2020 v100 (yangın öncesi). 2021 v200 haritası 2021
görüntülerinden üretildiği için yanmış alanı zaten içerir; kullanılmaz.
"""

import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.merge import merge
from rasterio.warp import Resampling

from orman.ayarlar import HAM_VERI_DIZINI, ISLENMIS_VERI_DIZINI
from orman.izgara import BBox, Izgara, izgaraya_yansit

WORLDCOVER_URL = (
    "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v100/2020/map/"
    "ESA_WorldCover_10m_2020_v100_{karo}_Map.tif"
)
KARO_BOYUTU = 3  # WorldCover karoları 3x3 derece
TAMPON = 0.01  # kırpmanın kenar payı, derece (yaklaşık 1 km)
WORLDCOVER_NODATA = 0

# WorldCover kodu -> (Türkçe ad, yakıt sınıfı kodu)
WORLDCOVER_SINIFLARI: dict[int, tuple[str, int]] = {
    10: ("Ağaç örtüsü", 1),
    20: ("Çalılık", 2),
    30: ("Otlak", 3),
    40: ("Tarım alanı", 4),
    50: ("Yapılaşmış alan", 0),
    60: ("Çıplak veya seyrek bitkili alan", 0),
    70: ("Kar ve buz", 0),
    80: ("Sürekli su", 0),
    90: ("Otsu sulak alan", 3),
    95: ("Mangrov", 2),
    100: ("Yosun ve likenler", 3),
}

# Yakıt sınıfı kodu -> ad. Kod 0, yanmayan alanlar ve veri olmayan hücrelerdir.
YAKIT_SINIFLARI: dict[int, str] = {0: "yanmaz", 1: "orman", 2: "maki_cali", 3: "ot", 4: "tarim"}


def karo_adlari(bbox: BBox) -> list[str]:
    """Kutuyu kapsayan WorldCover karolarının adları, ör. ['N36E030'].

    Karo adı sol-alt (güney-batı) köşesini verir. Kutu bir karo sınırını geçiyorsa
    birden fazla ad döner. Kenar tam bir sınıra denk gelirse o karo dahil edilmez.
    """
    bati, guney, dogu, kuzey = bbox
    return [
        _karo_adi(enlem, boylam)
        for enlem in _karo_baslangiclari(guney, kuzey)
        for boylam in _karo_baslangiclari(bati, dogu)
    ]


def _karo_baslangiclari(min_deger: float, max_deger: float) -> range:
    """[min, max] aralığını kesen karoların sol-alt köşe koordinatları."""
    bas = math.floor(min_deger / KARO_BOYUTU) * KARO_BOYUTU
    son = max(bas + KARO_BOYUTU, math.ceil(max_deger / KARO_BOYUTU) * KARO_BOYUTU)
    return range(bas, son, KARO_BOYUTU)


def _karo_adi(enlem: int, boylam: int) -> str:
    ns = "N" if enlem >= 0 else "S"
    ew = "E" if boylam >= 0 else "W"
    return f"{ns}{abs(enlem):02d}{ew}{abs(boylam):03d}"


def yakit_sinifina_cevir(arazi: np.ndarray) -> np.ndarray:
    """WorldCover kodlarını yakıt sınıfı kodlarına çevirir (uint8).

    Tabloda olmayan değerler ve nodata (0) yanmaz (0) sayılır.
    """
    tablo = np.zeros(256, dtype=np.uint8)
    for kod, (_, yakit) in WORLDCOVER_SINIFLARI.items():
        tablo[kod] = yakit
    return tablo[arazi]


def _worldcover_kirp(bbox: BBox, hedef: Path) -> None:
    """WorldCover karolarından `bbox` kırpmasını WGS84 GeoTIFF olarak `hedef`e yazar.

    Uzak COG'dan yalnızca kırpmaya denk gelen pencereler okunur; karo tamamen indirilmez.
    """
    bati, guney, dogu, kuzey = bbox
    kutu = (bati - TAMPON, guney - TAMPON, dogu + TAMPON, kuzey + TAMPON)
    kaynaklar = [rasterio.open(WORLDCOVER_URL.format(karo=k)) for k in karo_adlari(kutu)]
    try:
        veri, transform = merge(kaynaklar, bounds=kutu, nodata=WORLDCOVER_NODATA)
    finally:
        for kaynak in kaynaklar:
            kaynak.close()

    # Yarım kalan indirme önbelleğe girmesin diye önce geçici dosyaya yazılır.
    gecici = hedef.with_name(hedef.stem + ".gecici.tif")
    with rasterio.open(
        gecici,
        "w",
        driver="GTiff",
        height=veri.shape[1],
        width=veri.shape[2],
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=transform,
        nodata=WORLDCOVER_NODATA,
        compress="deflate",
        tiled=True,
        blockxsize=256,
        blockysize=256,
    ) as ds:
        ds.write(veri)
    gecici.replace(hedef)


def _arazi_ortusunu_hizala(kirpma: Path, izgara: Izgara, hedef: Path) -> None:
    """10 m'lik kırpmayı model ızgarasına çevirir. 30 m hücrede çoğunluk (mode) sınıfı alınır."""
    with rasterio.open(kirpma) as kaynak:
        arazi = izgaraya_yansit(
            kaynak, izgara, Resampling.mode, dtype="uint8", nodata=WORLDCOVER_NODATA
        )
    with rasterio.open(
        hedef, "w", **izgara.rasterio_profili("uint8", nodata=WORLDCOVER_NODATA)
    ) as ds:
        ds.write(arazi, 1)


def _lejant() -> dict:
    """Yakıt sınıfı lejantı: kod -> ad ve WorldCover -> yakıt eşlemesi."""
    return {
        "yakit_siniflari": {str(kod): ad for kod, ad in YAKIT_SINIFLARI.items()},
        "worldcover": {
            str(kod): {"ad": ad, "yakit": yakit, "yakit_ad": YAKIT_SINIFLARI[yakit]}
            for kod, (ad, yakit) in WORLDCOVER_SINIFLARI.items()
        },
        "worldcover_nodata": WORLDCOVER_NODATA,
        "aciklama": "WorldCover tablosunda olmayan kodlar ve nodata yanmaz (0) sayılır.",
    }


def hazirla(izgara: Izgara) -> dict[str, Path]:
    """Izgara için arazi örtüsü ve yakıt sınıfı katmanlarını üretir.

    WorldCover kırpması `data/ham/<ad>/` altında önbelleğe alınır; varsa yeniden indirilmez.
    """
    ham = HAM_VERI_DIZINI / izgara.ad
    islenmis = ISLENMIS_VERI_DIZINI / izgara.ad
    ham.mkdir(parents=True, exist_ok=True)
    islenmis.mkdir(parents=True, exist_ok=True)

    kirpma = ham / "worldcover_2020.tif"
    if not kirpma.exists():
        _worldcover_kirp(izgara.wgs84_sinirlari(), kirpma)

    ortu = islenmis / "arazi_ortusu.tif"
    _arazi_ortusunu_hizala(kirpma, izgara, ortu)

    with rasterio.open(ortu) as ds:
        arazi = ds.read(1)
    yakit = islenmis / "yakit_sinifi.tif"
    with rasterio.open(yakit, "w", **izgara.rasterio_profili("uint8")) as ds:
        ds.write(yakit_sinifina_cevir(arazi), 1)

    lejant = islenmis / "yakit_sinifi.json"
    lejant.write_text(json.dumps(_lejant(), ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "worldcover_kirpma": kirpma,
        "arazi_ortusu": ortu,
        "yakit_sinifi": yakit,
        "yakit_lejanti": lejant,
    }
