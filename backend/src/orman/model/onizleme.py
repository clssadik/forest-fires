"""TOA (varış zamanı) önizlemesi: yayılım modelinin çıktısını gölgeli arazi üzerinde PNG olarak çizer.

Yanan hücreler erken (açık sarı) ile geç (koyu mor) arasında renklenir. Her `aralik_saat` saatte bir
eş zamanlı çizgi (izokron) siyahla çizilir. Gerçek yanmış alanın sınırı (Sentinel-2) camgöbeği
renkle en üstte durur; model ile gözlem böylece aynı görüntüde karşılaştırılır.
"""

from pathlib import Path

import numpy as np

from orman.veri.bolge_paketi import DENIZ_RENGI, BolgePaketi, _png_yaz, golgelendirme

# TOA renk durakları: erken (açık sarı) -> geç (koyu mor)
TOA_DURAKLARI = np.array(
    [
        (255, 255, 204),
        (255, 237, 160),
        (254, 204, 92),
        (253, 141, 60),
        (227, 74, 51),
        (189, 0, 38),
        (128, 0, 38),
        (74, 0, 60),
    ],
    dtype=np.float64,
)
ISOKRON_RENGI = (30, 30, 30)
GERCEK_SINIR_RENGI = (0, 200, 255)
ISARET_RENGI = (255, 255, 255)
ISARET_MERKEZ_RENGI = (0, 0, 0)
DAKIKA_SAAT = 60.0


def _sinir(maske: np.ndarray) -> np.ndarray:
    """Maskenin sınır hücreleri: maskede olup dört komşusundan biri maske dışında olanlar.

    Dizinin kenarındaki maske hücreleri de sınırdır (kenar dışı maske dışı sayılır).
    """
    p = np.pad(maske, 1, constant_values=False)
    ic = p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return maske & ~ic


def _izokron(saat: np.ndarray, yanan: np.ndarray, aralik_saat: float) -> np.ndarray:
    """Zaman bandı (her `aralik_saat` saat) sınırında kalan yanmış hücreler.

    Bir hücre, yanmış bir dört komşusunun bandından farklı bantta ise izokron üzerindedir.
    """
    bant = np.full(saat.shape, -1, dtype=np.int64)
    bant[yanan] = np.floor(saat[yanan] / aralik_saat).astype(np.int64)
    p = np.pad(bant, 1, constant_values=-1)
    farkli = np.zeros(saat.shape, dtype=bool)
    for komsu in (p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]):
        farkli |= (komsu >= 0) & (komsu != bant)
    return yanan & farkli


def _isaret(rgb: np.ndarray, satir: int, sutun: int) -> None:
    """Ateşleme noktası: 7x7 beyaz kare, ortasında 3x3 siyah çekirdek (kenarlarda kırpılır)."""

    def dilim(merkez: int, yari: int, boyut: int) -> slice:
        return slice(max(merkez - yari, 0), min(merkez + yari + 1, boyut))

    n_satir, n_sutun = rgb.shape[:2]
    rgb[dilim(satir, 3, n_satir), dilim(sutun, 3, n_sutun)] = ISARET_RENGI
    rgb[dilim(satir, 1, n_satir), dilim(sutun, 1, n_sutun)] = ISARET_MERKEZ_RENGI


def toa_rgb(
    toa: np.ndarray,
    golge: np.ndarray,
    deniz: np.ndarray,
    gercek_yanmis: np.ndarray,
    aralik_saat: float = 12.0,
    tutusma: tuple[int, int] | None = None,
) -> np.ndarray:
    """TOA (dakika, NaN = yanmamış) raster'ını (satır, sütun, 3) uint8 RGB görüntüye çevirir.

    Renk ölçeği 0'dan en geç yanan hücreye kadardır. Yanan hücreler gölgelendirilir; izokronlar
    ve gerçek yanmış alan sınırı bunların üstüne çizilir.
    """
    saat = np.asarray(toa, dtype=np.float64) / DAKIKA_SAAT
    yanan = np.isfinite(saat) & ~deniz

    grilik = 90 + 140 * golge
    rgb = np.repeat(grilik[..., None], 3, axis=-1).astype(np.uint8)
    rgb[deniz] = DENIZ_RENGI

    if yanan.any():
        maks = max(float(saat[yanan].max()), 1e-9)
        konum = np.clip(saat[yanan] / maks, 0, 1) * (len(TOA_DURAKLARI) - 1)
        alt = np.minimum(np.floor(konum).astype(int), len(TOA_DURAKLARI) - 2)
        oran = (konum - alt)[:, None]
        renk = TOA_DURAKLARI[alt] * (1 - oran) + TOA_DURAKLARI[alt + 1] * oran
        renk *= 0.55 + 0.45 * golge[yanan][:, None]
        rgb[yanan] = renk.astype(np.uint8)

    rgb[_izokron(saat, yanan, aralik_saat)] = ISOKRON_RENGI
    rgb[_sinir(np.asarray(gercek_yanmis).astype(bool))] = GERCEK_SINIR_RENGI
    if tutusma is not None:
        _isaret(rgb, *tutusma)
    return rgb


def onizleme_yaz(
    paket: BolgePaketi,
    toa: np.ndarray,
    yol: Path,
    aralik_saat: float = 12.0,
    tutusma: tuple[int, int] | None = None,
) -> Path:
    """Bölge paketinin arazisiyle TOA önizlemesini `yol` PNG dosyasına yazar."""
    golge = golgelendirme(paket.yukseklik, paket.senaryo.izgara.cozunurluk)
    deniz = paket.arazi_ortusu == 80
    _png_yaz(yol, toa_rgb(toa, golge, deniz, paket.yanmis_alan, aralik_saat, tutusma))
    return yol
