"""Olay (3B analiz) ekranının verisi: kaba ızgarada arazi, yakıt, model ve gerçek rasterlar,
saatlik seriler ve otomatik bulunan olaylar.

Tarayıcı 3B sahneyi bu paketten kurar. Model ızgarası (30 m, ~3 milyon hücre) bir örgü için
fazla büyük; rasterlar `k × k` bloklara indirilir (en uzun kenar ≤ `EN_FAZLA_HUCRE`). Sahne
koordinatı km'dir: +x doğu, +z güney (sahnede kuzey −z), orijin kaba ızgaranın ortası.

Seriler ve olaylar tam çözünürlüklü rasterlardan hesaplanır, kaba olanlardan değil.

Olay türleri:
    tutusma       senaryonun tutuşma anı ve noktası
    uyduGecisi    FIRMS geçiş kümeleri (kalibrasyondaki tanım); o ana kadar FIRMS'in ve modelin
                  gördüğü alan
    hizliBuyume   modelin saatlik büyümesindeki belirgin tepeler
    sirtaUlasma   model yangınının büyük bir sırta (çevresinden belirgin yüksek bölge) ilk varışı
"""

from collections import deque
from dataclasses import dataclass
from datetime import timedelta

import numpy as np
from pyproj import Transformer

from orman.dogrulama.kalibrasyon import gecis_anlari
from orman.dogrulama.olcutler import buyume_egrisi
from orman.model.nem import denge_nemi

EN_FAZLA_HUCRE = 400  # kaba ızgaranın en uzun kenarı (hücre)
# Basitleştirilmiş örtü sınıfı (sahne rengi ve ağaçlar için); WorldCover kodundan.
ORTU_SINIFLARI = {0: "diger", 1: "orman", 2: "maki", 3: "ot", 4: "tarim", 5: "su", 6: "yerlesim"}
_WORLDCOVER_ORTU = {10: 1, 20: 2, 30: 3, 40: 4, 50: 6, 80: 5, 90: 3, 95: 2, 100: 3}
PROFIL_NOKTASI = 160
# Sırt: hücre, çevresindeki ~2 km'lik pencerenin ortalamasından bu kadar yüksekse.
SIRT_PENCERE_M = 2000.0
SIRT_ESIK_M = 80.0
SIRT_EN_AZ_HA = 50.0
SIRT_OLAY_SAYISI = 2
HIZLI_BUYUME_SAYISI = 3
HIZLI_BUYUME_ARALIK_SAAT = 6


@dataclass
class OlayPaketi:
    bilgi: dict  # JSON'a çevrilebilir: ızgara, seriler, eksen profili, olaylar
    bantlar: dict[str, np.ndarray]  # hepsi (kaba_satır, kaba_sütun)


def kaba_carpan(sekil: tuple[int, int], en_fazla: int = EN_FAZLA_HUCRE) -> int:
    return max(1, int(np.ceil(max(sekil) / en_fazla)))


def _bloklar(a: np.ndarray, k: int) -> np.ndarray:
    """(satır, sütun) → (kaba_satır, kaba_sütun, k*k); artan kenar kırpılır."""
    s, c = a.shape[0] // k, a.shape[1] // k
    return a[: s * k, : c * k].reshape(s, k, c, k).swapaxes(1, 2).reshape(s, c, k * k)


def kaba_ortalama(a: np.ndarray, k: int) -> np.ndarray:
    """Blok ortalaması; NaN'lar atlanır, tamamı NaN olan blok NaN kalır."""
    b = _bloklar(a.astype(np.float32), k)
    sayi = np.count_nonzero(~np.isnan(b), axis=2)
    toplam = np.nansum(b, axis=2)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(sayi > 0, toplam / sayi, np.nan).astype(np.float32)


def kaba_zaman(toa: np.ndarray, k: int) -> np.ndarray:
    """Bloğun yarısının yandığı an (yanmayan hücre = sonsuz); yarısı yanmadıysa NaN.

    Böylece kaba ızgarada "t anında yanan alan", ince ızgaradakiyle yaklaşık aynı kalır.
    """
    b = _bloklar(np.where(np.isnan(toa), np.inf, toa).astype(np.float64), k)
    ortanca = np.median(b, axis=2)
    return np.where(np.isfinite(ortanca), ortanca, np.nan).astype(np.float32)


def kaba_mod(sinif: np.ndarray, k: int, sinif_sayisi: int) -> np.ndarray:
    """Blokta en sık görülen sınıf (eşitlikte küçük kod)."""
    b = _bloklar(sinif, k)
    sayilar = np.stack([(b == s).sum(axis=2) for s in range(sinif_sayisi)])
    return sayilar.argmax(axis=0).astype(np.uint8)


def ortu_sinifi(worldcover: np.ndarray) -> np.ndarray:
    sonuc = np.zeros(worldcover.shape, dtype=np.uint8)
    for kod, ortu in _WORLDCOVER_ORTU.items():
        sonuc[worldcover == kod] = ortu
    return sonuc


def cephe_mesafesi(
    toa: np.ndarray, merkez: tuple[int, int], hucre_m: float, saatler
) -> list[float]:
    """Her saatte, o ana kadar yanmış hücrelerin tutuşmaya en büyük uzaklığı (m): baş cephe."""
    satir, sutun = np.nonzero(~np.isnan(toa))
    zaman = toa[satir, sutun]
    sira = np.argsort(zaman)
    uzaklik = np.hypot(satir - merkez[0], sutun - merkez[1])[sira] * hucre_m
    birikimli = np.maximum.accumulate(uzaklik) if uzaklik.size else uzaklik
    adet = np.searchsorted(zaman[sira], np.asarray(saatler, dtype=np.float64) * 60.0, "right")
    return [float(birikimli[n - 1]) if n > 0 else 0.0 for n in adet]


def hiz_serisi(mesafe_m: list[float], yumusatma: int = 3) -> list[float]:
    """Saatlik baş cephe mesafesinden yayılma hızı (m/dk), `yumusatma` saatlik hareketli ortalama."""
    fark = np.diff(np.asarray(mesafe_m, dtype=np.float64), prepend=0.0) / 60.0
    cekirdek = np.ones(yumusatma) / yumusatma
    return [float(v) for v in np.convolve(fark, cekirdek, mode="same")]


def hizli_buyume_saatleri(
    alan_ha: list[float],
    adet: int = HIZLI_BUYUME_SAYISI,
    aralik: int = HIZLI_BUYUME_ARALIK_SAAT,
) -> list[tuple[int, float]]:
    """Saatlik büyümenin (ha/sa, 3 saatlik ortalama) en büyük tepeleri: [(saat, ha/sa)].

    Tepeler arasında en az `aralik` saat olur; ortalama büyümenin 1,5 katını geçmeyenler atlanır.
    """
    buyume = np.diff(np.asarray(alan_ha, dtype=np.float64))
    if buyume.size == 0:
        return []
    yumusak = np.round(np.convolve(buyume, np.ones(3) / 3, mode="same"), 6)  # eşitlik için
    esik = 1.5 * yumusak[yumusak > 0].mean() if (yumusak > 0).any() else np.inf
    secilen: list[tuple[int, float]] = []
    # Ortalamada eşit olan komşu saatlerden ham büyümesi en büyük olan seçilir.
    for saat in np.lexsort((-buyume, -yumusak)):
        if yumusak[saat] <= esik or len(secilen) == adet:
            break
        if all(abs(int(saat) - s) >= aralik for s, _ in secilen):
            secilen.append((int(saat), float(yumusak[saat])))
    return sorted(secilen)


def kutu_ortalamasi(a: np.ndarray, yaricap: int) -> np.ndarray:
    """(2r+1)² pencerenin ortalaması (kenarda pencere içeride kalan kısımla); integral görüntüyle."""
    dolu = np.nan_to_num(a, nan=0.0).astype(np.float64)
    gecerli = (~np.isnan(a)).astype(np.float64)

    def pencere_toplami(x):
        ii = np.pad(x, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
        s, c = x.shape
        r0 = np.clip(np.arange(s) - yaricap, 0, s)
        r1 = np.clip(np.arange(s) + yaricap + 1, 0, s)
        c0 = np.clip(np.arange(c) - yaricap, 0, c)
        c1 = np.clip(np.arange(c) + yaricap + 1, 0, c)
        return ii[r1][:, c1] - ii[r0][:, c1] - ii[r1][:, c0] + ii[r0][:, c0]

    with np.errstate(invalid="ignore", divide="ignore"):
        return (pencere_toplami(dolu) / pencere_toplami(gecerli)).astype(np.float32)


def bilesenler(maske: np.ndarray) -> list[np.ndarray]:
    """8-komşulu bağlı bileşenler; her biri (n, 2) satır/sütun dizisi."""
    gorulen = np.zeros(maske.shape, dtype=bool)
    sonuc = []
    s, c = maske.shape
    for r0, c0 in zip(*np.nonzero(maske), strict=True):
        if gorulen[r0, c0]:
            continue
        gorulen[r0, c0] = True
        kuyruk, hucreler = deque([(r0, c0)]), []
        while kuyruk:
            r, cc = kuyruk.popleft()
            hucreler.append((r, cc))
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    rr, ck = r + dr, cc + dc
                    if 0 <= rr < s and 0 <= ck < c and maske[rr, ck] and not gorulen[rr, ck]:
                        gorulen[rr, ck] = True
                        kuyruk.append((rr, ck))
        sonuc.append(np.array(hucreler))
    return sonuc


def sirt_varislari(
    yukseklik: np.ndarray, toa_dk: np.ndarray, hucre_m: float
) -> list[tuple[float, tuple[int, int], float]]:
    """Modelin büyük sırtlara ilk varışları: [(dakika, (satır, sütun), sırtın en yüksek noktası m)].

    Sırt, çevresinin (~`SIRT_PENCERE_M`) ortalamasından `SIRT_ESIK_M` yüksek hücrelerin
    en az `SIRT_EN_AZ_HA` büyüklüğündeki bağlı bölgesidir. Tutuşmanın ilk saati atlanır (yangın
    zaten sırtta başlamış olabilir).
    """
    yaricap = max(1, round(SIRT_PENCERE_M / 2 / hucre_m))
    tpi = yukseklik - kutu_ortalamasi(yukseklik, yaricap)
    en_az_hucre = SIRT_EN_AZ_HA * 1e4 / hucre_m**2
    varislar = []
    for b in bilesenler(np.nan_to_num(tpi, nan=0.0) > SIRT_ESIK_M):
        if len(b) < en_az_hucre:
            continue
        zaman = toa_dk[b[:, 0], b[:, 1]]
        if np.isnan(zaman).all() or np.nanmin(zaman) < 60.0:
            continue
        i = int(np.nanargmin(zaman))
        tepe = float(np.nanmax(yukseklik[b[:, 0], b[:, 1]]))
        varislar.append((float(zaman[i]), (int(b[i, 0]), int(b[i, 1])), tepe))
    return sorted(varislar)[:SIRT_OLAY_SAYISI]


def nokta_serisi(alan, satir: int, sutun: int, ad: str) -> np.ndarray:
    """Hava alanının bir ince hücredeki saatlik serisi (kaba ızgaradan bilineer)."""
    satir_esleme, sutun_esleme = alan.ince_kaba_esleme
    r0, r1, wr = (e[satir] for e in satir_esleme)
    c0, c1, wc = (e[sutun] for e in sutun_esleme)
    v = alan.alanlar[ad]
    ust = v[:, r0, c0] * (1 - wc) + v[:, r0, c1] * wc
    alt = v[:, r1, c0] * (1 - wc) + v[:, r1, c1] * wc
    return ust * (1 - wr) + alt * wr


def hava_serisi(alan, tutusma, merkez: tuple[int, int], saatler) -> dict[str, list[float]]:
    """Tutuşma hücresinde saatlik hava (ızgara Open-Meteo/ERA5 ~25 km; bölge içinde değişim az)."""
    hedef = np.array([(tutusma + timedelta(hours=h)).timestamp() for h in saatler])
    oku = lambda ad: np.interp(hedef, alan.saatler, nokta_serisi(alan, *merkez, ad))
    u, v = oku("ruzgar_u"), oku("ruzgar_v")
    sicaklik, nem = oku("sicaklik_c"), oku("bagil_nem")
    yuvarla = lambda x, n=1: [round(float(d), n) for d in x]
    return {
        "ruzgar_kmsa": yuvarla(oku("ruzgar_hizi_ms") * 3.6),
        "ruzgar_yon": yuvarla((np.degrees(np.arctan2(-u, -v)) + 360) % 360, 0),
        "sicaklik_c": yuvarla(sicaklik),
        "bagil_nem": yuvarla(nem, 0),
        "yakit_nemi": yuvarla(denge_nemi(sicaklik, nem) * 100),
    }


def olay_paketi(ortam, toa: np.ndarray, olasilik: np.ndarray, ozet: dict) -> OlayPaketi:
    """`ortam`: `DeneyOrtami`; `toa`, `olasilik`: güncel modelin topluluk TOA'sı (dk) ve yanma oranı."""
    paket, referans = ortam.paket, ortam.referans
    senaryo = paket.senaryo
    izgara = senaryo.izgara
    hucre_m = izgara.cozunurluk
    k = kaba_carpan(izgara.sekil)
    kaba_m = hucre_m * k
    toa = np.where(referans.kapsam, toa, np.nan)

    yukseklik = kaba_ortalama(paket.yukseklik, k)
    kaba_toa = kaba_zaman(toa, k)
    bantlar = {
        "yukseklik": np.nan_to_num(yukseklik, nan=0.0),
        "ortu": kaba_mod(ortu_sinifi(paket.arazi_ortusu), k, len(ORTU_SINIFLARI)),
        "model_toa": kaba_toa,
        "olasilik": np.nan_to_num(kaba_ortalama(olasilik, k), nan=0.0),
        "gercek": kaba_ortalama(referans.gercek.astype(np.float32), k),
        "firms_toa": kaba_zaman(referans.firms_toa, k),
    }
    satir_n, sutun_n = bantlar["yukseklik"].shape
    genislik_km, yukseklik_km = sutun_n * kaba_m / 1000, satir_n * kaba_m / 1000

    def sahne(satir: float, sutun: float, carpan: int) -> dict[str, float]:
        """Hücre merkezinin sahne konumu (km); `carpan`: 1 = ince, k = kaba indeks."""
        return {
            "x": round((sutun + 0.5) * hucre_m * carpan / 1000 - genislik_km / 2, 3),
            "z": round((satir + 0.5) * hucre_m * carpan / 1000 - yukseklik_km / 2, 3),
        }

    # Kaba ızgaranın dört köşesi (WGS84): sol üst, sağ üst, sağ alt, sol alt.
    x0, y0 = izgara.transform.c, izgara.transform.f
    x1, y1 = x0 + sutun_n * kaba_m, y0 - satir_n * kaba_m
    geri = Transformer.from_crs(izgara.crs, "EPSG:4326", always_xy=True)
    lon, lat = geri.transform([x0, x1, x1, x0], [y0, y0, y1, y1])

    bitis_saat = referans.bitis_dk / 60.0
    saatler = list(range(int(np.ceil(bitis_saat)) + 1))
    model_ha = buyume_egrisi(toa, referans.kapsam, saatler, referans.hucre_ha)
    firms_ha = buyume_egrisi(referans.firms_toa, referans.kapsam, saatler, referans.hucre_ha)
    cephe = cephe_mesafesi(toa, ortam.tutusma, hucre_m, saatler)

    olaylar = [{"tur": "tutusma", "saat": 0.0, **sahne(*ortam.tutusma, 1)}]
    onceki = -np.inf
    for an in gecis_anlari(referans.firms_toa, referans.kapsam, en_az_oran=0.0):
        hucreler = np.nonzero((referans.firms_toa > onceki) & (referans.firms_toa <= an))
        onceki = an
        if hucreler[0].size == 0:
            continue
        saat = float(an) / 60.0
        gorulen = buyume_egrisi(referans.firms_toa, referans.kapsam, [saat], referans.hucre_ha)
        modelde = buyume_egrisi(toa, referans.kapsam, [saat], referans.hucre_ha)
        olaylar.append(
            {
                "tur": "uyduGecisi",
                "saat": round(saat, 2),
                **sahne(hucreler[0].mean(), hucreler[1].mean(), 1),
                "firms_ha": round(gorulen[0]),
                "model_ha": round(modelde[0]),
            }
        )
    for saat, ha_sa in hizli_buyume_saatleri(model_ha):
        hucreler = np.nonzero((toa > saat * 60.0) & (toa <= (saat + 1) * 60.0))
        if hucreler[0].size == 0:
            continue
        olaylar.append(
            {
                "tur": "hizliBuyume",
                "saat": float(saat),
                **sahne(hucreler[0].mean(), hucreler[1].mean(), 1),
                "ha_sa": round(ha_sa),
            }
        )
    for dakika, (satir, sutun), tepe in sirt_varislari(yukseklik, kaba_toa, kaba_m):
        olaylar.append(
            {
                "tur": "sirtaUlasma",
                "saat": round(dakika / 60.0, 2),
                **sahne(satir, sutun, k),
                "yukseklik_m": round(tepe),
            }
        )
    olaylar.sort(key=lambda o: o["saat"])

    # Ana yayılım ekseni: tutuşmadan, model alanı gerçek alana ulaştığında en uzakta yanmış
    # hücreye. Model durmayı bilmediği için bitişteki en uzak hücre bölgenin kenarıdır.
    esit_saat = next(
        (h for h, a in zip(saatler, model_ha, strict=True) if a >= referans.gercek_ha), saatler[-1]
    )
    satirlar, sutunlar = np.nonzero(kaba_toa <= esit_saat * 60.0)
    tr, tc = ortam.tutusma[0] / k, ortam.tutusma[1] / k
    eksen = None
    if satirlar.size:
        i = int(np.argmax(np.hypot(satirlar - tr, sutunlar - tc)))
        oran = np.linspace(0, 1, PROFIL_NOKTASI + 1)
        rs = np.clip(np.round(tr + (satirlar[i] - tr) * oran).astype(int), 0, satir_n - 1)
        cs = np.clip(np.round(tc + (sutunlar[i] - tc) * oran).astype(int), 0, sutun_n - 1)
        uzunluk_km = float(np.hypot(satirlar[i] - tr, sutunlar[i] - tc)) * kaba_m / 1000
        eksen = {
            "bas": sahne(tr - 0.5, tc - 0.5, k),
            "son": sahne(satirlar[i], sutunlar[i], k),
            "uzunluk_km": round(uzunluk_km, 2),
            "saat": esit_saat,
            "yukseklik_m": [round(float(h)) for h in bantlar["yukseklik"][rs, cs]],
            "toa_saat": [
                None if np.isnan(t) else round(float(t) / 60.0, 2) for t in kaba_toa[rs, cs]
            ],
        }

    bilgi = {
        "ad": senaryo.ad,
        "baslik": senaryo.baslik or senaryo.ad,
        "konum": senaryo.konum,
        "tutusma_utc": senaryo.tutusma_utc.isoformat(),
        "bitis_utc": senaryo.model_bitis_utc.isoformat(),
        "gercek_ha": round(referans.gercek_ha),
        "model": ozet,
        "izgara": {
            "satir": satir_n,
            "sutun": sutun_n,
            "hucre_m": kaba_m,
            "genislik_km": genislik_km,
            "yukseklik_km": yukseklik_km,
            "koseler": [[round(a, 6), round(b, 6)] for a, b in zip(lon, lat, strict=True)],
        },
        "ortu_siniflari": ORTU_SINIFLARI,
        "tutusma": sahne(*ortam.tutusma, 1),
        "seriler": {
            "saatler": saatler,
            "model_ha": [round(a, 1) for a in model_ha],
            "firms_ha": [round(a, 1) for a in firms_ha],
            "cephe_m": [round(m) for m in cephe],
            "hiz_m_dk": [round(v, 2) for v in hiz_serisi(cephe)],
            **hava_serisi(paket.hava_alani(), senaryo.tutusma_utc, ortam.tutusma, saatler),
        },
        "eksen": eksen,
        "olaylar": olaylar,
    }
    return OlayPaketi(bilgi, bantlar)
