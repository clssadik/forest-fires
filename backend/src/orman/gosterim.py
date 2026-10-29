"""Web haritası için dönüşümler.

Model ızgarası UTM'dedir; web haritası (MapLibre) Web Mercator kullanır. Rasterlar sunucuda
Mercator'a yansıtılır, böylece tarayıcıda dört köşesi bilinen düz bir görüntü olarak
yerleştirilebilir. Zaman rasterları `uint16` dakika olarak gönderilir (tutuşmadan bu yana;
`YOK` = yanmadı / veri yok). Vektörler (gerçek alan sınırı, FIRMS) GeoJSON'dur.
"""

import warnings
from datetime import datetime

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer
from rasterio.errors import NotGeoreferencedWarning
from rasterio.features import shapes
from rasterio.io import MemoryFile
from rasterio.warp import Resampling, calculate_default_transform, reproject
from shapely.geometry import mapping, shape

from orman.izgara import Izgara
from orman.veri.bolge_paketi import BolgePaketi, golgelendirme

HARITA_CRS = "EPSG:3857"
YOK = np.iinfo(np.uint16).max  # uint16 zaman rasterlarında "yanmadı / veri yok"
KOORDINAT_HASSASIYETI = 1e-5  # derece (~1 m); GeoJSON boyutunu küçültür
# Altlık renkleri: yakıt sınıfı -> RGB. Arayüzün sıcak, soluk tonlarıyla uyumlu; yangın
# katmanlarının (turuncu, kırmızı) önüne geçmemesi için doygunluğu düşük.
ALTLIK_RENKLERI = {
    0: (205, 198, 182),  # yanmaz
    1: (133, 150, 104),  # orman
    2: (165, 165, 118),  # maki
    3: (206, 196, 152),  # ot
    4: (214, 194, 150),  # tarım
}
ALTLIK_SU = (178, 199, 207)
SU_KODU = 80  # WorldCover: kalıcı su (deniz, baraj gölü)
KENAR_ORANI = 0.12  # altlığın saydamlaşan kenar bandı, kısa kenarın oranı


def harita_izgarasi(izgara: Izgara) -> Izgara:
    """Model ızgarasını kapsayan Web Mercator ızgarası.

    Mercator'da bir birim yerde 1/cos(enlem) kadar küçüktür. Hücre boyu bu oranla büyütülür,
    böylece Mercator hücresi yerde yine yaklaşık model hücresi (30 m) kadar olur.
    """
    sol, ust = izgara.transform.c, izgara.transform.f
    sag = sol + izgara.transform.a * izgara.genislik
    alt = ust + izgara.transform.e * izgara.yukseklik
    _, guney, _, kuzey = izgara.wgs84_sinirlari()
    cozunurluk = izgara.cozunurluk / np.cos(np.deg2rad((guney + kuzey) / 2))
    transform, genislik, yukseklik = calculate_default_transform(
        izgara.crs,
        HARITA_CRS,
        izgara.genislik,
        izgara.yukseklik,
        sol,
        alt,
        sag,
        ust,
        resolution=cozunurluk,
    )
    return Izgara(izgara.ad, HARITA_CRS, transform, genislik, yukseklik)


def koseler(harita: Izgara) -> list[list[float]]:
    """Görüntünün dört köşesi [boylam, enlem]: sol üst, sağ üst, sağ alt, sol alt (MapLibre sırası)."""
    pikseller = [
        (0, 0),
        (harita.genislik, 0),
        (harita.genislik, harita.yukseklik),
        (0, harita.yukseklik),
    ]
    xs, ys = zip(*(harita.transform @ p for p in pikseller))
    lon, lat = Transformer.from_crs(harita.crs, "EPSG:4326", always_xy=True).transform(xs, ys)
    return [[round(float(a), 6), round(float(b), 6)] for a, b in zip(lon, lat)]


def haritaya_yansit(
    veri: np.ndarray,
    izgara: Izgara,
    harita: Izgara,
    nodata: float,
    yeniden_ornekleme: Resampling = Resampling.nearest,
) -> np.ndarray:
    """Model ızgarasındaki rasterı harita ızgarasına yansıtır. Zaman ve sınıf için en yakın komşu."""
    hedef = np.full(harita.sekil, nodata, dtype=veri.dtype)
    reproject(
        source=veri,
        destination=hedef,
        src_transform=izgara.transform,
        src_crs=izgara.crs,
        src_nodata=nodata,
        dst_transform=harita.transform,
        dst_crs=harita.crs,
        dst_nodata=nodata,
        resampling=yeniden_ornekleme,
    )
    return hedef


def dakika_kodla(dakika: np.ndarray) -> np.ndarray:
    """Dakika cinsinden zaman rasterını uint16'ya çevirir: NaN → YOK, negatif → 0."""
    sonuc = np.full(dakika.shape, YOK, dtype=np.uint16)
    var = np.isfinite(dakika)
    sonuc[var] = np.clip(np.round(dakika[var]), 0, YOK - 1)
    return sonuc


def sinir_geojson(maske: np.ndarray, izgara: Izgara, sadelestirme_m: float = 30.0) -> dict:
    """Bool maskenin sınırı, WGS84 GeoJSON (tek MultiPolygon, delikler dahil)."""
    m = maske.astype(np.uint8)
    parcalar = [
        shape(g) for g, deger in shapes(m, mask=m.astype(bool), transform=izgara.transform) if deger
    ]
    birlesik = shapely.union_all(parcalar).simplify(sadelestirme_m, preserve_topology=True)
    wgs = gpd.GeoSeries([birlesik], crs=izgara.crs).to_crs("EPSG:4326").iloc[0]
    wgs = shapely.set_precision(wgs, KOORDINAT_HASSASIYETI)
    hektar = float(np.count_nonzero(m)) * izgara.cozunurluk**2 / 1e4
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"ha": round(hektar)}, "geometry": mapping(wgs)}
        ],
    }


def firms_geojson(tespitler: pd.DataFrame, tutusma_utc: datetime) -> dict:
    """FIRMS tespitleri; `saat` = tutuşmadan bu yana geçen saat (önceki tespitler negatif)."""
    saat = (
        pd.to_datetime(tespitler["zaman_utc"], utc=True) - tutusma_utc
    ).dt.total_seconds() / 3600
    ozellikler = []
    for (_, satir), s in zip(tespitler.iterrows(), saat):
        ozellikler.append(
            {
                "type": "Feature",
                "properties": {
                    "saat": round(float(s), 2),
                    "alet": satir["instrument"],
                    "uydu": satir["satellite"],
                    "frp": None if pd.isna(satir["frp"]) else round(float(satir["frp"]), 1),
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(satir["longitude"], 5), round(satir["latitude"], 5)],
                },
            }
        )
    return {"type": "FeatureCollection", "features": ozellikler}


def _puruzsuz_gurultu(sekil: tuple[int, int], kaba: int, tohum: int) -> np.ndarray:
    """0–1 arası yumuşak gürültü: `kaba × kaba` rastgele değer, iki yönde doğrusal ara değer."""
    degerler = np.random.default_rng(tohum).random((kaba, kaba))
    satir = np.linspace(0, kaba - 1, sekil[0])
    sutun = np.linspace(0, kaba - 1, sekil[1])
    ara = np.array([np.interp(sutun, np.arange(kaba), d) for d in degerler])  # (kaba, sütun)
    return np.array([np.interp(satir, np.arange(kaba), ara[:, j]) for j in range(sekil[1])]).T


def kenar_maskesi(sekil: tuple[int, int], oran: float = KENAR_ORANI, tohum: int = 0) -> np.ndarray:
    """Izgara kenarında 1'den 0'a inen saydamlık (float32); geçiş bandı düzensiz.

    Hesap alanı dikdörtgen bir kutu; altlık kenarda birden kesilirse ekranda kare olarak görünür.
    Bant genişliği kısa kenarın `oran` katı, gürültüyle ±%40 oynar; en dış hücreler hep saydam.
    """
    satir_n, sutun_n = sekil
    bant = oran * min(sekil)
    satir = np.minimum(np.arange(satir_n), np.arange(satir_n)[::-1])[:, None]
    sutun = np.minimum(np.arange(sutun_n), np.arange(sutun_n)[::-1])[None, :]
    uzaklik = np.minimum(satir, sutun) / bant  # kenardan uzaklık, bant biriminde
    olcek = 0.6 + 0.8 * _puruzsuz_gurultu(sekil, 9, tohum)
    x = np.clip(uzaklik / olcek, 0.0, 1.0)
    return (x * x * (3.0 - 2.0 * x)).astype(np.float32)  # smoothstep


def altlik_rgba(paket: BolgePaketi, harita: Izgara) -> np.ndarray:
    """Harita altlığı: yakıt sınıfı renkleri × tepe gölgelendirmesi, su mavi; kenarlar
    düzensiz bir bantla saydamlaşır (`kenar_maskesi`), ızgara dışı saydam."""
    izgara = paket.senaryo.izgara
    golge = golgelendirme(paket.yukseklik, izgara.cozunurluk)
    rgb = np.zeros((*paket.yakit.shape, 3), dtype=np.float32)
    for kod, renk in ALTLIK_RENKLERI.items():
        rgb[paket.yakit == kod] = renk
    rgb *= (0.6 + 0.4 * golge)[..., None]
    rgb[paket.arazi_ortusu == SU_KODU] = ALTLIK_SU
    alfa = (255 * kenar_maskesi(paket.yakit.shape)).astype(np.uint8)
    rgba = np.dstack([rgb.astype(np.uint8), alfa])
    return np.dstack(
        [haritaya_yansit(rgba[..., b], izgara, harita, 0, Resampling.bilinear) for b in range(4)]
    )


def png(rgba: np.ndarray) -> bytes:
    """(satır, sütun, 4) uint8 görüntüyü PNG baytlarına çevirir."""
    # Konum bilgisi köşelerle ayrıca gönderiliyor; PNG'nin coğrafi bilgi taşımaması beklenen durum.
    warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
    with MemoryFile() as dosya:
        with dosya.open(
            driver="PNG",
            width=rgba.shape[1],
            height=rgba.shape[0],
            count=4,
            dtype="uint8",
        ) as ds:
            ds.write(np.moveaxis(rgba, -1, 0))
        return dosya.read()
