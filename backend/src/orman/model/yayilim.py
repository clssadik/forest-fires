"""Hücresel otomat yayılım modeli v1 (rüzgar + eğim), Alexandridis vd. (2008) biçiminde.

Yanan hücre `i`, komşusu `j` için Alexandridis çarpanını hesaplar:

    p = p_h · (1 + p_veg) · (1 + p_den) · p_w · p_s

Adım adım kuralın (her kısa adımda `p` ile orantılı küçük bir olasılıkla dene) adım süresi
sıfıra giderkenki hâli kullanılır: `i`, `j`'yi `hiz_olcegi · p` hızında (1/dk) tutuşturmaya
çalışır, yani bekleme süresi üstel dağılımlıdır ve ortalaması `1 / (hiz_olcegi · p)` dakikadır.
Köşegen komşu √2 kat uzak olduğundan bekleme √2 ile çarpılır. Bekleme `i`'nin yanma süresini
aşarsa `i`, `j`'yi tutuşturamaz. Böylece `p` hem yayılma hızını hem tutuşma şansını belirler:
rüzgar ve yokuş yönünde yangın daha hızlı ilerler.

Çıktı her hücrenin varış zamanıdır (TOA, tutuşmadan bu yana dakika; yanmadıysa NaN).
Hesap olay kuyruğuyla yapılır (en erken aday zaman önce); `i`'nin hızları tutuştuğu andaki
havayla hesaplanır.
"""

import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
from numba import njit

from orman.veri.hava import ruzgar_uv
from orman.veri.hava_alani import HavaAlani

YAKIT_SINIF_SAYISI = 5  # 0 yanmaz, 1 orman, 2 maki, 3 ot, 4 tarım
_KOK2 = math.sqrt(2.0)
# 8 komşu: (satır adımı, sütun adımı); satır güneye doğru artar.
_KOMSU_SATIR = np.array([-1, -1, 0, 1, 1, 1, 0, -1], dtype=np.int64)
_KOMSU_SUTUN = np.array([0, 1, 1, 1, 0, -1, -1, -1], dtype=np.int64)


@dataclass(frozen=True)
class Parametreler:
    p_h: float = 0.58  # temel tutuşma olasılığı
    c1: float = 0.045  # rüzgar hızının genel etkisi (1/(m/s))
    c2: float = 0.131  # rüzgar yönünün etkisi (1/(m/s))
    a: float = 0.078  # eğim etkisi (1/derece)
    hiz_olcegi: float = 0.06  # p = 1 iken tutuşturma hızı (1/dk); zaman ölçeği, kalibre edilecek
    yanma_suresi_dk: float = 120.0  # hücrenin komşularını tutuşturabildiği süre (dk)
    # Yakıt sınıfı kodu -> p_veg / p_den. v1'de hepsi 0: yalnızca yanar / yanmaz ayrımı.
    p_veg: tuple[float, ...] = (0.0,) * YAKIT_SINIF_SAYISI
    p_den: tuple[float, ...] = (0.0,) * YAKIT_SINIF_SAYISI


@dataclass
class Arazi:
    yukseklik: np.ndarray  # m, float32
    yanabilir: np.ndarray  # bool
    yakit: np.ndarray  # yakıt sınıfı kodu, uint8
    cozunurluk: float  # hücre kenarı (m)

    @classmethod
    def paketten(cls, paket) -> "Arazi":
        """`BolgePaketi`'nden; yanmaz ve veri dışı hücreler `yanabilir = False`."""
        return cls(
            yukseklik=np.nan_to_num(paket.yukseklik, nan=0.0).astype(np.float32),
            yanabilir=paket.yanabilir,
            yakit=paket.yakit.astype(np.uint8),
            cozunurluk=paket.senaryo.izgara.cozunurluk,
        )


def _bos_esleme() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    bos = np.zeros(0, dtype=np.intp)
    return bos, bos, np.zeros(0, dtype=np.float32)


@dataclass
class Ruzgar:
    """Zamanla değişen rüzgar alanı, kaba ızgarada; sorgu anında hücreye bilineer indirilir.

    `dakikalar`: tutuşmadan bu yana dakika (artan). `u`, `v`, `hiz`: (zaman, kaba_satır,
    kaba_sütun) m/s; yön u/v'den, hız `hiz`'dan alınır. `satir_esleme` / `sutun_esleme`:
    ince indeksten kaba indekse (alt, üst, üst ağırlığı); boşsa alan uzayda tek değerdir.
    """

    dakikalar: np.ndarray
    u: np.ndarray
    v: np.ndarray
    hiz: np.ndarray
    satir_esleme: tuple[np.ndarray, np.ndarray, np.ndarray] = field(default_factory=_bos_esleme)
    sutun_esleme: tuple[np.ndarray, np.ndarray, np.ndarray] = field(default_factory=_bos_esleme)

    @classmethod
    def sabit(cls, hiz: float, yon: float) -> "Ruzgar":
        """Her yerde ve her an aynı rüzgar. `yon`: geldiği yön (derece, kuzeyden saat yönünde)."""
        u, v = ruzgar_uv(hiz, yon)
        dizi = lambda x: np.full((1, 1, 1), x, dtype=np.float32)
        return cls(np.zeros(1), dizi(u), dizi(v), dizi(hiz))

    @classmethod
    def hava_alanindan(cls, alan: HavaAlani, tutusma_utc: datetime) -> "Ruzgar":
        satir, sutun = alan.ince_kaba_esleme
        return cls(
            dakikalar=(alan.saatler - tutusma_utc.timestamp()) / 60.0,
            u=alan.alanlar["ruzgar_u"],
            v=alan.alanlar["ruzgar_v"],
            hiz=alan.alanlar["ruzgar_hizi_ms"],
            satir_esleme=satir,
            sutun_esleme=sutun,
        )

    def _diziler(self) -> tuple:
        return (
            np.ascontiguousarray(self.dakikalar, dtype=np.float64),
            np.ascontiguousarray(self.u, dtype=np.float32),
            np.ascontiguousarray(self.v, dtype=np.float32),
            np.ascontiguousarray(self.hiz, dtype=np.float32),
            *(np.ascontiguousarray(x) for x in self.satir_esleme),
            *(np.ascontiguousarray(x) for x in self.sutun_esleme),
        )

    def ornekle(self, satir: int, sutun: int, dakika: float) -> tuple[float, float, float]:
        """(u, v, hız) m/s; çekirdeğin kullandığı örneklemenin aynısı (test ve inceleme için)."""
        return _ruzgar_ornekle(satir, sutun, dakika, *self._diziler())


@njit(cache=True, nogil=True)
def _ruzgar_ornekle(r, c, t, dk, U, V, H, sa, su, so, ca, cu, co):
    n = dk.shape[0]
    k0 = np.searchsorted(dk, t, side="right") - 1
    k0 = min(max(k0, 0), n - 1)
    k1 = min(k0 + 1, n - 1)
    w = 0.0
    if k1 != k0:
        w = min(max((t - dk[k0]) / (dk[k1] - dk[k0]), 0.0), 1.0)
    if sa.shape[0] == 0:
        r0 = r1 = c0 = c1 = 0
        wr = wc = 0.0
    else:
        r0, r1, wr = sa[r], su[r], so[r]
        c0, c1, wc = ca[c], cu[c], co[c]
    sonuc = np.empty(3)
    for i, F in enumerate((U, V, H)):
        deger = 0.0
        for k, wk in ((k0, 1.0 - w), (k1, w)):
            ust = F[k, r0, c0] * (1.0 - wc) + F[k, r0, c1] * wc
            alt = F[k, r1, c0] * (1.0 - wc) + F[k, r1, c1] * wc
            deger += wk * (ust * (1.0 - wr) + alt * wr)
        sonuc[i] = deger
    return sonuc[0], sonuc[1], sonuc[2]


@njit(cache=True, nogil=True)
def _rastgele(durum):
    """splitmix64: (0, 1] aralığında sayı; `durum` tek elemanlı uint64 dizisi."""
    durum[0] += np.uint64(0x9E3779B97F4A7C15)
    z = durum[0]
    z = (z ^ (z >> np.uint64(30))) * np.uint64(0xBF58476D1CE4E5B9)
    z = (z ^ (z >> np.uint64(27))) * np.uint64(0x94D049BB133111EB)
    z = z ^ (z >> np.uint64(31))
    return (float(z >> np.uint64(11)) + 1.0) / 9007199254740992.0  # 2**53


@njit(cache=True, nogil=True)
def _kuyruga_ekle(zaman, hucre, n, t, idx):
    if n == zaman.shape[0]:
        yeni_zaman = np.empty(2 * n, dtype=zaman.dtype)
        yeni_hucre = np.empty(2 * n, dtype=hucre.dtype)
        yeni_zaman[:n] = zaman
        yeni_hucre[:n] = hucre
        zaman, hucre = yeni_zaman, yeni_hucre
    i = n
    while i > 0:  # yukarı kaydır (en küçük zaman kökte)
        ebeveyn = (i - 1) >> 1
        if zaman[ebeveyn] <= t:
            break
        zaman[i], hucre[i] = zaman[ebeveyn], hucre[ebeveyn]
        i = ebeveyn
    zaman[i], hucre[i] = t, idx
    return zaman, hucre, n + 1


@njit(cache=True, nogil=True)
def _kuyruktan_al(zaman, hucre, n):
    t, idx = zaman[0], hucre[0]
    n -= 1
    son_t, son_idx = zaman[n], hucre[n]
    i = 0
    while True:  # aşağı kaydır
        cocuk = 2 * i + 1
        if cocuk >= n:
            break
        if cocuk + 1 < n and zaman[cocuk + 1] < zaman[cocuk]:
            cocuk += 1
        if zaman[cocuk] >= son_t:
            break
        zaman[i], hucre[i] = zaman[cocuk], hucre[cocuk]
        i = cocuk
    zaman[i], hucre[i] = son_t, son_idx
    return t, idx, n


@njit(cache=True, nogil=True)
def _yayilim_cekirdegi(
    yukseklik, yanabilir, yakit, cozunurluk, tutusma_satir, tutusma_sutun,
    p_h, c1, c2, a, hiz_olcegi, yanma_suresi, p_veg, p_den, tohum, bitis_dk,
    dk, U, V, H, sa, su, so, ca, cu, co,
):  # fmt: skip
    satir_n, sutun_n = yukseklik.shape
    toa = np.full((satir_n, sutun_n), np.nan, dtype=np.float32)
    en_iyi = np.full(satir_n * sutun_n, np.inf)
    kesin = np.zeros(satir_n * sutun_n, dtype=np.bool_)
    durum = np.array([np.uint64(tohum) * np.uint64(0x2545F4914F6CDD1D)], dtype=np.uint64)
    zaman = np.empty(1 << 16, dtype=np.float64)
    hucre = np.empty(1 << 16, dtype=np.int64)
    n = 0

    for k in range(tutusma_satir.shape[0]):
        idx = tutusma_satir[k] * sutun_n + tutusma_sutun[k]
        en_iyi[idx] = 0.0
        zaman, hucre, n = _kuyruga_ekle(zaman, hucre, n, 0.0, idx)

    while n > 0:
        t, idx, n = _kuyruktan_al(zaman, hucre, n)
        if kesin[idx]:
            continue
        if t > bitis_dk:
            break
        kesin[idx] = True
        r, c = idx // sutun_n, idx % sutun_n
        toa[r, c] = t
        u, v, hiz = _ruzgar_ornekle(r, c, t, dk, U, V, H, sa, su, so, ca, cu, co)
        vektor = math.hypot(u, v)
        z = yukseklik[r, c]
        for j in range(8):
            dr, dc = _KOMSU_SATIR[j], _KOMSU_SUTUN[j]
            rr, cc = r + dr, c + dc
            if rr < 0 or rr >= satir_n or cc < 0 or cc >= sutun_n:
                continue
            hedef = rr * sutun_n + cc
            if kesin[hedef] or not yanabilir[rr, cc]:
                continue
            kosegen = dr != 0 and dc != 0
            uzaklik = _KOK2 if kosegen else 1.0  # hücre biriminde

            # Rüzgar: θ, rüzgarın estiği yön (u doğu, v kuzey) ile i -> j yönü arasındaki açı.
            cos_teta = 1.0
            if vektor > 1e-6:
                cos_teta = (u * dc - v * dr) / (vektor * uzaklik)
            p_w = math.exp(c1 * hiz) * math.exp(c2 * hiz * (cos_teta - 1.0))
            # Eğim: hedef daha yüksekse pozitif açı, yokuş yukarı olasılık artar.
            teta_s = math.degrees(math.atan((yukseklik[rr, cc] - z) / (uzaklik * cozunurluk)))
            p_s = math.exp(a * teta_s)
            sinif = yakit[rr, cc]
            p = p_h * (1.0 + p_veg[sinif]) * (1.0 + p_den[sinif]) * p_w * p_s
            if p <= 0.0:
                continue

            # Bekleme: üstel dağılım, ortalama 1 / (hiz_olcegi · p); köşegende √2 kat.
            bekleme = -math.log(_rastgele(durum)) / (hiz_olcegi * p) * uzaklik
            if bekleme > yanma_suresi:
                continue
            aday = t + bekleme
            if aday < en_iyi[hedef]:
                en_iyi[hedef] = aday
                zaman, hucre, n = _kuyruga_ekle(zaman, hucre, n, aday, hedef)
    return toa


def yayilim(
    arazi: Arazi,
    ruzgar: Ruzgar,
    tutusma: list[tuple[int, int]],
    parametreler: Parametreler,
    tohum: int,
    bitis_dk: float,
) -> np.ndarray:
    """Tek çalıştırma. Döner: TOA (dakika, float32; yanmayan hücreler NaN).

    `tutusma`: tutuşan hücreler (satır, sütun), hepsi `t = 0` anında; yanabilir olmalı.
    """
    satirlar = np.array([s for s, _ in tutusma], dtype=np.int64)
    sutunlar = np.array([c for _, c in tutusma], dtype=np.int64)
    if not arazi.yanabilir[satirlar, sutunlar].all():
        raise ValueError("Tutuşma hücreleri yanabilir olmalı.")
    p = parametreler
    return _yayilim_cekirdegi(
        np.ascontiguousarray(arazi.yukseklik, dtype=np.float32),
        np.ascontiguousarray(arazi.yanabilir, dtype=np.bool_),
        np.ascontiguousarray(arazi.yakit, dtype=np.uint8),
        float(arazi.cozunurluk),
        satirlar,
        sutunlar,
        p.p_h, p.c1, p.c2, p.a, p.hiz_olcegi, p.yanma_suresi_dk,
        np.array(p.p_veg, dtype=np.float64),
        np.array(p.p_den, dtype=np.float64),
        int(tohum),
        float(bitis_dk),
        *ruzgar._diziler(),
    )  # fmt: skip


@dataclass
class CokluSonuc:
    olasilik: np.ndarray  # hücrenin yandığı çalıştırma oranı (0–1), float32
    toa_ortanca: np.ndarray  # yandığı çalıştırmalardaki TOA ortancası (dk); hiç yanmadıysa NaN


def coklu_yayilim(
    arazi: Arazi,
    ruzgar: Ruzgar,
    tutusma: list[tuple[int, int]],
    parametreler: Parametreler,
    tohumlar,
    bitis_dk: float,
    is_parcacigi: int | None = None,
) -> CokluSonuc:
    """Aynı girdilerle farklı tohumlarla birden çok çalıştırma (çekirdek GIL'i bırakır, paralel)."""
    tohumlar = list(tohumlar)
    with ThreadPoolExecutor(is_parcacigi) as havuz:
        sonuclar = list(
            havuz.map(
                lambda t: yayilim(arazi, ruzgar, tutusma, parametreler, t, bitis_dk), tohumlar
            )
        )
    yigin = np.stack(sonuclar)
    olasilik = (~np.isnan(yigin)).mean(axis=0).astype(np.float32)
    ortanca = np.full(yigin.shape[1:], np.nan, dtype=np.float32)
    yandi = olasilik > 0
    ortanca[yandi] = np.nanmedian(yigin[:, yandi], axis=0)
    return CokluSonuc(olasilik=olasilik, toa_ortanca=ortanca)
