"""OpenStreetMap yolları ve akarsuları: yangının geçişini zorlaştıran doğal ve yapay engeller.

30 m'lik ızgarada çoğu yol ve dere WorldCover'da görünmez (genişlikleri hücreden dar). Her çizgi
geçtiği hücrelere bir "engel gücü" (0–1) olarak işlenir: ateşin o hücreye geçme hızı
`1 − güç` ile çarpılır (bkz. model/yayilim.py). Engel kesin duvar değildir; güçlü rüzgârda
yangın yolu atlayabilir.

Kaynak: Overpass API (OSM'nin bugünkü hâli; 2021–2022'deki yol ağı büyük ölçüde aynıdır).
Ham yanıt `data/ham/<ad>/osm_engeller.json` altında önbelleğe alınır.
"""

import json
import time
from pathlib import Path

import numpy as np
import rasterio
import requests
from pyproj import Transformer
from rasterio.features import rasterize
from shapely.geometry import LineString
from shapely.ops import transform as geometri_donustur

from orman.ayarlar import HAM_VERI_DIZINI, ISLENMIS_VERI_DIZINI
from orman.izgara import BBox, Izgara

OVERPASS_SUNUCULARI = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)
KULLANICI_AJANI = "orman-yangin-bitirme/0.1 (github.com/clssadik/forest-fires)"
DENEME_SAYISI = 6
PARCA = 2  # kutu PARCA × PARCA parçaya bölünerek sorgulanır (sunucu zaman aşımı)

# OSM etiketi -> engel gücü (0–1). Genişlik ve yakıtsız şerit payına göre kaba bir sıralama:
# çok şeritli yol ve nehir güçlü, toprak yol ve dere zayıf. `_link` bağlantıları ana sınıfla aynı.
YOL_GUCLERI: dict[str, float] = {
    "motorway": 0.9,
    "trunk": 0.9,
    "primary": 0.8,
    "secondary": 0.6,
    "tertiary": 0.5,
    "unclassified": 0.4,
    "residential": 0.4,
    "track": 0.2,
}
SU_GUCLERI: dict[str, float] = {"river": 0.8, "canal": 0.6, "stream": 0.2}


def _sorgu(bbox: BBox) -> str:
    bati, guney, dogu, kuzey = bbox
    kutu = f"{guney},{bati},{kuzey},{dogu}"
    yollar = "|".join(YOL_GUCLERI)
    sular = "|".join(SU_GUCLERI)
    return (
        "[out:json][timeout:180];"
        f'(way["highway"~"^({yollar})(_link)?$"]({kutu});'
        f'way["waterway"~"^({sular})$"]({kutu}););'
        "out tags geom;"
    )


def _overpass(sorgu: str) -> list[dict]:
    """Sunucular sırayla denenir; ana sunucu sık sık 502/504 döndürüyor."""
    for deneme in range(DENEME_SAYISI):
        url = OVERPASS_SUNUCULARI[deneme % len(OVERPASS_SUNUCULARI)]
        try:
            yanit = requests.post(
                url, data={"data": sorgu}, headers={"User-Agent": KULLANICI_AJANI}, timeout=200
            )
            if yanit.ok:
                return yanit.json()["elements"]
        except requests.RequestException:
            pass
        time.sleep(5)
    raise RuntimeError("Overpass API'ye ulaşılamadı.")


def indir(bbox: BBox) -> list[dict]:
    """Kutudaki yolları ve akarsuları (geometrili OSM `way` öğeleri) indirir."""
    bati, guney, dogu, kuzey = bbox
    ogeler: dict[int, dict] = {}
    for i in range(PARCA):
        for j in range(PARCA):
            parca = (
                bati + (dogu - bati) * j / PARCA,
                guney + (kuzey - guney) * i / PARCA,
                bati + (dogu - bati) * (j + 1) / PARCA,
                guney + (kuzey - guney) * (i + 1) / PARCA,
            )
            for oge in _overpass(_sorgu(parca)):
                ogeler[oge["id"]] = oge  # parça sınırındaki öğeler iki kez gelir
    return list(ogeler.values())


def oge_gucu(etiketler: dict[str, str]) -> float:
    """OSM etiketlerinden engel gücü; tabloda yoksa 0."""
    yol = etiketler.get("highway", "").removesuffix("_link")
    return max(YOL_GUCLERI.get(yol, 0.0), SU_GUCLERI.get(etiketler.get("waterway", ""), 0.0))


def engel_haritasi(ogeler: list[dict], izgara: Izgara) -> np.ndarray:
    """Öğeleri ızgaraya işler: hücre başına en güçlü engel (float32, 0–1).

    `all_touched`: çizginin değdiği her hücre; böylece köşegen komşuluk ince bir çizgiyi
    yanından atlayamaz.
    """
    donustur = Transformer.from_crs("EPSG:4326", izgara.crs, always_xy=True).transform
    sekiller = []
    for oge in ogeler:
        guc = oge_gucu(oge.get("tags", {}))
        noktalar = [(n["lon"], n["lat"]) for n in oge.get("geometry", [])]
        if guc > 0 and len(noktalar) >= 2:
            sekiller.append((guc, geometri_donustur(donustur, LineString(noktalar))))
    harita = np.zeros(izgara.sekil, dtype=np.float32)
    # Zayıftan güçlüye: aynı hücrede en son yazılan (en güçlü) kalır.
    for guc, cizgi in sorted(sekiller, key=lambda s: s[0]):
        rasterize(
            [(cizgi, guc)], out=harita, transform=izgara.transform, all_touched=True,
            merge_alg=rasterio.enums.MergeAlg.replace,
        )  # fmt: skip
    return harita


def hazirla(izgara: Izgara) -> dict[str, Path]:
    """Izgara için `engeller.tif` üretir; OSM yanıtı önbellekteyse yeniden indirmez."""
    ham = HAM_VERI_DIZINI / izgara.ad / "osm_engeller.json"
    if ham.exists():
        ogeler = json.loads(ham.read_text())["elements"]
    else:
        ogeler = indir(izgara.wgs84_sinirlari())
        ham.parent.mkdir(parents=True, exist_ok=True)
        ham.write_text(json.dumps({"elements": ogeler}))
    yol = ISLENMIS_VERI_DIZINI / izgara.ad / "engeller.tif"
    yol.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(yol, "w", **izgara.rasterio_profili("float32")) as ds:
        ds.write(engel_haritasi(ogeler, izgara), 1)
    return {"osm_engeller": ham, "engeller": yol}
