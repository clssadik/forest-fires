"""WindNinja ile araziye uyarlanmış rüzgâr alanı (isteğe bağlı, deneysel).

`hava_alani.py` rüzgârı ~25 km'lik ERA5 hücrelerinden IDW ile taşır; arazi (vadi, sırt)
rüzgârı yerelde bükmez. Bu modül aynı saatlik rüzgârı USFS WindNinja'nın kütle korunumlu
çözücüsüne verir: her saat için alan ortalaması hız/yön "domain average" başlatma olur,
çıktı ~120 m ızgarada döner. Sonuç yeni bir `HavaAlani` (carpan=4) olarak önbelleklenir:
`data/islenmis/<ad>/hava_alani_windninja.npz`.

- Çözücü dışarıdan çağrılır (`WindNinja_cli`); bu modül kurulu değilse yalnızca WindNinja
  isteyen fonksiyonlar hata verir, okuma/dönüştürme fonksiyonları saf numpy ile çalışır.
- WindNinja çıktısındaki `_u` / `_v` ızgaraları rüzgârın ESTİĞİ yönün bileşenleridir; kural
  `hava.ruzgar_uv` ile aynıdır (kuzeyden esen rüzgâr v < 0). Yön açısı hiç okunmaz, böylece
  WindNinja'nın açı kuralı ile projeksiyon dönüşümü devreye girmez.
- Saatlik 160 çözüm yerine benzer (hız, yön) saatleri gruplanır ve grup başına tek çözüm
  kullanılır; hangi saatin hangi gruba düştüğü `gruplar.json`'a yazılır.
- Sıcaklık ve bağıl nem mevcut 900 m alanından yeni ızgaraya çift doğrusal taşınır.

    uv --directory backend run python -m orman.veri.ruzgar_arazi manavgat_2021
"""

import argparse
import json
import math
import os
import subprocess
import time
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from rasterio.warp import Resampling, reproject

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.izgara import Izgara
from orman.senaryo import Senaryo
from orman.veri.hava import ruzgar_uv
from orman.veri.hava_alani import (
    ALAN_DEGISKENLERI,
    HavaAlani,
    _dogrusal_agirlik,
    kaba_izgara,
)

CARPAN = 4  # 4 x 30 m = 120 m çözünürlük
BITKI_ORTUSU = "trees"  # baskın örtü orman (kızılçam); WindNinja pürüzlülük sınıfı
YON_GRUP_DERECE = 15.0  # aynı gruba giren saatlerin en fazla yön farkı (kaba)
HIZ_GRUP_MS = 1.0  # aynı gruba giren saatlerin en fazla hız farkı (kaba)
WN_IKILI = os.environ.get(
    "WINDNINJA_CLI",
    str(Path.home() / "araclar" / "windninja" / "build" / "src" / "cli" / "WindNinja_cli"),
)
_ASCII_ANAHTARLARI = {
    "ncols",
    "nrows",
    "xllcorner",
    "yllcorner",
    "xllcenter",
    "yllcenter",
    "cellsize",
    "nodata_value",
}


def _dizin(senaryo: Senaryo) -> Path:
    return ISLENMIS_VERI_DIZINI / senaryo.ad / "windninja"


def onbellek_yolu(senaryo: Senaryo) -> Path:
    return ISLENMIS_VERI_DIZINI / senaryo.ad / "hava_alani_windninja.npz"


def ascii_oku(yol: Path) -> tuple[np.ndarray, Affine]:
    """ESRI ASCII ızgarasını (WindNinja çıktısı) okur: (veri, transform).

    Başlık anahtar/değer çiftleridir; sıra ve büyük/küçük harf serbesttir. NODATA hücreleri
    NaN olur. Satırlar kuzeyden güneye, standart ESRI düzenindedir.
    """
    baslik: dict[str, float] = {}
    with open(yol, encoding="ascii") as dosya:
        while True:
            konum = dosya.tell()
            parca = dosya.readline().split()
            if len(parca) != 2 or parca[0].lower() not in _ASCII_ANAHTARLARI:
                dosya.seek(konum)
                break
            baslik[parca[0].lower()] = float(parca[1])
    for anahtar in ("ncols", "nrows", "cellsize"):
        if anahtar not in baslik:
            raise ValueError(f"{yol}: ASCII başlığında {anahtar} yok")

    veri = np.loadtxt(yol, skiprows=len(baslik), dtype=np.float64)
    satir, sutun = int(baslik["nrows"]), int(baslik["ncols"])
    if veri.shape != (satir, sutun):
        raise ValueError(f"{yol}: veri {veri.shape}, başlık {(satir, sutun)}")

    hucre = baslik["cellsize"]
    xll = baslik.get("xllcorner", baslik.get("xllcenter", math.nan) - hucre / 2)
    yll = baslik.get("yllcorner", baslik.get("yllcenter", math.nan) - hucre / 2)
    if not (math.isfinite(xll) and math.isfinite(yll)):
        raise ValueError(f"{yol}: ASCII başlığında köşe koordinatı yok")

    nodata = baslik.get("nodata_value", math.nan)
    veri = np.where(veri == nodata, np.nan, veri)
    return veri.astype(np.float32), Affine(hucre, 0, xll, 0, -hucre, yll + satir * hucre)


def izgaraya_oturt(
    veri: np.ndarray, transform: Affine, hedef: Izgara, yontem=Resampling.bilinear
) -> np.ndarray:
    """ASCII ızgarasını hedef modele çift doğrusal örnekler (ikisi de `hedef.crs`'te)."""
    sonuc = np.full(hedef.sekil, np.nan, dtype=np.float32)
    reproject(
        source=veri,
        destination=sonuc,
        src_transform=transform,
        src_crs=hedef.crs,
        src_nodata=np.nan,
        dst_transform=hedef.transform,
        dst_crs=hedef.crs,
        dst_nodata=np.nan,
        resampling=yontem,
    )
    return sonuc


def dem_yaz(izgara: Izgara, yukseklik: np.ndarray, kaba: Izgara, yol: Path) -> Path:
    """İnce DEM'i kaba ızgaraya indirip WindNinja'nın okuyacağı GeoTIFF olarak yazar."""
    kaba_dem = np.empty(kaba.sekil, dtype=np.float32)
    reproject(
        source=yukseklik.astype(np.float32),
        destination=kaba_dem,
        src_transform=izgara.transform,
        src_crs=izgara.crs,
        dst_transform=kaba.transform,
        dst_crs=kaba.crs,
        resampling=Resampling.bilinear,
    )
    # WindNinja deniz seviyesinin altını da kabul eder; veri boşluğu yok (bkz. yukseklik.tif).
    kaba_dem = np.nan_to_num(kaba_dem, nan=-9999.0)
    yol.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(yol, "w", **kaba.rasterio_profili("float32")) as ds:
        ds.write(kaba_dem, 1)
    return yol


def alan_ortalamasi(alan: HavaAlani, maske: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Saatlik alan ortalaması (hız m/s, geliş yönü derece) — yalnızca `maske` saatleri.

    Hız skaler ortalamadır; yön, ortalama u/v vektöründen hesaplanır (açılar ortalanmaz).
    """
    u = alan.alanlar["ruzgar_u"][maske].mean(axis=(1, 2))
    v = alan.alanlar["ruzgar_v"][maske].mean(axis=(1, 2))
    hiz = alan.alanlar["ruzgar_hizi_ms"][maske].mean(axis=(1, 2))
    yon = np.degrees(np.arctan2(-u, -v)) % 360.0
    return hiz.astype(np.float64), yon.astype(np.float64)


def saat_gruplari(hiz: np.ndarray, yon: np.ndarray) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """Benzer (hız, yön) saatleri gruplar. Döner: her saatin grup indeksi, grup (hız, yön) listesi.

    Kaba nicemleme: hız `HIZ_GRUP_MS`, yön `YON_GRUP_DERECE` kutularına yuvarlanır. Grup
    değeri, o gruptaki saatlerin ortalama hızı ve ortalama u/v'sinden gelen yönüdür.
    """
    yon_kutu = np.round(yon / YON_GRUP_DERECE).astype(int) % round(360.0 / YON_GRUP_DERECE)
    hiz_kutu = np.round(hiz / HIZ_GRUP_MS).astype(int)
    anahtarlar = list(dict.fromkeys(zip(hiz_kutu.tolist(), yon_kutu.tolist())))
    indeks = np.array([anahtarlar.index((a, b)) for a, b in zip(hiz_kutu, yon_kutu)], dtype=np.intp)
    temsiller = []
    for i in range(len(anahtarlar)):
        secili = indeks == i
        u, v = ruzgar_uv(hiz[secili], yon[secili])
        temsiller.append(
            (float(hiz[secili].mean()), float(np.degrees(np.arctan2(-u.mean(), -v.mean())) % 360.0))
        )
    return indeks, temsiller


def windninja_calistir(
    dem: Path, hiz: float, yon: float, cikti: Path, cozunurluk: float, ikili: str = WN_IKILI
) -> dict[str, float]:
    """Tek bir "domain average" çözümü çalıştırır; ASCII çıktıların yolunu döndürür.

    `hiz` m/s, `yon` rüzgârın geldiği yön (derece). `cikti` boşaltılır.
    """
    if not Path(ikili).exists():
        raise FileNotFoundError(
            f"WindNinja_cli bulunamadı: {ikili}. Kaynaktan derleyin (github.com/firelab/windninja, yalnız CLI) veya "
            "WINDNINJA_CLI ortam değişkenini ayarlayın."
        )
    ortam = dict(os.environ)
    if "WINDNINJA_DATA" not in ortam:  # kaynak ağacındaki veri klasörü (zaman dilimi vb.)
        veri = Path(ikili).resolve().parents[3] / "data"
        if veri.is_dir():
            ortam["WINDNINJA_DATA"] = str(veri)
    cikti.mkdir(parents=True, exist_ok=True)
    for dosya in cikti.iterdir():
        dosya.unlink()
    komut = [
        ikili,
        "--elevation_file", str(dem),
        "--initialization_method", "domainAverageInitialization",
        "--input_speed", f"{hiz:.3f}",
        "--input_speed_units", "mps",
        "--input_direction", f"{yon:.2f}",
        "--input_wind_height", "10",
        "--units_input_wind_height", "m",
        "--vegetation", BITKI_ORTUSU,
        "--output_wind_height", "10",
        "--units_output_wind_height", "m",
        "--output_speed_units", "mps",
        "--mesh_resolution", f"{cozunurluk:.1f}",
        "--units_mesh_resolution", "m",
        "--num_threads", "4",
        "--write_ascii_output", "true",
        "--ascii_out_aaigrid", "true",
        "--ascii_out_proj", "true",
        "--ascii_out_uv", "true",
        "--ascii_out_resolution", f"{cozunurluk:.1f}",
        "--units_ascii_out_resolution", "m",
        "--output_path", str(cikti),
    ]  # fmt: skip
    baslangic = time.perf_counter()
    sonuc = subprocess.run(komut, check=False, capture_output=True, text=True, env=ortam)
    if sonuc.returncode != 0:
        raise RuntimeError(
            f"WindNinja başarısız (hız {hiz:.2f}, yön {yon:.1f}):\n"
            f"{sonuc.stdout[-2000:]}\n{sonuc.stderr[-2000:]}"
        )
    yollar = {uzanti: next(cikti.glob(f"*_{uzanti}.asc")) for uzanti in ("vel", "u", "v")}
    return {
        **{ad: str(yol) for ad, yol in yollar.items()},
        "sure_sn": time.perf_counter() - baslangic,
    }


def _tasi(alan: np.ndarray, eski: Izgara, yeni: Izgara) -> np.ndarray:
    """(saat, satır, sütun) alanını eski kaba ızgaradan yeni kaba ızgaraya çift doğrusal taşır.

    İki ızgara aynı köşeyi paylaşır; yalnızca hücre boyu farklıdır.
    """
    oran = eski.cozunurluk / yeni.cozunurluk

    def uygula(dizi, esleme, eksen):
        alt, ust, agirlik = esleme
        sekil = [1, 1, 1]
        sekil[eksen] = -1
        agirlik = agirlik.reshape(sekil)
        return (
            np.take(dizi, alt, axis=eksen) * (1 - agirlik)
            + np.take(dizi, ust, axis=eksen) * agirlik
        )

    satir = _dogrusal_agirlik(yeni.yukseklik, eski.yukseklik, oran)
    sutun = _dogrusal_agirlik(yeni.genislik, eski.genislik, oran)
    return uygula(uygula(alan, satir, 1), sutun, 2)


def hava_alani_uret(
    senaryo: Senaryo,
    carpan: int = CARPAN,
    ikili: str = WN_IKILI,
    yazdir=print,
) -> Path:
    """WindNinja çözümlerinden `hava_alani_windninja.npz` üretir; yolunu döndürür.

    Yalnızca modelin çalıştığı saatler (tutuşma → `model_bitis_utc`) çözülür. Ara çıktılar
    `data/islenmis/<ad>/windninja/` altında kalır (tekrar çalıştırmada çözüm yeniden kullanılır).
    """
    from orman.veri.bolge_paketi import yukle as paket_yukle

    paket = paket_yukle(senaryo)
    izgara = senaryo.izgara
    kaba = kaba_izgara(izgara, carpan)
    d = _dizin(senaryo)
    dem = dem_yaz(izgara, paket.yukseklik, kaba, d / "dem_120m.tif")

    eski = paket.hava_alani()
    baslangic = senaryo.tutusma_utc.timestamp()
    bitis = senaryo.model_bitis_utc.timestamp()
    maske = (eski.saatler >= baslangic) & (eski.saatler <= bitis)
    saatler = eski.saatler[maske]
    hiz, yon = alan_ortalamasi(eski, maske)
    indeks, gruplar = saat_gruplari(hiz, yon)
    yazdir(
        f"{len(saatler)} saat, {len(gruplar)} grup; ızgara {kaba.sekil} @ {kaba.cozunurluk:.0f} m"
    )

    alanlar = {
        ad: np.empty((len(saatler), *kaba.sekil), dtype=np.float32) for ad in ALAN_DEGISKENLERI
    }
    # Sıcaklık ve nem eski alandan taşınır (rüzgârla ilgisi yok).
    for ad in ("sicaklik_c", "bagil_nem"):
        alanlar[ad][:] = _tasi(eski.alanlar[ad][maske], eski.kaba, kaba)

    kayit = {"carpan": carpan, "kaba_izgara": list(kaba.sekil), "dem": dem.name, "gruplar": []}
    for i, (g_hiz, g_yon) in enumerate(gruplar):
        cikti = d / "calistirmalar" / f"grup_{i:03d}"
        cozum = d / "calistirmalar" / f"grup_{i:03d}.json"
        if cozum.exists():  # aynı girdi: önceki çözümü kullan
            bilgi = json.loads(cozum.read_text())
        else:
            bilgi = windninja_calistir(dem, g_hiz, g_yon, cikti, float(kaba.cozunurluk), ikili)
            cozum.write_text(json.dumps(bilgi, ensure_ascii=False, indent=2))
            yazdir(f"  grup {i:3d}: {g_hiz:.2f} m/s {g_yon:5.1f}° → {bilgi['sure_sn']:.1f} sn")
        spd, tr = ascii_oku(Path(bilgi["vel"]))
        u, _ = ascii_oku(Path(bilgi["u"]))
        v, _ = ascii_oku(Path(bilgi["v"]))
        secili = indeks == i
        for ad, veri in (("ruzgar_hizi_ms", spd), ("ruzgar_u", u), ("ruzgar_v", v)):
            alanlar[ad][secili] = izgaraya_oturt(veri, tr, kaba)[None]
        kayit["gruplar"].append(
            {
                "hiz_ms": g_hiz,
                "yon_derece": g_yon,
                "saat_sayisi": int(secili.sum()),
                "sure_sn": bilgi["sure_sn"],
            }
        )
        yazdir(f"  grup {i:3d}: {g_hiz:.2f} m/s {g_yon:5.1f}° → {secili.sum()} saat")

    alan = HavaAlani(izgara, carpan, saatler, alanlar)
    yol = onbellek_yolu(senaryo)
    alan.kaydet(yol)
    kayit["saat_sayisi"] = len(saatler)
    (d / "gruplar.json").write_text(json.dumps(kayit, ensure_ascii=False, indent=2))
    yazdir(f"Yazıldı: {yol}")
    return yol


def yukle(senaryo: Senaryo) -> HavaAlani:
    """Önbellekteki WindNinja alanını okur; yoksa üretir."""
    yol = onbellek_yolu(senaryo)
    if not yol.exists():
        hava_alani_uret(senaryo)
    return HavaAlani.oku(yol, senaryo.izgara)


def main() -> None:
    from orman.veri.bolge_paketi import SENARYOLAR

    ayristirici = argparse.ArgumentParser(
        description="WindNinja ile araziye uyarlanmış rüzgâr alanı."
    )
    ayristirici.add_argument("senaryo", choices=sorted(SENARYOLAR))
    ayristirici.add_argument("--carpan", type=int, default=CARPAN)
    secim = ayristirici.parse_args()
    hava_alani_uret(SENARYOLAR[secim.senaryo], secim.carpan)


if __name__ == "__main__":
    main()
