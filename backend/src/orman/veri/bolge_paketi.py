"""Bölge paketi: bir senaryonun tüm model girdilerini tek komutla üretir ve tek nesnede yükler.

    uv run orman-veri manavgat_2021

Üretilen dosyalar `data/islenmis/<ad>/` altındadır:
yukseklik.tif, egim.tif, baki.tif, arazi_ortusu.tif, yakit_sinifi.tif (+ .json),
hava.csv, hava_alani.npz, firms.csv, dnbr.tif, yanma_siddeti.tif, yanmis_alan.tif (+ .json)
ve görsel kontrol için onizleme/*.png.
"""

import argparse
import warnings
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.errors import NotGeoreferencedWarning

from orman.ayarlar import HAM_VERI_DIZINI, ISLENMIS_VERI_DIZINI
from orman.senaryo import MANAVGAT_2021, MARMARIS_2022, Senaryo
from orman.veri import arazi_ortusu, dem, firms, hava, yanmis_alan
from orman.veri import hava_alani as hava_alani_modulu
from orman.veri.hava_alani import HavaAlani

SENARYOLAR = {s.ad: s for s in (MANAVGAT_2021, MARMARIS_2022)}

# Önizleme renkleri (RGB): yakıt sınıfı kodu -> renk
YAKIT_RENKLERI = {
    0: (200, 200, 200),  # yanmaz
    1: (46, 94, 46),  # orman
    2: (128, 150, 70),  # maki / çalı
    3: (214, 200, 120),  # ot
    4: (230, 170, 90),  # tarım
}
DENIZ_RENGI = (150, 190, 220)
TESPIT_RENGI = (220, 40, 30)
# Hava önizlemesi: soğuktan sıcağa renk durakları (RdYlBu), ok rengi
SICAKLIK_DURAKLARI = np.array(
    [(49, 54, 149), (116, 173, 209), (255, 255, 191), (244, 109, 67), (165, 0, 38)],
    dtype=np.float64,
)
OK_RENGI = (15, 15, 15)
# Yanma şiddeti (Key & Benson sınıf kodu) -> renk; 0 = veri yok
SIDDET_RENKLERI = {
    0: (90, 90, 90),
    1: (120, 170, 90),  # yeniden büyüme
    2: (190, 200, 170),  # yanmamış
    3: (250, 220, 110),  # düşük
    4: (245, 150, 60),  # orta-düşük
    5: (215, 70, 40),  # orta-yüksek
    6: (110, 20, 40),  # yüksek
}
SINIR_RENGI = (20, 20, 20)
ONIZLEME_HAVA_GECIKMESI = timedelta(hours=1)  # hava önizlemesi tutuşmadan bu kadar sonra


@dataclass
class BolgePaketi:
    senaryo: Senaryo
    yukseklik: np.ndarray  # m, float32, NaN = veri yok
    egim: np.ndarray  # derece, NaN = veri yok
    baki: np.ndarray  # derece (kuzeyden saat yönünde, yamacın baktığı yön), -1 = düz
    arazi_ortusu: np.ndarray  # WorldCover kodu, uint8
    yakit: np.ndarray  # yakıt sınıfı kodu, uint8 (0 = yanmaz)
    hava: pd.DataFrame  # saatlik, UTC, nokta bazında
    tespitler: pd.DataFrame  # FIRMS, UTC; satir/sutun = ızgara hücresi
    dnbr: np.ndarray  # Sentinel-2 dNBR (ofseti düzeltilmiş), float32, NaN = veri yok
    yanmis_alan: np.ndarray  # gerçek yanmış alan, uint8 (1 = yanmış); doğrulama referansı
    _hava_alani: HavaAlani | None = field(default=None, init=False, repr=False)

    @property
    def gecerli(self) -> np.ndarray:
        """Modelin kullanabileceği hücreler: tüm katmanlarda veri var (kenar halkası hariç)."""
        return ~np.isnan(self.yukseklik) & ~np.isnan(self.egim) & ~np.isnan(self.baki)

    @property
    def yanabilir(self) -> np.ndarray:
        return self.gecerli & (self.yakit > 0)

    def hava_alani(self) -> HavaAlani:
        """Saatlik hava alanı (rüzgar, sıcaklık, nem); ilk çağrıda `hava_alani.npz` okunur."""
        if self._hava_alani is None:
            self._hava_alani = HavaAlani.yukle(self.senaryo)
        return self._hava_alani


def _firms_hazirla(senaryo: Senaryo) -> Path:
    """Izgara kutusundaki FIRMS tespitlerini indirir; her tespite ızgara hücresini ekler."""
    izgara = senaryo.izgara
    ham_yol = HAM_VERI_DIZINI / izgara.ad / "firms_izgara_kutusu.csv"
    if ham_yol.exists():  # önbellek: arşiv (SP) verisi değişmez
        tablo = pd.read_csv(ham_yol)
    else:
        tablo = firms.tespitleri_indir(izgara.wgs84_sinirlari(), senaryo.baslangic, senaryo.bitis)
        ham_yol.parent.mkdir(parents=True, exist_ok=True)
        tablo.to_csv(ham_yol, index=False)
    x, y = Transformer.from_crs("EPSG:4326", izgara.crs, always_xy=True).transform(
        tablo["longitude"].to_numpy(), tablo["latitude"].to_numpy()
    )
    sutun, satir = ~izgara.transform * (x, y)
    tablo["satir"], tablo["sutun"] = np.floor(satir).astype(int), np.floor(sutun).astype(int)
    icinde = tablo["satir"].between(0, izgara.yukseklik - 1) & tablo["sutun"].between(
        0, izgara.genislik - 1
    )
    yol = ISLENMIS_VERI_DIZINI / izgara.ad / "firms.csv"
    tablo[icinde].to_csv(yol, index=False)
    return yol


def olustur(senaryo: Senaryo) -> dict[str, Path]:
    """Tüm katmanları üretir (indirilmiş ham veri varsa yeniden indirmez)."""
    (ISLENMIS_VERI_DIZINI / senaryo.ad).mkdir(parents=True, exist_ok=True)
    yollar = {}
    yollar |= dem.hazirla(senaryo.izgara)
    yollar |= arazi_ortusu.hazirla(senaryo.izgara)
    yollar["hava"] = hava.hazirla(senaryo.izgara, senaryo.baslangic, senaryo.bitis)["islenmis"]
    yollar["hava_alani"] = hava_alani_modulu.hazirla(
        senaryo.izgara,
        _oku(yollar["yukseklik"]),
        pd.read_csv(yollar["hava"], parse_dates=["zaman_utc"]),
    )
    yollar["firms"] = _firms_hazirla(senaryo)
    yollar |= yanmis_alan.hazirla(
        senaryo,
        pd.read_csv(yollar["firms"], parse_dates=["zaman_utc"]),
        _oku(yollar["yakit_sinifi"]),
    )
    yollar |= onizlemeleri_yaz(yukle(senaryo))
    return yollar


def _oku(yol: Path) -> np.ndarray:
    with rasterio.open(yol) as ds:
        veri = ds.read(1)
        if ds.nodata is not None and np.issubdtype(veri.dtype, np.floating):
            veri = np.where(veri == ds.nodata, np.nan, veri).astype("float32")
        return veri


def yukle(senaryo: Senaryo) -> BolgePaketi:
    d = ISLENMIS_VERI_DIZINI / senaryo.ad
    return BolgePaketi(
        senaryo=senaryo,
        yukseklik=_oku(d / "yukseklik.tif"),
        egim=_oku(d / "egim.tif"),
        baki=_oku(d / "baki.tif"),
        arazi_ortusu=_oku(d / "arazi_ortusu.tif"),
        yakit=_oku(d / "yakit_sinifi.tif"),
        hava=pd.read_csv(d / "hava.csv", parse_dates=["zaman_utc"]),
        tespitler=pd.read_csv(d / "firms.csv", parse_dates=["zaman_utc"]),
        dnbr=_oku(d / "dnbr.tif"),
        yanmis_alan=_oku(d / "yanmis_alan.tif"),
    )


def golgelendirme(yukseklik: np.ndarray, cozunurluk: float, azimut=315.0, aci=45.0) -> np.ndarray:
    """Tepe gölgelendirmesi (0–1). Işık kuzeybatıdan, 45° yükseklikten."""
    z = np.nan_to_num(yukseklik, nan=0.0)
    dy, dx = np.gradient(z, cozunurluk)  # dy: satır yönü (güneye doğru)
    egim = np.arctan(np.hypot(dx, dy))
    yon = np.arctan2(-dx, dy)  # yamacın baktığı yön, kuzeyden saat yönünde
    az, al = np.deg2rad(azimut), np.deg2rad(aci)
    golge = np.sin(al) * np.cos(egim) + np.cos(al) * np.sin(egim) * np.cos(az - yon)
    return np.clip(golge, 0, 1)


def yakit_rgb(yakit: np.ndarray, deniz: np.ndarray) -> np.ndarray:
    """Yakıt sınıflarını (satir, sutun, 3) uint8 RGB görüntüye çevirir."""
    rgb = np.zeros((*yakit.shape, 3), dtype=np.uint8)
    for kod, renk in YAKIT_RENKLERI.items():
        rgb[yakit == kod] = renk
    rgb[deniz] = DENIZ_RENGI
    return rgb


def _cizgi(rgb: np.ndarray, r0: float, c0: float, r1: float, c1: float) -> None:
    """(satır, sütun) arasında piksel çizgisi; görüntü dışına taşan noktalar kırpılır."""
    adim = int(max(abs(r1 - r0), abs(c1 - c0))) + 2
    satirlar = np.clip(np.round(np.linspace(r0, r1, adim)).astype(int), 0, rgb.shape[0] - 1)
    sutunlar = np.clip(np.round(np.linspace(c0, c1, adim)).astype(int), 0, rgb.shape[1] - 1)
    rgb[satirlar, sutunlar] = OK_RENGI


def hava_rgb(alan: dict[str, np.ndarray], deniz: np.ndarray, aralik: int = 60) -> np.ndarray:
    """Sıcaklık renk haritası ve rüzgar okları (her `aralik` hücrede) içeren (satır, sütun, 3) RGB.

    Renk ölçeği karadaki sıcaklık aralığına göredir. Ok uzunluğu rüzgar hızıyla orantılıdır
    (8 m/s ve üzeri en uzun ok); ok, rüzgarın ESTİĞİ yöne çizilir.
    """
    sicaklik = np.nan_to_num(alan["sicaklik_c"], nan=0.0)
    kara = ~deniz
    alt, ust = np.nanmin(alan["sicaklik_c"][kara]), np.nanmax(alan["sicaklik_c"][kara])
    konum = np.clip((sicaklik - alt) / (ust - alt), 0, 1) * (len(SICAKLIK_DURAKLARI) - 1)
    alt_durak = np.minimum(np.floor(konum).astype(int), len(SICAKLIK_DURAKLARI) - 2)
    oran = (konum - alt_durak)[..., None]
    rgb = (
        SICAKLIK_DURAKLARI[alt_durak] * (1 - oran) + SICAKLIK_DURAKLARI[alt_durak + 1] * oran
    ).astype(np.uint8)
    rgb[deniz] = DENIZ_RENGI

    satirlar = np.arange(aralik // 2, rgb.shape[0], aralik)
    sutunlar = np.arange(aralik // 2, rgb.shape[1], aralik)
    izgara_satir, izgara_sutun = np.meshgrid(satirlar, sutunlar, indexing="ij")
    u = alan["ruzgar_u"][izgara_satir, izgara_sutun]
    v = alan["ruzgar_v"][izgara_satir, izgara_sutun]
    for r, c, du, dv in zip(izgara_satir.ravel(), izgara_sutun.ravel(), u.ravel(), v.ravel()):
        hiz = float(np.hypot(du, dv))
        if not np.isfinite(hiz) or hiz < 0.1:
            continue
        # Ekranda satır aşağı doğru artar: kuzey (v > 0) satırı azaltır.
        boy = 0.8 * aralik * min(hiz / 8.0, 1.0)
        dr, dc = -dv / hiz * boy, du / hiz * boy
        uc_r, uc_c = r + dr / 2, c + dc / 2  # ok ucu
        _cizgi(rgb, r - dr / 2, c - dc / 2, uc_r, uc_c)
        for isaret in (-1, 1):  # ok başı: uçtan geriye doğru ±28° dönmüş iki kısa çizgi
            aci = np.deg2rad(28) * isaret
            geri_r, geri_c = -dr / boy, -dc / boy
            kanat_r = geri_r * np.cos(aci) - geri_c * np.sin(aci)
            kanat_c = geri_r * np.sin(aci) + geri_c * np.cos(aci)
            _cizgi(rgb, uc_r, uc_c, uc_r + 6 * kanat_r, uc_c + 6 * kanat_c)
    return rgb


def siddet_rgb(
    dnbr: np.ndarray, yanmis: np.ndarray, deniz: np.ndarray, golge: np.ndarray
) -> np.ndarray:
    """Yanma şiddeti renkleri, gölgelendirme ve yanmış alan maskesinin sınırı (koyu çizgi)."""
    siddet = yanmis_alan.siddet_sinifi(dnbr)
    rgb = np.zeros((*dnbr.shape, 3), dtype=np.uint8)
    for kod, renk in SIDDET_RENKLERI.items():
        rgb[siddet == kod] = renk
    rgb = (rgb * (0.55 + 0.45 * golge[..., None])).astype(np.uint8)
    rgb[deniz] = DENIZ_RENGI
    m = yanmis.astype(bool)
    ic = m.copy()
    ic[1:-1, 1:-1] = m[1:-1, 1:-1] & m[:-2, 1:-1] & m[2:, 1:-1] & m[1:-1, :-2] & m[1:-1, 2:]
    rgb[m & ~ic] = SINIR_RENGI
    return rgb


def _png_yaz(yol: Path, rgb: np.ndarray) -> None:
    yol.parent.mkdir(parents=True, exist_ok=True)
    # Önizleme düz bir görüntüdür; konum bilgisi taşımaması beklenen durum.
    warnings.filterwarnings("ignore", category=NotGeoreferencedWarning)
    with rasterio.open(
        yol, "w", driver="PNG", width=rgb.shape[1], height=rgb.shape[0], count=3, dtype="uint8"
    ) as ds:
        ds.write(np.moveaxis(rgb, -1, 0))


def onizlemeleri_yaz(paket: BolgePaketi) -> dict[str, Path]:
    """Görsel kontrol için PNG'ler: gölgeli yükseklik, yakıt + FIRMS tespitleri, hava alanı."""
    d = ISLENMIS_VERI_DIZINI / paket.senaryo.ad / "onizleme"
    deniz = paket.arazi_ortusu == 80
    golge = golgelendirme(paket.yukseklik, paket.senaryo.izgara.cozunurluk)

    # Yükseklik: alçak yeşil -> yüksek kahverengi-beyaz, gölge ile çarpılır
    z = np.clip(np.nan_to_num(paket.yukseklik) / 2000.0, 0, 1)[..., None]
    renk = (1 - z) * np.array([120, 160, 90]) + z * np.array([235, 225, 210])
    yukseklik_rgb = (renk * (0.35 + 0.65 * golge[..., None])).astype(np.uint8)
    yukseklik_rgb[deniz] = DENIZ_RENGI

    yakit = yakit_rgb(paket.yakit, deniz)
    yakit = (yakit * (0.6 + 0.4 * golge[..., None])).astype(np.uint8)
    t = paket.tespitler
    for ds in (-1, 0, 1):  # tespitleri 3x3 hücrelik nokta olarak çiz
        for dc in (-1, 0, 1):
            r = np.clip(t["satir"] + ds, 0, yakit.shape[0] - 1)
            c = np.clip(t["sutun"] + dc, 0, yakit.shape[1] - 1)
            yakit[r, c] = TESPIT_RENGI

    yollar = {"onizleme_yukseklik": d / "yukseklik.png", "onizleme_yakit": d / "yakit_firms.png"}
    _png_yaz(yollar["onizleme_yukseklik"], yukseklik_rgb)
    _png_yaz(yollar["onizleme_yakit"], yakit)

    yollar["onizleme_yanmis_alan"] = d / "yanmis_alan.png"
    _png_yaz(
        yollar["onizleme_yanmis_alan"], siddet_rgb(paket.dnbr, paket.yanmis_alan, deniz, golge)
    )

    zaman = paket.senaryo.tutusma_utc + ONIZLEME_HAVA_GECIKMESI
    alan = paket.hava_alani().alan(zaman)
    yollar["onizleme_hava"] = d / f"hava_{zaman:%Y-%m-%dT%H}.png"
    _png_yaz(yollar["onizleme_hava"], hava_rgb(alan, deniz))
    return yollar


def main() -> None:
    ayristirici = argparse.ArgumentParser(description="Bir senaryonun bölge paketini üretir.")
    ayristirici.add_argument("senaryo", choices=sorted(SENARYOLAR))
    yollar = olustur(SENARYOLAR[ayristirici.parse_args().senaryo])
    for ad, yol in yollar.items():
        print(f"{ad:20s} {yol}")
