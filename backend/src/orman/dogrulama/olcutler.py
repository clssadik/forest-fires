"""Doğrulama ölçütleri: bir varış zamanı (TOA) rasterını gerçek yangınla karşılaştırır.

Giriş tek bir TOA rasterıdır (dakika, NaN = yanmadı); tek çalıştırma, çoklu çalıştırmanın
topluluk TOA'sı ya da bir baseline olabilir. `dogrula(toa, referans)` iki bakış açısı verir:

- **Bitişte:** modelin `bitis_dk` anına kadar yaktığı alan. Model durmayı bilmediği için
  burada fazla tahmin (yanlış alarm) cezası büyüktür.
- **Alan eşitlenmiş:** modelin gerçek alan kadar yaktığı an. Zaman ölçeğinden bağımsız olarak
  şeklin ve yönün ne kadar doğru olduğunu gösterir.

Zamansal ölçüt için FIRMS tespitlerinden yaklaşık bir "gözlenen varış zamanı" rasterı türetilir:
gerçek yanmış alandaki her hücre için, ayak izi o hücreyi kapsayan en erken tespitin zamanı.
Uydu her yeri günde birkaç kez gördüğü için bu, gerçek varışın üst sınırıdır (birkaç saat geç).
"""

from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd

YAKIN_FARK_SAAT = 12.0  # zaman farkı bu kadar saat içindeyse "yakın" sayılır


@dataclass(frozen=True)
class MekansalOlcutler:
    """Tahmin ve gerçek maskenin karşılaştırması (alanlar hektar)."""

    dogru_ha: float  # ikisinde de yanmış
    yanlis_alarm_ha: float  # model yaktı, gerçekte yanmadı
    kacirilan_ha: float  # gerçekte yandı, model yakmadı
    model_ha: float
    gercek_ha: float
    iou: float  # Jaccard: dogru / (dogru + yanlış alarm + kaçırılan)
    dice: float  # Sørensen-Dice: 2·dogru / (model + gerçek)
    kappa: float  # Cohen: şansa göre düzeltilmiş uyum (yanmamış hücreler de sayılır)
    isabet: float  # modelin yaktığının doğru oranı (precision)
    duyarlilik: float  # gerçeğin yakalanan oranı (recall)


@dataclass(frozen=True)
class ZamanOlcutleri:
    """Model TOA − FIRMS'ten türetilen varış, gerçek yanmış alanda FIRMS'in gördüğü hücrelerde.

    Pozitif fark: model geç kalıyor. Farklar yalnızca modelin yaktığı hücrelerden hesaplanır.
    """

    hucre_sayisi: int  # FIRMS varışı olan hücre
    yanmayan_oran: float  # bunlardan modelin hiç yakmadığı oran
    ortanca_saat: float
    ceyrek_alt_saat: float  # 25. yüzdelik
    ceyrek_ust_saat: float  # 75. yüzdelik
    mutlak_ortanca_saat: float
    oran_12_saat_icinde: float  # |fark| ≤ YAKIN_FARK_SAAT olan oran


@dataclass(frozen=True)
class Referans:
    """Gerçek yangın: karşılaştırmanın öbür tarafı."""

    gercek: np.ndarray  # bool, gerçek yanmış alan (Sentinel-2 dNBR)
    kapsam: np.ndarray  # bool, değerlendirmeye giren hücreler (ızgaranın geçerli hücreleri)
    firms_toa: np.ndarray  # float32 dakika, FIRMS'ten türetilen varış (gerçek alan içinde)
    hucre_ha: float
    bitis_dk: float  # modelin durduğu an (tutuşmadan bu yana)

    @property
    def gercek_ha(self) -> float:
        return float(np.count_nonzero(self.gercek & self.kapsam)) * self.hucre_ha

    @classmethod
    def paketten(cls, paket) -> "Referans":
        senaryo = paket.senaryo
        izgara = senaryo.izgara
        gercek = paket.yanmis_alan.astype(bool)
        firms = firms_varis_zamani(
            paket.tespitler, izgara.sekil, senaryo.tutusma_utc, izgara.cozunurluk
        )
        return cls(
            gercek=gercek,
            kapsam=paket.gecerli,
            firms_toa=np.where(gercek, firms, np.nan).astype(np.float32),
            hucre_ha=izgara.cozunurluk**2 / 1e4,
            bitis_dk=(senaryo.model_bitis_utc - senaryo.tutusma_utc).total_seconds() / 60.0,
        )


@dataclass(frozen=True)
class Olcutler:
    esit_alan: MekansalOlcutler
    esit_alan_esik: float  # alan eşitlenen TOA değeri (dakika; daire baseline'ında metre)
    esit_alan_saat: float | None  # aynısı saat olarak; zamansız TOA'da yok
    bitis: MekansalOlcutler | None  # zamansız baseline'da (daire) yok
    zaman: ZamanOlcutleri | None
    yari_alan_saat: float | None  # model gerçek alanın yarısına kaçıncı saatte ulaştı


def mekansal_olcutler(
    tahmin: np.ndarray, gercek: np.ndarray, kapsam: np.ndarray, hucre_ha: float
) -> MekansalOlcutler:
    """Karışıklık matrisi ve ondan türeyen ölçütler; yalnızca `kapsam` içindeki hücreler."""
    t, g = tahmin & kapsam, gercek & kapsam
    dp = int(np.count_nonzero(t & g))  # doğru pozitif
    yp = int(np.count_nonzero(t & ~g))  # yanlış pozitif
    yn = int(np.count_nonzero(~t & g))  # yanlış negatif
    n = int(np.count_nonzero(kapsam))
    dn = n - dp - yp - yn

    def oran(pay: float, payda: float) -> float:
        return pay / payda if payda else 0.0

    po = oran(dp + dn, n)
    pe = oran((dp + yp) * (dp + yn) + (yn + dn) * (yp + dn), float(n) * n)
    return MekansalOlcutler(
        dogru_ha=dp * hucre_ha,
        yanlis_alarm_ha=yp * hucre_ha,
        kacirilan_ha=yn * hucre_ha,
        model_ha=(dp + yp) * hucre_ha,
        gercek_ha=(dp + yn) * hucre_ha,
        iou=oran(dp, dp + yp + yn),
        dice=oran(2 * dp, 2 * dp + yp + yn),
        kappa=oran(po - pe, 1.0 - pe),
        isabet=oran(dp, dp + yp),
        duyarlilik=oran(dp, dp + yn),
    )


def esit_alan_esigi(toa: np.ndarray, kapsam: np.ndarray, hedef_hucre: int) -> float:
    """`toa ≤ esik` alanının `hedef_hucre`'ye ulaştığı en erken an.

    Model hedefe hiç ulaşamazsa yaktığı son hücrenin zamanı (yani yaktığı her şey).
    """
    zamanlar = np.sort(toa[kapsam & ~np.isnan(toa)])
    if zamanlar.size == 0:
        return float("nan")
    return float(zamanlar[min(hedef_hucre, zamanlar.size) - 1])


def firms_varis_zamani(
    tespitler: pd.DataFrame, sekil: tuple[int, int], tutusma_utc: datetime, cozunurluk: float
) -> np.ndarray:
    """FIRMS'ten yaklaşık varış zamanı (dakika, NaN = tespit yok).

    Her tespitin ayak izi, merkez hücresi çevresinde `scan` (doğu-batı) × `track` (kuzey-güney)
    km'lik bir dikdörtgendir. Hücrenin değeri, onu kapsayan en erken tespittir. Tutuşmadan
    önceki tespitler alınmaz.
    """
    varis = np.full(sekil, np.inf)
    dakika = (tespitler["zaman_utc"] - pd.Timestamp(tutusma_utc)).dt.total_seconds() / 60.0
    yari_sutun = np.floor(tespitler["scan"] * 1000.0 / (2 * cozunurluk)).astype(int)
    yari_satir = np.floor(tespitler["track"] * 1000.0 / (2 * cozunurluk)).astype(int)
    for t, r, c, ys, yc in zip(dakika, tespitler["satir"], tespitler["sutun"],
                               yari_satir, yari_sutun):  # fmt: skip
        if t < 0:
            continue
        r0, r1 = max(r - ys, 0), min(r + ys + 1, sekil[0])
        c0, c1 = max(c - yc, 0), min(c + yc + 1, sekil[1])
        if r0 >= r1 or c0 >= c1:
            continue
        np.minimum(varis[r0:r1, c0:c1], t, out=varis[r0:r1, c0:c1])
    varis[np.isinf(varis)] = np.nan
    return varis.astype(np.float32)


def zaman_olcutleri(model_toa: np.ndarray, firms_toa: np.ndarray) -> ZamanOlcutleri:
    gozlenen = ~np.isnan(firms_toa)
    yandi = gozlenen & ~np.isnan(model_toa)
    fark = (model_toa[yandi].astype(np.float64) - firms_toa[yandi]) / 60.0
    n = int(np.count_nonzero(gozlenen))
    if fark.size == 0:
        bos = float("nan")
        return ZamanOlcutleri(n, 1.0 if n else 0.0, bos, bos, bos, bos, 0.0)
    alt, orta, ust = np.percentile(fark, [25, 50, 75])
    return ZamanOlcutleri(
        hucre_sayisi=n,
        yanmayan_oran=1.0 - fark.size / n,
        ortanca_saat=float(orta),
        ceyrek_alt_saat=float(alt),
        ceyrek_ust_saat=float(ust),
        mutlak_ortanca_saat=float(np.median(np.abs(fark))),
        oran_12_saat_icinde=float(np.mean(np.abs(fark) <= YAKIN_FARK_SAAT)),
    )


def buyume_egrisi(toa: np.ndarray, kapsam: np.ndarray, saatler, hucre_ha: float) -> list[float]:
    """Her saat için o ana kadar yanan alan (ha)."""
    zamanlar = np.sort(toa[kapsam & ~np.isnan(toa)])
    sayilar = np.searchsorted(zamanlar, np.asarray(saatler, dtype=np.float64) * 60.0, "right")
    return [float(s * hucre_ha) for s in sayilar]


def daire_toa(merkez: tuple[int, int], yanabilir: np.ndarray, cozunurluk: float) -> np.ndarray:
    """Daire baseline'ı: yanabilir hücrelerde tutuşma noktasına uzaklık (m), "TOA" yerine.

    Zaman bilgisi taşımaz; yalnızca alan eşitlenmiş karşılaştırmada anlamlıdır (aynı alanlı,
    tutuşma merkezli daire).
    """
    satir, sutun = np.indices(yanabilir.shape)
    uzaklik = np.hypot(satir - merkez[0], sutun - merkez[1]) * cozunurluk
    return np.where(yanabilir, uzaklik, np.nan).astype(np.float32)


def dogrula(toa: np.ndarray, referans: Referans, zamanli: bool = True) -> Olcutler:
    """TOA'yı referansla karşılaştırır. `zamanli=False`: TOA zaman değil (daire baseline'ı)."""
    r = referans
    gercek_hucre = int(np.count_nonzero(r.gercek & r.kapsam))
    esik = esit_alan_esigi(toa, r.kapsam, gercek_hucre)
    esit_alan = mekansal_olcutler(toa <= esik, r.gercek, r.kapsam, r.hucre_ha)
    if not zamanli:
        return Olcutler(esit_alan, esik, None, None, None, None)

    bitti = np.where(toa <= r.bitis_dk, toa, np.nan)
    yari = esit_alan_esigi(bitti, r.kapsam, (gercek_hucre + 1) // 2)
    yanan_hucre = np.count_nonzero(r.kapsam & ~np.isnan(bitti))
    return Olcutler(
        esit_alan=esit_alan,
        esit_alan_esik=esik,
        esit_alan_saat=esik / 60.0,
        bitis=mekansal_olcutler(~np.isnan(bitti), r.gercek, r.kapsam, r.hucre_ha),
        zaman=zaman_olcutleri(bitti, r.firms_toa),
        yari_alan_saat=yari / 60.0 if yanan_hucre >= (gercek_hucre + 1) // 2 else None,
    )
