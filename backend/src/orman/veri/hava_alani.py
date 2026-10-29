"""Hava alanı: birkaç hava noktasından model ızgarasında saatlik rüzgar, sıcaklık ve nem.

Açık hava verisi (Open-Meteo, ~25 km) yalnızca birkaç noktada var. Her saat için tam
çözünürlüklü ızgara saklamak yerine alan `KABA_CARPAN` kat kaba bir ızgarada (≈ 900 m)
hesaplanıp `data/islenmis/<ad>/hava_alani.npz` dosyasına yazılır. Sorguda alan zamanda
doğrusal, uzayda çift doğrusal (bilineer) olarak ince ızgaraya indirilir.

- Rüzgar: u ve v bileşenleri ayrı ayrı IDW ile enterpole edilir; yön açısı asla doğrudan
  ortalanmaz (350° ile 10° ortalaması 0°, yani kuzey, olmalı; 180° değil). Vektör ortalaması
  noktalar arasında hızı düşürdüğü için hız ayrıca skaler olarak enterpole edilir
  (`ruzgar_hizi_ms`); yön için u/v, hız için bu alan kullanılmalı.
- Sıcaklık: IDW'den önce her noktanın değeri standart düşüm oranıyla (6.5 °C/km) deniz
  seviyesine indirilir; IDW'den sonra hücrenin DEM ortalama yüksekliğine çıkarılır.
- Bağıl nem: yükseklik düzeltmesi yapılmaz (basitleştirme).
- Deniz üstündeki noktalar (rakım <= 0) varsayılan olarak IDW'ye katılmaz.
"""

import math
import warnings
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pandas as pd
from affine import Affine
from pyproj import Transformer

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.izgara import Izgara
from orman.senaryo import Senaryo

KABA_CARPAN = 30  # ince hücre sayısı; 30 x 30 m = 900 m kaba hücre
SICAKLIK_DUSUS_C_PER_M = 0.0065  # standart atmosfer düşüm oranı (°C/m)
IDW_GUC = 2.0
ALAN_DEGISKENLERI = ("ruzgar_u", "ruzgar_v", "ruzgar_hizi_ms", "sicaklik_c", "bagil_nem")
_MIN_MESAFE = 1e-6  # m; bundan yakın noktalar "tam çakışık" sayılır


def kaba_izgara(izgara: Izgara, carpan: int = KABA_CARPAN) -> Izgara:
    """İnce ızgaranın `carpan` katı büyüklükte hücrelerle kurulmuş kaba ızgarası.

    Aynı CRS ve aynı sol-üst köşeyi kullanır; kenar hücreler eksik kalmasın diye yukarı yuvarlanır.
    """
    if carpan < 1:
        raise ValueError("Kaba çarpan en az 1 olmalı.")
    return Izgara(
        ad=izgara.ad,
        crs=izgara.crs,
        transform=Affine(
            izgara.transform.a * carpan,
            0,
            izgara.transform.c,
            0,
            izgara.transform.e * carpan,
            izgara.transform.f,
        ),
        genislik=math.ceil(izgara.genislik / carpan),
        yukseklik=math.ceil(izgara.yukseklik / carpan),
    )


def kaba_ortalama(veri: np.ndarray, carpan: int, kaba_sekil: tuple[int, int]) -> np.ndarray:
    """İnce ızgara dizisinin kaba hücre ortalaması; NaN değerler yok sayılır.

    Hücrenin tamamı veri dışıysa sonuç NaN'dır.
    """
    kaba_satir, kaba_sutun = kaba_sekil
    tam = np.full((kaba_satir * carpan, kaba_sutun * carpan), np.nan, dtype=np.float64)
    tam[: veri.shape[0], : veri.shape[1]] = veri
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)  # tamamen NaN hücreler için
        return np.nanmean(tam.reshape(kaba_satir, carpan, kaba_sutun, carpan), axis=(1, 3))


def kaba_hucre_merkezleri(kaba: Izgara) -> np.ndarray:
    """Kaba hücre merkezlerinin koordinatları (metre), şekil (satır*sütun, 2); satır öncelikli."""
    satir, sutun = np.mgrid[0 : kaba.yukseklik, 0 : kaba.genislik]
    x, y = kaba.transform * (sutun + 0.5, satir + 0.5)
    return np.column_stack([np.ravel(x), np.ravel(y)])


def idw_agirliklari(
    hedef_xy: np.ndarray, kaynak_xy: np.ndarray, guc: float = IDW_GUC
) -> np.ndarray:
    """Ters uzaklık ağırlık matrisi, şekil (hedef, kaynak). Koordinatlar metre cinsinden.

    Ağırlıklar toplamı 1'e normalize edilmez; `idw_ortalama` oranı kendisi hesaplar. Bir hedef
    bir kaynakla tam çakışıyorsa o satır yalnızca o kaynağı kullanır (sonsuz ağırlığı önler).
    """
    fark = hedef_xy[:, None, :] - kaynak_xy[None, :, :]
    uzaklik = np.hypot(fark[..., 0], fark[..., 1])
    agirlik = 1.0 / np.maximum(uzaklik, _MIN_MESAFE) ** guc
    cakisan = uzaklik < _MIN_MESAFE
    tam = cakisan.any(axis=1)
    agirlik[tam] = cakisan[tam].astype(np.float64)
    return agirlik


def idw_ortalama(agirlik: np.ndarray, degerler: np.ndarray) -> np.ndarray:
    """Ağırlıklı ortalama, şekil (saat, hedef). `degerler` (saat, kaynak) biçimindedir.

    NaN olan kaynaklar o saat için atlanır; geçerli kaynak kalmazsa sonuç NaN'dır.
    """
    gecerli = np.isfinite(degerler)
    pay = np.where(gecerli, degerler, 0.0) @ agirlik.T
    payda = gecerli.astype(np.float64) @ agirlik.T
    return np.divide(pay, payda, out=np.full(pay.shape, np.nan), where=payda > 0)


def kaba_alan_hesapla(
    nokta_xy: np.ndarray,
    nokta_rakim: np.ndarray,
    olcumler: dict[str, np.ndarray],
    hucre_xy: np.ndarray,
    hucre_rakim: np.ndarray,
    deniz_dahil: bool = False,
) -> dict[str, np.ndarray]:
    """Nokta ölçümlerini kaba hücrelere IDW ile taşır. Döner: ad -> (saat, hücre) float32.

    `olcumler`: ad -> (saat, nokta) ham değerler; `sicaklik_c` °C olmalı. Sıcaklık deniz
    seviyesine indirilip hücre yüksekliğine çıkarılır; rüzgar bileşenleri ve nem olduğu gibi
    enterpole edilir. `hucre_rakim` hücrenin DEM ortalaması (m, NaN olabilir).
    `deniz_dahil=False` iken rakımı <= 0 olan noktalar kullanılmaz.
    """
    if deniz_dahil:
        kullanilan = np.ones(len(nokta_rakim), dtype=bool)
    else:
        kullanilan = nokta_rakim > 0  # NaN rakım karşılaştırmada False verir
    if not kullanilan.any():
        raise ValueError("IDW için kullanılabilir nokta yok; hepsi deniz üzerinde olabilir.")

    agirlik = idw_agirliklari(hucre_xy, nokta_xy[kullanilan])
    sonuc = {}
    for ad, degerler in olcumler.items():
        veri = np.asarray(degerler, dtype=np.float64)[:, kullanilan]
        if ad == "sicaklik_c":
            veri = veri + SICAKLIK_DUSUS_C_PER_M * nokta_rakim[kullanilan]
            ortalama = idw_ortalama(agirlik, veri) - SICAKLIK_DUSUS_C_PER_M * hucre_rakim
        else:
            ortalama = idw_ortalama(agirlik, veri)
        sonuc[ad] = ortalama.astype(np.float32)
    return sonuc


def _dogrusal_agirlik(
    ince_n: int, kaba_n: int, carpan: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """İnce indeksten kaba indekse doğrusal eşleme: (alt indeks, üst indeks, üst ağırlığı).

    Kaba i. hücrenin merkezi ince ızgarada (i + 0.5) * carpan noktasındadır; ince hücre
    merkezleri bu eksende kaba indeks uzayına taşınır ve kenarda kaba ızgaraya kenetlenir.
    """
    konum = (np.arange(ince_n) + 0.5) / carpan - 0.5
    konum = np.clip(konum, 0, kaba_n - 1)
    alt = np.minimum(np.floor(konum).astype(np.intp), kaba_n - 1)
    ust = np.minimum(alt + 1, kaba_n - 1)
    return alt, ust, (konum - alt).astype(np.float32)


def _epoch(zaman: datetime) -> float:
    """Saniye cinsinden UTC zaman damgası. Saat dilimi yoksa UTC varsayılır."""
    if zaman.tzinfo is None:
        zaman = zaman.replace(tzinfo=UTC)
    return zaman.timestamp()


def _yol(ad: str) -> Path:
    return ISLENMIS_VERI_DIZINI / ad / "hava_alani.npz"


class HavaAlani:
    """Kaba ızgarada saatlik hava alanı; istenen anda ince ızgarada tam çözünürlüklü alan verir."""

    def __init__(
        self,
        ince: Izgara,
        carpan: int,
        saatler: np.ndarray,
        alanlar: dict[str, np.ndarray],
    ) -> None:
        """`saatler`: UTC epoch saniyeleri (artan). `alanlar`: ad -> (saat, kaba_satır, kaba_sütun)."""
        self.ince = ince
        self.carpan = carpan
        self.kaba = kaba_izgara(ince, carpan)
        self.saatler = np.asarray(saatler, dtype=np.float64)
        if self.saatler.ndim != 1 or len(self.saatler) == 0 or np.any(np.diff(self.saatler) <= 0):
            raise ValueError("Saatler boş olmamalı ve kesin artan olmalı.")

        sekil = (len(self.saatler), self.kaba.yukseklik, self.kaba.genislik)
        self.alanlar: dict[str, np.ndarray] = {}
        for ad in ALAN_DEGISKENLERI:
            if ad not in alanlar:
                raise ValueError(f"Eksik alan: {ad}")
            veri = np.asarray(alanlar[ad], dtype=np.float32)
            if veri.shape != sekil:
                raise ValueError(f"{ad} şekli {veri.shape}, beklenen {sekil}")
            self.alanlar[ad] = veri

        self._satir = _dogrusal_agirlik(ince.yukseklik, self.kaba.yukseklik, carpan)
        self._sutun = _dogrusal_agirlik(ince.genislik, self.kaba.genislik, carpan)

    def alan(self, zaman_utc: datetime) -> dict[str, np.ndarray]:
        """Verilen andaki alanlar, her biri (ince_satır, ince_sütun) float32.

        Zaman iki komşu saat arasında doğrusal enterpole edilir; aralık dışındaki zamanlar
        ilk ya da son saate kenetlenir.
        """
        k0, k1, oran = self._zaman_agirligi(_epoch(zaman_utc))
        sonuc = {}
        for ad, veri in self.alanlar.items():
            sonuc[ad] = self._ince_yap((1 - oran) * veri[k0] + oran * veri[k1])
        return sonuc

    @property
    def ince_kaba_esleme(self) -> tuple[tuple[np.ndarray, ...], tuple[np.ndarray, ...]]:
        """Bilineer büyütme ağırlıkları: (satır, sütun), her biri (alt indeks, üst indeks, üst ağırlığı).

        Alanı tam çözünürlükte üretmeden hücre hücre sorgulamak isteyen kod (model çekirdeği) içindir.
        """
        return self._satir, self._sutun

    def _zaman_agirligi(self, t: float) -> tuple[int, int, float]:
        s = self.saatler
        k0 = int(np.clip(np.searchsorted(s, t, side="right") - 1, 0, len(s) - 1))
        k1 = min(k0 + 1, len(s) - 1)
        aralik = s[k1] - s[k0]
        oran = 0.0 if aralik == 0 else float(np.clip((t - s[k0]) / aralik, 0.0, 1.0))
        return k0, k1, oran

    def _ince_yap(self, kaba: np.ndarray) -> np.ndarray:
        """Kaba ızgara değerini çift doğrusal (bilineer) yöntemle ince ızgaraya büyütür."""
        satir_alt, satir_ust, satir_oran = self._satir
        sutun_alt, sutun_ust, sutun_oran = self._sutun
        ara = kaba[satir_alt] * (1 - satir_oran)[:, None] + kaba[satir_ust] * satir_oran[:, None]
        return ara[:, sutun_alt] * (1 - sutun_oran) + ara[:, sutun_ust] * sutun_oran

    def kaydet(self, yol: Path) -> None:
        yol.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            yol,
            ad=np.array(self.ince.ad),
            crs=np.array(self.ince.crs),
            ince_sekil=np.array(self.ince.sekil),
            kaba_carpan=np.array(self.carpan),
            kaba_transform=np.array(tuple(self.kaba.transform)[:6], dtype=np.float64),
            saatler=self.saatler.astype(np.int64),
            **self.alanlar,
        )

    @classmethod
    def oku(cls, yol: Path, izgara: Izgara) -> "HavaAlani":
        """`kaydet` ile yazılmış dosyayı okur; dosyanın bu ızgaraya ait olduğunu doğrular."""
        with np.load(yol) as veri:
            if tuple(veri["ince_sekil"]) != izgara.sekil or str(veri["ad"]) != izgara.ad:
                raise ValueError(f"{yol} bu ızgara için üretilmemiş: {izgara.ad}")
            carpan = int(veri["kaba_carpan"])
            kaba = kaba_izgara(izgara, carpan)
            if not np.allclose(veri["kaba_transform"], tuple(kaba.transform)[:6]):
                raise ValueError(f"{yol} kaba ızgara dönüşümü uyuşmuyor")
            alanlar = {ad: veri[ad] for ad in ALAN_DEGISKENLERI}
            saatler = veri["saatler"]
        return cls(izgara, carpan, saatler, alanlar)

    @classmethod
    def yukle(cls, senaryo: Senaryo) -> "HavaAlani":
        return cls.oku(_yol(senaryo.ad), senaryo.izgara)


def _tablodan_diziler(
    izgara: Izgara, hava: pd.DataFrame
) -> tuple[pd.DatetimeIndex, np.ndarray, np.ndarray, dict[str, np.ndarray]]:
    """Hava tablosunu (saat, nokta) matrislerine çevirir.

    Döner: saat dizini, nokta koordinatları (metre), nokta rakımları, ad -> (saat, nokta) değerleri.
    """
    zaman = pd.to_datetime(hava["zaman_utc"], utc=True)
    saat_dizini = pd.DatetimeIndex(zaman.unique()).sort_values()
    noktalar = hava.assign(zaman_utc=zaman).groupby("nokta")[["enlem", "boylam", "rakim"]].first()

    x, y = Transformer.from_crs("EPSG:4326", izgara.crs, always_xy=True).transform(
        noktalar["boylam"].to_numpy(dtype=np.float64), noktalar["enlem"].to_numpy(dtype=np.float64)
    )
    nokta_xy = np.column_stack([x, y])
    nokta_rakim = noktalar["rakim"].to_numpy(dtype=np.float64)

    olcumler = {}
    for ad in ALAN_DEGISKENLERI:
        tablo = hava.assign(zaman_utc=zaman).pivot(index="zaman_utc", columns="nokta", values=ad)
        olcumler[ad] = tablo.reindex(index=saat_dizini, columns=noktalar.index).to_numpy(
            dtype=np.float64
        )
    return saat_dizini, nokta_xy, nokta_rakim, olcumler


def alan_olustur(
    izgara: Izgara,
    arazi_yuksekligi: np.ndarray,
    hava: pd.DataFrame,
    carpan: int = KABA_CARPAN,
    deniz_dahil: bool = False,
) -> HavaAlani:
    """Saatlik hava tablosundan bellekte bir `HavaAlani` üretir (diske yazmaz)."""
    if arazi_yuksekligi.shape != izgara.sekil:
        raise ValueError(f"Yükseklik şekli {arazi_yuksekligi.shape}, ızgara {izgara.sekil}")

    kaba = kaba_izgara(izgara, carpan)
    saat_dizini, nokta_xy, nokta_rakim, olcumler = _tablodan_diziler(izgara, hava)
    saatler = ((saat_dizini - pd.Timestamp(0, tz="UTC")) // pd.Timedelta(seconds=1)).to_numpy(
        np.int64
    )

    hucre_rakim = kaba_ortalama(arazi_yuksekligi, carpan, kaba.sekil).ravel()
    ham = kaba_alan_hesapla(
        nokta_xy, nokta_rakim, olcumler, kaba_hucre_merkezleri(kaba), hucre_rakim, deniz_dahil
    )
    alanlar = {ad: v.reshape(len(saatler), kaba.yukseklik, kaba.genislik) for ad, v in ham.items()}
    return HavaAlani(izgara, carpan, saatler, alanlar)


def hazirla(
    izgara: Izgara,
    arazi_yuksekligi: np.ndarray,
    hava: pd.DataFrame,
    carpan: int = KABA_CARPAN,
    deniz_dahil: bool = False,
) -> Path:
    """Saatlik hava tablosundan `hava_alani.npz` üretir ve yolunu döndürür.

    `arazi_yuksekligi`: ince ızgaranın DEM'i (m, NaN = veri yok). `hava`: hava.csv tablosu.
    """
    yol = _yol(izgara.ad)
    alan_olustur(izgara, arazi_yuksekligi, hava, carpan, deniz_dahil).kaydet(yol)
    return yol


def topluluk_hazirla(
    izgara: Izgara,
    arazi_yuksekligi: np.ndarray,
    hava: pd.DataFrame,
    carpan: int = KABA_CARPAN,
    deniz_dahil: bool = False,
) -> dict[int, HavaAlani]:
    """Topluluk tablosundan (`uye` sütunlu) her üye için ayrı bir `HavaAlani` üretir.

    Kontrol üyesi 0 dahildir. Alanlar bellekte tutulur; üye başına ~50 saat × kaba ızgara
    küçüktür ve diske yazılmaz (senaryo paketinin tekil `hava_alani.npz` dosyası korunur).
    """
    if "uye" not in hava.columns:
        raise ValueError("Topluluk tablosunda 'uye' sütunu yok.")
    return {
        int(uye): alan_olustur(izgara, arazi_yuksekligi, tablo, carpan, deniz_dahil)
        for uye, tablo in hava.groupby("uye", sort=True)
    }
