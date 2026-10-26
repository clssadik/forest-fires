"""Sentinel-2 dNBR ile gerçek yanmış alan (modelin doğrulama referansı).

Kaynak: Sentinel-2 L2A, Earth Search STAC (AWS, anahtarsız). Yangından önceki ve sonraki
bulutsuz sahnelerden Normalize Yanma Oranı (NBR) hesaplanır:

    NBR  = (NIR - SWIR2) / (NIR + SWIR2)      (B8A ve B12, ikisi de 20 m)
    dNBR = NBR_önce - NBR_sonra

Yanan bitki örtüsü NIR'de kararır, SWIR2'de parlar; NBR düşer, dNBR yükselir.
Şiddet sınıfları Key & Benson (2006) eşiklerine göredir. Mevsimsel farkı gidermek için
yangından uzak, yanmamış bitki örtüsünün ortanca dNBR'si ofset olarak çıkarılır.

Yanmış alan maskesi: düzeltilmiş dNBR >= eşik, küçük lekeler temizlenmiş ve yalnızca
FIRMS tespitlerine yakın parçalar. Tarım hasadı gibi yangın dışı değişimler böylece ayıklanır.

Çıktılar ortak ızgaraya oturur:
- dnbr.tif: ofseti düzeltilmiş dNBR, float32, NaN = veri yok
- yanma_siddeti.tif: Key & Benson sınıfı, uint8 (bkz. SIDDET_SINIFLARI)
- yanmis_alan.tif: 1 = yanmış, uint8
- yanmis_alan.json: kullanılan sahneler, ofset, eşik duyarlılığı, alanlar
"""

import json
import math
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from pystac_client import Client
from rasterio import features, windows
from rasterio.warp import Resampling, reproject, transform_bounds
from shapely import STRtree, points
from shapely.geometry import shape

from orman.ayarlar import HAM_VERI_DIZINI, ISLENMIS_VERI_DIZINI
from orman.izgara import Izgara
from orman.senaryo import Senaryo

STAC_URL = "https://earth-search.aws.element84.com/v1"
KOLEKSIYON = "sentinel-2-l2a"
NIR, SWIR2, SCL = "nir08", "swir22", "scl"  # Earth Search v1 varlık adları (B8A, B12, SCL)
GDAL_AYARLARI = {"GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR", "AWS_NO_SIGN_REQUEST": "YES"}

# Sahne sınıflandırması (SCL): geçersiz sayılan sınıflar.
# 0 veri yok, 1 doygun/bozuk, 3 bulut gölgesi, 6 su, 8-9 bulut, 10 ince bulut (sirrus), 11 kar.
GECERSIZ_SCL = (0, 1, 3, 6, 8, 9, 10, 11)

# Key & Benson (2006) şiddet sınıfları: kod -> (ad, alt sınır). Üst sınır bir sonrakinin altıdır.
SIDDET_SINIFLARI: dict[int, tuple[str, float]] = {
    1: ("yeniden_buyume", -np.inf),
    2: ("yanmamis", -0.10),
    3: ("dusuk", 0.10),
    4: ("orta_dusuk", 0.27),
    5: ("orta_yuksek", 0.44),
    6: ("yuksek", 0.66),
}
SIDDET_NODATA = 0
DUYARLILIK_ESIKLERI = (0.10, 0.20, 0.27, 0.44)
ELEK_HUCRE = 11  # bundan küçük bağlı lekeler (~1 ha) maskeden atılır
FIRMS_YAKINLIK_M = 750.0  # bir lekenin yangına ait sayılması için bir tespite en fazla uzaklığı
OFSET_UZAKLIK_M = 5000.0  # ofset hesabındaki hücrelerin tespitlere en az uzaklığı
OFSET_YAKITLARI = (1, 2)  # ofset hesabı: orman ve maki (tarım hasadı karışmasın)


@dataclass(frozen=True)
class SahneSecimi:
    """Bir senaryo için kullanılacak Sentinel-2 geçiş tarihleri.

    Her dönemde tarihler öncelik sırasıyla verilir: ilk tarihin geçerli pikselleri esas
    alınır, bulut veya boşluk kalan yerler sonraki tarihlerle doldurulur.
    """

    once: tuple[date, ...]
    sonra: tuple[date, ...]
    esik: float  # yanmış alan maskesi için dNBR eşiği


SAHNELER: dict[str, SahneSecimi] = {
    "manavgat_2021": SahneSecimi(
        once=(date(2021, 7, 20), date(2021, 7, 15)),
        # 14 Ağu: yangının bitişinden (~7 Ağu) bir hafta sonra, bölgede bulut ~%0,007.
        sonra=(date(2021, 8, 14), date(2021, 8, 24), date(2021, 9, 3)),
        esik=0.10,
    ),
    # Genelleme testi: Manavgat'taki kurallar aynen (eşik 0,10); tarihler aynı yörünge (S2B, 10 gün
    # arayla). 18 Haz: yangından 3 gün önce; 28 Haz: kontrol altına alınmasından 3 gün sonra.
    "marmaris_2022": SahneSecimi(
        once=(date(2022, 6, 18), date(2022, 6, 8), date(2022, 6, 3)),
        sonra=(date(2022, 6, 28), date(2022, 7, 8), date(2022, 7, 3)),
        esik=0.10,
    ),
}


def nbr(nir: np.ndarray, swir2: np.ndarray) -> np.ndarray:
    """Normalize Yanma Oranı. Toplamı sıfır veya negatif olan pikseller NaN olur."""
    nir = nir.astype("float32")
    swir2 = swir2.astype("float32")
    toplam = nir + swir2
    with np.errstate(divide="ignore", invalid="ignore"):
        sonuc = (nir - swir2) / toplam
    return np.where(toplam > 0, sonuc, np.nan).astype("float32")


def siddet_sinifi(dnbr: np.ndarray) -> np.ndarray:
    """dNBR'yi Key & Benson sınıf kodlarına çevirir (uint8, NaN -> 0)."""
    sinif = np.full(dnbr.shape, SIDDET_NODATA, dtype=np.uint8)
    gecerli = ~np.isnan(dnbr)
    for kod, (_, alt) in SIDDET_SINIFLARI.items():
        sinif[gecerli & (dnbr >= alt)] = kod
    return sinif


def mozaikle(katmanlar: list[np.ndarray]) -> np.ndarray:
    """Öncelik sırasıyla verilen katmanlarda her hücreye ilk geçerli (NaN olmayan) değeri koyar."""
    sonuc = np.full(katmanlar[0].shape, np.nan, dtype="float32")
    for katman in katmanlar:
        bos = np.isnan(sonuc)
        sonuc[bos] = katman[bos]
    return sonuc


def yangin_maskesi(
    dnbr: np.ndarray,
    esik: float,
    izgara: Izgara,
    tespit_xy: np.ndarray,
    elek_hucre: int = ELEK_HUCRE,
    yakinlik_m: float = FIRMS_YAKINLIK_M,
) -> np.ndarray:
    """dNBR >= eşik olan, küçük olmayan ve bir FIRMS tespitine yakın lekeler (uint8, 1 = yanmış).

    `tespit_xy`: ızgara koordinat sisteminde (n, 2) tespit noktaları. Lekeler 8 komşulukla
    bağlıdır. Eleme en küçük haritalama birimi gibi çalışır: `elek_hucre`'den küçük yanmış
    lekeler atılır, yanmış alanın içindeki aynı boyuttan küçük boşluklar doldurulur.
    Veri olmayan (NaN) hücreler hiçbir zaman yanmış sayılmaz.
    """
    ham = (np.nan_to_num(dnbr, nan=-1.0) >= esik).astype(np.uint8)
    elenmis = features.sieve(ham, size=elek_hucre, connectivity=8) if elek_hucre > 1 else ham
    elenmis[np.isnan(dnbr)] = 0
    if len(tespit_xy) == 0:
        return np.zeros_like(elenmis)
    lekeler = [
        shape(geo)
        for geo, deger in features.shapes(
            elenmis, mask=elenmis.astype(bool), transform=izgara.transform, connectivity=8
        )
        if deger == 1
    ]
    agac = STRtree(points(tespit_xy))
    yakin = [
        leke for leke in lekeler if len(agac.query(leke, predicate="dwithin", distance=yakinlik_m))
    ]
    if not yakin:
        return np.zeros_like(elenmis)
    kapsam = features.rasterize(
        yakin, out_shape=izgara.sekil, transform=izgara.transform, fill=0, default_value=1
    ).astype(np.uint8)
    return (kapsam & elenmis).astype(np.uint8)


def tespitlerden_uzaklik_maskesi(
    izgara: Izgara, tespit_xy: np.ndarray, uzaklik_m: float
) -> np.ndarray:
    """Tespitlerin `uzaklik_m` yarıçaplı dairelerinin birleşimi (bool, True = yakın)."""
    if len(tespit_xy) == 0:
        return np.zeros(izgara.sekil, dtype=bool)
    daireler = points(tespit_xy).tolist()
    return features.rasterize(
        (nokta.buffer(uzaklik_m, quad_segs=4) for nokta in daireler),
        out_shape=izgara.sekil,
        transform=izgara.transform,
        fill=0,
        default_value=1,
    ).astype(bool)


def _sahneleri_bul(izgara: Izgara, tarih: date) -> list:
    """O gün ızgarayı kesen L2A sahneleri, karo başına bir tane. Aynı karonun yeniden
    işlenmiş sürümü varsa (kimlik sonu _0, _1...) en yenisi alınır."""
    arama = Client.open(STAC_URL).search(
        collections=[KOLEKSIYON],
        bbox=izgara.wgs84_sinirlari(),
        datetime=f"{tarih:%Y-%m-%d}T00:00:00Z/{tarih:%Y-%m-%d}T23:59:59Z",
    )
    karolar = {}
    for sahne in sorted(arama.items(), key=lambda s: s.id):
        karolar[sahne.properties.get("grid:code", sahne.id)] = sahne
    return [karolar[k] for k in sorted(karolar)]


def yansima_ayari(sahne_ozellikleri: dict, bant: dict) -> tuple[float, float, float | None]:
    """Bandın (ölçek, ofset, nodata) değerleri; DN * ölçek + ofset = yansıma.

    İşleme sürümü 04.00 ve sonrasında ESA piksellere +1000 ekler; Earth Search bu farkı
    piksellerden zaten çıkarıp `earthsearch:boa_offset_applied = True` yazar, ama varlık
    metadatasında `offset: -0.1` bırakır. Bu ofset ikinci kez uygulanırsa yansıma 0,1
    düşer (deniz negatif çıkar). Bu yüzden işaret varsa ofset yok sayılır.
    Kontrol (2026-10-25): aynı sahnenin 03.01 ve 05.00 sürümlerinde DN değerleri aynı.
    """
    ofset = (
        0.0 if sahne_ozellikleri.get("earthsearch:boa_offset_applied") else bant.get("offset", 0.0)
    )
    return bant.get("scale", 1.0), ofset, bant.get("nodata")


def _izgara_sinirlari(izgara: Izgara) -> tuple[float, float, float, float]:
    """Izgaranın kendi koordinat sistemindeki (sol, alt, sağ, üst) sınırları."""
    x0, y1 = izgara.transform @ (0, 0)
    x1, y0 = izgara.transform @ (izgara.genislik, izgara.yukseklik)
    return (x0, y0, x1, y1)


def _kirp(href: str, izgara: Izgara, hedef: Path) -> None:
    """Uzak COG'dan ızgara kutusuna denk gelen pencereyi okuyup ham değerleriyle `hedef`e
    yazar (veri tipi ve nodata korunur). Karo tamamen indirilmez.
    """
    tampon = 2 * izgara.cozunurluk
    sol, alt, sag, ust = _izgara_sinirlari(izgara)
    with rasterio.Env(**GDAL_AYARLARI), rasterio.open(href) as kaynak:
        kutu = transform_bounds(
            izgara.crs, kaynak.crs, sol - tampon, alt - tampon, sag + tampon, ust + tampon
        )
        kaba = windows.from_bounds(*kutu, transform=kaynak.transform)
        sutun0, satir0 = math.floor(kaba.col_off), math.floor(kaba.row_off)
        sutun1 = math.ceil(kaba.col_off + kaba.width)
        satir1 = math.ceil(kaba.row_off + kaba.height)
        pencere = windows.Window(sutun0, satir0, sutun1 - sutun0, satir1 - satir0).intersection(
            windows.Window(0, 0, kaynak.width, kaynak.height)
        )
        veri = kaynak.read(1, window=pencere)
        transform = kaynak.window_transform(pencere)
        crs, nodata = kaynak.crs, kaynak.nodata

    hedef.parent.mkdir(parents=True, exist_ok=True)
    gecici = hedef.with_name(hedef.stem + ".gecici.tif")
    with rasterio.open(
        gecici,
        "w",
        driver="GTiff",
        height=veri.shape[0],
        width=veri.shape[1],
        count=1,
        dtype=veri.dtype,
        crs=crs,
        transform=transform,
        nodata=nodata,
        compress="deflate",
        tiled=True,
        blockxsize=256,
        blockysize=256,
    ) as ds:
        ds.write(veri, 1)
    gecici.replace(hedef)


def _sahneyi_indir(sahne, izgara: Izgara, dizin: Path) -> dict[str, Path]:
    """Sahnenin NIR, SWIR2 ve SCL kırpmalarını ham DN olarak önbelleğe alır."""
    yollar = {}
    for anahtar in (NIR, SWIR2, SCL):
        yol = dizin / f"{sahne.id}_{anahtar}.tif"
        if not yol.exists():
            _kirp(sahne.assets[anahtar].href, izgara, yol)
        yollar[anahtar] = yol
    return yollar


def _yansima_oku(yol: Path, ayar: tuple[float, float, float | None]) -> np.ndarray:
    """Ham DN kırpmasını yansımaya çevirir (float32, nodata -> NaN)."""
    olcek, ofset, nodata = ayar
    with rasterio.open(yol) as ds:
        dn = ds.read(1)
    yansima = (dn * olcek + ofset).astype("float32")
    if nodata is not None:
        yansima[dn == nodata] = np.nan
    return yansima


def sahne_nbr(nir: np.ndarray, swir2: np.ndarray, scl: np.ndarray) -> np.ndarray:
    """Sahnenin NBR'si; bulut, gölge, su ve veri olmayan pikseller NaN."""
    sonuc = nbr(nir, swir2)
    sonuc[np.isin(scl, GECERSIZ_SCL)] = np.nan
    return sonuc


def _sahne_nbr_izgarada(sahne, yollar: dict[str, Path], izgara: Izgara) -> np.ndarray:
    """Kırpmalardan 20 m NBR hesaplar, 30 m ızgaraya ortalama alarak oturtur."""
    nir, swir2 = (
        _yansima_oku(
            yollar[a],
            yansima_ayari(
                sahne.properties, (sahne.assets[a].extra_fields.get("raster:bands") or [{}])[0]
            ),
        )
        for a in (NIR, SWIR2)
    )
    with rasterio.open(yollar[NIR]) as ds_nir:
        transform, crs = ds_nir.transform, ds_nir.crs
    with rasterio.open(yollar[SCL]) as ds_scl:
        scl = np.zeros(nir.shape, dtype=np.uint8)
        reproject(  # SCL bazı sahnelerde 20 m, bazılarında 60 m olabilir: NIR'e hizala
            source=ds_scl.read(1),
            destination=scl,
            src_transform=ds_scl.transform,
            src_crs=ds_scl.crs,
            dst_transform=transform,
            dst_crs=crs,
            resampling=Resampling.nearest,
        )
    hedef = np.full(izgara.sekil, np.nan, dtype="float32")
    reproject(
        source=sahne_nbr(nir, swir2, scl),
        destination=hedef,
        src_transform=transform,
        src_crs=crs,
        src_nodata=np.nan,
        dst_transform=izgara.transform,
        dst_crs=izgara.crs,
        dst_nodata=np.nan,
        resampling=Resampling.average,
    )
    return hedef


def donem_nbr(izgara: Izgara, tarihler: tuple[date, ...], dizin: Path) -> tuple[np.ndarray, list]:
    """Bir dönemin (öncesi/sonrası) NBR mozaiği ve kullanılan sahnelerin özeti."""
    katmanlar, ozet = [], []
    for tarih in tarihler:
        for sahne in _sahneleri_bul(izgara, tarih):
            katman = _sahne_nbr_izgarada(sahne, _sahneyi_indir(sahne, izgara, dizin), izgara)
            onceki_bos = np.isnan(mozaikle(katmanlar)) if katmanlar else np.ones(izgara.sekil, bool)
            katmanlar.append(katman)
            ozet.append(
                {
                    "kimlik": sahne.id,
                    "tarih": f"{tarih:%Y-%m-%d}",
                    "bulut_yuzdesi_karo": sahne.properties.get("eo:cloud_cover"),
                    "isleme_surumu": sahne.properties.get("s2:processing_baseline"),
                    "katkı_hucre": int((onceki_bos & ~np.isnan(katman)).sum()),
                }
            )
    if not katmanlar:
        raise RuntimeError(f"{izgara.ad}: {tarihler} tarihlerinde Sentinel-2 sahnesi bulunamadı.")
    return mozaikle(katmanlar), ozet


def _tespit_noktalari(senaryo: Senaryo, tespitler: pd.DataFrame) -> np.ndarray:
    """Tutuşmadan sonraki FIRMS tespitleri, ızgara koordinatlarında (n, 2)."""
    sonra = tespitler[tespitler["zaman_utc"] >= senaryo.tutusma_utc]
    x, y = Transformer.from_crs("EPSG:4326", senaryo.izgara.crs, always_xy=True).transform(
        sonra["longitude"].to_numpy(), sonra["latitude"].to_numpy()
    )
    return np.column_stack([x, y])


def _yaz(yol: Path, veri: np.ndarray, izgara: Izgara, nodata) -> None:
    with rasterio.open(yol, "w", **izgara.rasterio_profili(str(veri.dtype), nodata=nodata)) as ds:
        ds.write(veri, 1)


def hazirla(senaryo: Senaryo, tespitler: pd.DataFrame, yakit: np.ndarray) -> dict[str, Path]:
    """Senaryo için dNBR, şiddet ve yanmış alan katmanlarını üretir.

    `tespitler`: bölge paketinin FIRMS tablosu (zaman_utc UTC). `yakit`: yakıt sınıfı
    katmanı; ofset hesabında yalnızca orman ve maki hücreleri kullanılır.
    Sentinel-2 kırpmaları `data/ham/<ad>/sentinel2/` altında önbelleğe alınır.
    """
    izgara = senaryo.izgara
    secim = SAHNELER[senaryo.ad]
    ham = HAM_VERI_DIZINI / izgara.ad / "sentinel2"
    islenmis = ISLENMIS_VERI_DIZINI / izgara.ad
    islenmis.mkdir(parents=True, exist_ok=True)

    nbr_once, ozet_once = donem_nbr(izgara, secim.once, ham)
    nbr_sonra, ozet_sonra = donem_nbr(izgara, secim.sonra, ham)
    ham_dnbr = nbr_once - nbr_sonra

    xy = _tespit_noktalari(senaryo, tespitler)
    uzak = ~tespitlerden_uzaklik_maskesi(izgara, xy, OFSET_UZAKLIK_M)
    ofset_hucreleri = uzak & np.isin(yakit, OFSET_YAKITLARI) & ~np.isnan(ham_dnbr)
    ofset = float(np.median(ham_dnbr[ofset_hucreleri]))
    dnbr = (ham_dnbr - ofset).astype("float32")

    maske = yangin_maskesi(dnbr, secim.esik, izgara, xy)
    hucre_ha = izgara.cozunurluk**2 / 10_000
    siddet = siddet_sinifi(dnbr)
    siddet_alanlari = {
        ad: round(float(((siddet == kod) & (maske == 1)).sum()) * hucre_ha, 1)
        for kod, (ad, _) in SIDDET_SINIFLARI.items()
    }
    duyarlilik = {
        f"{esik:.2f}": {
            "ham_ha": round(float((dnbr >= esik).sum()) * hucre_ha, 1),
            "yangin_ha": round(float(yangin_maskesi(dnbr, esik, izgara, xy).sum()) * hucre_ha, 1),
        }
        for esik in DUYARLILIK_ESIKLERI
    }

    yollar = {
        "dnbr": islenmis / "dnbr.tif",
        "yanma_siddeti": islenmis / "yanma_siddeti.tif",
        "yanmis_alan": islenmis / "yanmis_alan.tif",
        "yanmis_alan_ozeti": islenmis / "yanmis_alan.json",
    }
    _yaz(yollar["dnbr"], dnbr, izgara, np.nan)
    _yaz(yollar["yanma_siddeti"], siddet, izgara, SIDDET_NODATA)
    _yaz(yollar["yanmis_alan"], maske, izgara, None)
    ozet = {
        "yontem": "dNBR = NBR(B8A, B12)_once - NBR_sonra - ofset; Key & Benson (2006)",
        "sahneler": {"once": ozet_once, "sonra": ozet_sonra},
        "gecerli_hucre_orani": round(float((~np.isnan(dnbr)).mean()), 4),
        "ofset": round(ofset, 4),
        "ofset_hucre_sayisi": int(ofset_hucreleri.sum()),
        "esik": secim.esik,
        "elek_hucre": ELEK_HUCRE,
        "firms_yakinlik_m": FIRMS_YAKINLIK_M,
        "yanmis_alan_ha": round(float(maske.sum()) * hucre_ha, 1),
        "siddet_alanlari_ha": siddet_alanlari,
        "esik_duyarliligi": duyarlilik,
        "siddet_siniflari": {
            str(kod): {"ad": ad, "alt_sinir": None if np.isinf(alt) else alt}
            for kod, (ad, alt) in SIDDET_SINIFLARI.items()
        },
    }
    yollar["yanmis_alan_ozeti"].write_text(
        json.dumps(ozet, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return yollar
