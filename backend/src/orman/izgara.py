"""Ortak model ızgarası.

Tüm girdi katmanları (yükseklik, eğim, bitki örtüsü, yanmış alan...) aynı ızgaraya
oturtulur: aynı koordinat sistemi, aynı hücre boyutu, aynı satır/sütun sayısı.
Böylece `dizi[satir, sutun]` her katmanda aynı yeri gösterir.
"""

from dataclasses import dataclass

import numpy as np
from affine import Affine
from pyproj import Transformer
from rasterio.io import DatasetReader
from rasterio.warp import Resampling, reproject

BBox = tuple[float, float, float, float]  # (batı, güney, doğu, kuzey), WGS84 derece


@dataclass(frozen=True)
class Izgara:
    ad: str
    crs: str
    transform: Affine
    genislik: int  # sütun sayısı
    yukseklik: int  # satır sayısı

    @classmethod
    def bboxtan(cls, ad: str, bbox: BBox, crs: str, cozunurluk: float) -> "Izgara":
        """WGS84 kutusunu verilen projeksiyona çevirir, kenarları hücre boyutuna hizalar."""
        donustur = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
        bati, guney, dogu, kuzey = bbox
        xs, ys = donustur.transform([bati, bati, dogu, dogu], [guney, kuzey, guney, kuzey])
        x0 = float(np.floor(min(xs) / cozunurluk) * cozunurluk)
        y1 = float(np.ceil(max(ys) / cozunurluk) * cozunurluk)
        x1 = float(np.ceil(max(xs) / cozunurluk) * cozunurluk)
        y0 = float(np.floor(min(ys) / cozunurluk) * cozunurluk)
        return cls(
            ad=ad,
            crs=crs,
            transform=Affine(cozunurluk, 0, x0, 0, -cozunurluk, y1),
            genislik=round((x1 - x0) / cozunurluk),
            yukseklik=round((y1 - y0) / cozunurluk),
        )

    @property
    def cozunurluk(self) -> float:
        return self.transform.a

    @property
    def sekil(self) -> tuple[int, int]:
        return (self.yukseklik, self.genislik)

    def wgs84_sinirlari(self) -> BBox:
        """Izgarayı kapsayan WGS84 kutusu (kaynak veriyi indirirken kullanılır)."""
        x0, y1 = self.transform @ (0, 0)
        x1, y0 = self.transform @ (self.genislik, self.yukseklik)
        geri = Transformer.from_crs(self.crs, "EPSG:4326", always_xy=True)
        lons, lats = geri.transform([x0, x0, x1, x1], [y0, y1, y0, y1])
        return (min(lons), min(lats), max(lons), max(lats))

    def rasterio_profili(self, dtype: str, nodata: float | None = None) -> dict:
        """GeoTIFF yazmak için rasterio profili (sıkıştırılmış, döşemeli)."""
        return {
            "driver": "GTiff",
            "crs": self.crs,
            "transform": self.transform,
            "width": self.genislik,
            "height": self.yukseklik,
            "count": 1,
            "dtype": dtype,
            "nodata": nodata,
            "compress": "deflate",
            "tiled": True,
            "blockxsize": 256,
            "blockysize": 256,
        }


def izgaraya_yansit(
    kaynak: DatasetReader,
    izgara: Izgara,
    yeniden_ornekleme: Resampling,
    dtype: str = "float32",
    nodata: float | None = None,
) -> np.ndarray:
    """Açık bir rasterio veri setinin ilk bandını ızgaraya yeniden örnekler.

    Sürekli veri (yükseklik) için `Resampling.bilinear`, sınıf verisi
    (bitki örtüsü) için `Resampling.nearest` veya `Resampling.mode` kullanın.
    """
    hedef = np.full(izgara.sekil, nodata if nodata is not None else 0, dtype=dtype)
    reproject(
        source=kaynak.read(1),
        destination=hedef,
        src_transform=kaynak.transform,
        src_crs=kaynak.crs,
        src_nodata=kaynak.nodata,
        dst_transform=izgara.transform,
        dst_crs=izgara.crs,
        dst_nodata=nodata,
        resampling=yeniden_ornekleme,
    )
    return hedef


# Manavgat 2021: FIRMS tespitlerinin kapsadığı alan + ~5 km tampon; UTM 36N, 30 m hücre.
MANAVGAT_2021 = Izgara.bboxtan(
    "manavgat_2021", (31.20, 36.70, 31.80, 37.12), crs="EPSG:32636", cozunurluk=30.0
)

# Marmaris 2022: FIRMS tespitlerinin kapsadığı alan (28,05–28,20 D, 36,82–36,89 K) + ~5 km tampon;
# UTM 35N (28° D, 35. dilimde), 30 m hücre.
MARMARIS_2022 = Izgara.bboxtan(
    "marmaris_2022", (27.99, 36.78, 28.26, 36.94), crs="EPSG:32635", cozunurluk=30.0
)
