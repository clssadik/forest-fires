"""Senaryo modu: "şimdi burada yangın çıksa ne olur?"

Haritadan seçilen bir nokta için bölge paketi istek üzerine üretilir: noktanın çevresinde
`YARICAP_KM` yarıçaplı kare ızgara (noktanın UTM diliminde, 30 m), Copernicus DEM, WorldCover
ve Open-Meteo **topluluk tahmini** (her çalıştırma farklı bir üye; erişilemezse tekil tahmin).
FIRMS ve Sentinel-2 gerekmez. Güncel model `CALISMA` tohumla `SURE_SA` saat çalışır.

Sonuç tek bir çizgi değil, olasılıktır: her hücre için çalıştırmaların %10, %50 ve %90'ında
yandığı en erken an (`ESIKLER`). Bir t anında "olasılık ≥ q" alanı, q eşiğinin TOA'sı ≤ t
olan hücrelerdir. Doğrulamada (docs/dogrulama.md) model alanı ve yakıtı iyi, yönü kısmen
biliyor; söndürmeyi yalnızca kaba bir kuralla (yangının büyüme hızına bağlı) taklit ediyor.
Arayüz bunu açıkça yazar.

Çıktılar `data/islenmis/senaryolar/<kimlik>/`: paket katmanları, esik_toa.tif (3 bant, dk)
ve sonuc.json.
"""

import json
import math
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import rasterio

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import DENEYLER, GUNCEL_MODEL
from orman.izgara import Izgara
from orman.model.calistir import tutusma_hucresi
from orman.model.yayilim import Arazi, Ruzgar, coklu_yayilim
from orman.senaryo import Senaryo
from orman.veri import hava as hava_modulu
from orman.veri import hava_alani as hava_alani_modulu
from orman.veri.bolge_paketi import model_girdilerini_olustur, model_girdilerini_yukle
from orman.veri.hava_alani import HavaAlani

YARICAP_KM = 20.0  # ızgara: nokta merkezli 40 × 40 km
COZUNURLUK_M = 30.0
SURE_SA = 48  # 24 saatten sonra sapma büyüyor; daha uzun süre anlamlı değil
CALISMA = 20
ESIKLER = (0.1, 0.5, 0.9)  # olasılık bantları: düşük, orta, yüksek
KIMLIK_HASSASIYETI = 2  # ondalık basamak (~1 km); yakın tıklamalar aynı paketi kullanır
KENAR_PAYI_HUCRE = 33  # ~1 km; olası alan bu kadar kenara yaklaşırsa "sınıra ulaştı"
MODEL_ADI = GUNCEL_MODEL
PARAMETRELER = DENEYLER[GUNCEL_MODEL][1]
TOPLULUK_MODEL = hava_modulu.TOPLULUK_MODEL


def utm_crs(enlem: float, boylam: float) -> str:
    """Noktanın UTM dilimi (kuzey yarımküre 326xx, güney 327xx)."""
    dilim = math.floor((boylam + 180.0) / 6.0) % 60 + 1
    return f"EPSG:{(32600 if enlem >= 0 else 32700) + dilim}"


def kimlik(enlem: float, boylam: float) -> str:
    return f"{enlem:.{KIMLIK_HASSASIYETI}f}_{boylam:.{KIMLIK_HASSASIYETI}f}"


def senaryo_dizini(k: str) -> Path:
    return ISLENMIS_VERI_DIZINI / "senaryolar" / k


def noktadan_senaryo(
    enlem: float, boylam: float, tutusma_utc: datetime, yaricap_km: float = YARICAP_KM
) -> Senaryo:
    """Tutuşma noktası merkezli kare ızgara ve modelin çalışacağı zaman aralığı.

    Izgara kimliğe yuvarlanmış noktaya göre kurulur (arazi önbelleği yakın tıklamalarda
    yeniden kullanılsın); tutuşma tam tıklanan yerdedir.
    """
    k = kimlik(enlem, boylam)
    merkez_enlem, merkez_boylam = (float(v) for v in k.split("_"))
    d_enlem = yaricap_km / 111.32
    d_boylam = yaricap_km / (111.32 * math.cos(math.radians(merkez_enlem)))
    izgara = Izgara.bboxtan(
        f"senaryolar/{k}",
        (
            merkez_boylam - d_boylam,
            merkez_enlem - d_enlem,
            merkez_boylam + d_boylam,
            merkez_enlem + d_enlem,
        ),
        crs=utm_crs(merkez_enlem, merkez_boylam),
        cozunurluk=COZUNURLUK_M,
    )
    bitis = tutusma_utc + timedelta(hours=SURE_SA)
    return Senaryo(
        izgara=izgara,
        baslangic=(tutusma_utc - timedelta(days=1)).date(),
        bitis=(bitis + timedelta(hours=1)).date(),
        tutusma_utc=tutusma_utc,
        tutusma_konumu=(enlem, boylam),
        model_bitis_utc=bitis,
        baslik="Senaryo",
        konum=f"{enlem:.4f} K, {boylam:.4f} D",
    )


def esik_toalari(toalar: np.ndarray, esikler=ESIKLER) -> np.ndarray:
    """Her eşik q için hücrenin çalıştırmaların en az q'sünde yanmış olduğu en erken an.

    `toalar`: (çalıştırma, satır, sütun), NaN = yanmadı. Döner: (eşik, satır, sütun) float32;
    yeterince çalıştırmada yanmayan hücre NaN. q · n tam sayı değilse yukarı yuvarlanır
    (20 çalıştırmada %10 = 2, %50 = 10, %90 = 18 çalıştırma).
    """
    n = toalar.shape[0]
    sonuc = np.full((len(esikler), *toalar.shape[1:]), np.nan, dtype=np.float32)
    yandi = (~np.isnan(toalar)).any(axis=0)
    sirali = np.sort(toalar[:, yandi], axis=0)  # NaN'lar sona dizilir
    for i, q in enumerate(esikler):
        gereken = max(1, math.ceil(q * n - 1e-9))
        sonuc[i, yandi] = sirali[gereken - 1]
    return sonuc


def buyume(esik_toa: np.ndarray, saatler: list[int], hucre_ha: float) -> list[list[float]]:
    """Her eşik için saat saat alan (ha): [eşik][saat]."""
    return [
        [round(float(np.count_nonzero(bant <= s * 60.0)) * hucre_ha, 1) for s in saatler]
        for bant in esik_toa
    ]


def kenara_ulasma_saati(toa: np.ndarray, pay: int = KENAR_PAYI_HUCRE) -> float | None:
    """Yanan alanın ızgara kenarına `pay` hücreden fazla yaklaştığı ilk an (sa); yoksa None."""
    kenar = np.ones(toa.shape, dtype=bool)
    kenar[pay:-pay, pay:-pay] = False
    degerler = toa[kenar]
    degerler = degerler[~np.isnan(degerler)]
    return round(float(degerler.min()) / 60.0, 1) if degerler.size else None


def hava_ozeti(
    alanlar: list[HavaAlani], tutusma_utc: datetime, hucre: tuple[int, int], saatler: list[int]
) -> dict:
    """Tutuşma hücresinde saat saat üyelerin ortalama havası ve rüzgâr yayılımı.

    Mevcut alanlar (ön yüzün okuduğu) üyelerin ortalamasıdır: rüzgâr vektörü (u, v) ayrı ayrı
    ortalanır, yön buradan çıkar (350° ile 10° ortalaması 0° olur); hız, sıcaklık ve nem
    skaler ortalamadır. `*_yayilim` alanları %10–%90 aralığıdır; yön yayılımı ortalama yöne
    göre ±180° sarmalanarak hesaplanır. Tek üye varsa yayılım sıfırdır.
    """
    if not alanlar:
        raise ValueError("Hava özeti için en az bir alan gerekli.")
    u_dizi, v_dizi, hiz_dizi, sicaklik_dizi, nem_dizi = [], [], [], [], []
    yon_dizi = []
    for alan in alanlar:
        r, c = hucre[0] // alan.carpan, hucre[1] // alan.carpan
        zaman = (alan.saatler - tutusma_utc.timestamp()) / 3600.0

        def oku(ad, zaman=zaman, alan=alan, r=r, c=c):
            return np.interp(saatler, zaman, alan.alanlar[ad][:, r, c])

        u, v = oku("ruzgar_u"), oku("ruzgar_v")
        u_dizi.append(u)
        v_dizi.append(v)
        hiz_dizi.append(oku("ruzgar_hizi_ms"))
        sicaklik_dizi.append(oku("sicaklik_c"))
        nem_dizi.append(oku("bagil_nem"))
        yon_dizi.append((np.degrees(np.arctan2(-u, -v)) + 360.0) % 360.0)

    u, v = np.mean(u_dizi, axis=0), np.mean(v_dizi, axis=0)
    yon = (np.degrees(np.arctan2(-u, -v)) + 360.0) % 360.0  # geldiği yön (bkz. hava.ruzgar_uv)
    hiz = np.mean(hiz_dizi, axis=0)
    # Yön yayılımı: ortalama yöne göre fark, 360° çevresinde sarmalanır (350° → -10°).
    fark = (np.array(yon_dizi) - yon + 180.0) % 360.0 - 180.0
    hiz_p10, hiz_p90 = np.percentile(hiz_dizi, [10, 90], axis=0)
    yon_p10, yon_p90 = np.percentile(fark, [10, 90], axis=0)
    return {
        "saatler": saatler,
        "ruzgar_hizi_ms": np.round(hiz, 1).tolist(),
        "ruzgar_yonu": np.round(yon).tolist(),
        "sicaklik_c": np.round(np.mean(sicaklik_dizi, axis=0), 1).tolist(),
        "bagil_nem": np.round(np.mean(nem_dizi, axis=0)).tolist(),
        "ruzgar_hizi_ms_yayilim": {
            "p10": np.round(hiz_p10, 1).tolist(),
            "p90": np.round(hiz_p90, 1).tolist(),
        },
        "ruzgar_yonu_yayilim": {
            "p10": np.round((yon + yon_p10) % 360.0).tolist(),
            "p90": np.round((yon + yon_p90) % 360.0).tolist(),
        },
    }


def uye_secimi(uye_sayisi: int, calisma: int) -> list[int]:
    """Her çalıştırmaya bir üye: üye sayısı azsa döngüyle, çoksa eşit aralıkla seçilir.

    Kontrol üyesi (0) her zaman seçilir. Üye sayısı çalıştırma sayısından fazlaysa
    `np.linspace(0, üye-1, çalışma)` yuvarlanır; böylece 51 üyeden 20'si tüm aralığa yayılır.
    """
    if uye_sayisi <= 0:
        raise ValueError("Üye sayısı pozitif olmalı.")
    if uye_sayisi <= calisma:
        return [i % uye_sayisi for i in range(calisma)]
    return np.rint(np.linspace(0, uye_sayisi - 1, calisma)).astype(int).tolist()


def uye_alanlari(alanlar: dict[int, HavaAlani], calisma: int) -> list[HavaAlani]:
    """Çalıştırma başına hava alanı. Seçim üye numarasına değil sırasına göredir: yanıtta
    eksik üye varsa numaralar atlar (0, 1, 3, ...)."""
    sirali = [alanlar[k] for k in sorted(alanlar)]
    return [sirali[i] for i in uye_secimi(len(sirali), calisma)]


def topluluk_alanlari(
    senaryo: Senaryo, yukseklik: np.ndarray
) -> tuple[dict[int, HavaAlani] | None, str | None]:
    """Topluluk tahminini indirip her üye için hava alanı üretir; hata olursa (None, neden)."""
    try:
        veri = hava_modulu.topluluk_hazirla(senaryo.izgara, senaryo.baslangic, senaryo.bitis)
        alanlar = hava_alani_modulu.topluluk_hazirla(senaryo.izgara, yukseklik, veri["tablo"])
        if not alanlar:
            raise ValueError("Topluluk yanıtında kullanılabilir üye yok.")
        return alanlar, None
    except Exception as e:  # noqa: BLE001 - topluluk isteğe bağlı; her hatada tekil tahmine düşülür
        return None, f"{type(e).__name__}: {e}"


@dataclass
class SenaryoSonucu:
    senaryo: Senaryo
    esik_toa: np.ndarray  # (eşik, satır, sütun), dk, NaN = o olasılıkla yanmadı
    ozet: dict


def simdiki_saat() -> datetime:
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0)


def calistir(
    enlem: float,
    boylam: float,
    tutusma_utc: datetime | None = None,
    calisma: int = CALISMA,
    topluluk: bool = True,
    is_parcacigi: int | None = None,
) -> SenaryoSonucu:
    """Paketi hazırlar (önbellekli arazi + güncel tahmin), modeli çalıştırır, sonucu yazar.

    `topluluk=True` (varsayılan): her çalıştırma farklı bir topluluk üyesinin havasıyla koşar.
    Topluluk indirilemezse tekil tahmine düşülür ve `sonuc.json` içindeki `hava_kaynagi`
    bunu bildirir ("topluluk:<model>:<üye sayısı>" ya da "tahmin").

    Tutuşma noktası yanmaz bir hücredeyse (deniz, şehir, kaya) ve çevresinde yanabilir
    bitki yoksa `ValueError` yükselir.
    """
    tutusma_utc = tutusma_utc or simdiki_saat()
    senaryo = noktadan_senaryo(enlem, boylam, tutusma_utc)
    sureler = {}

    bas = time.perf_counter()
    model_girdilerini_olustur(senaryo, canli=True)
    paket = model_girdilerini_yukle(senaryo)
    sureler["veri_sn"] = round(time.perf_counter() - bas, 1)

    alanlar, topluluk_hatasi = (None, None)
    if topluluk:
        bas = time.perf_counter()
        alanlar, topluluk_hatasi = topluluk_alanlari(senaryo, paket.yukseklik)
        sureler["topluluk_sn"] = round(time.perf_counter() - bas, 1)

    hucre = tutusma_hucresi(paket)
    if alanlar:
        # Üye sayısı çalıştırmadan fazlaysa eşit aralıklı seçilir; tohum i → i. üye.
        hava_alanlari = uye_alanlari(alanlar, calisma)
        hava_kaynagi = f"topluluk:{TOPLULUK_MODEL}:{len(alanlar)}"
        ozet_alanlari = list(alanlar.values())
    else:
        hava_alanlari = [paket.hava_alani()]
        hava_kaynagi = "tahmin"
        ozet_alanlari = hava_alanlari

    bas = time.perf_counter()
    sonuc = coklu_yayilim(
        Arazi.paketten(paket),
        [Ruzgar.hava_alanindan(alan, tutusma_utc) for alan in hava_alanlari],
        [hucre],
        PARAMETRELER,
        range(calisma),
        SURE_SA * 60.0,
        is_parcacigi=is_parcacigi,
    )
    esik_toa = esik_toalari(sonuc.toalar)
    sureler["model_sn"] = round(time.perf_counter() - bas, 1)

    izgara = senaryo.izgara
    hucre_ha = izgara.cozunurluk**2 / 10_000
    saatler = list(range(SURE_SA + 1))
    yakit = paket.yakit[paket.gecerli]
    ozet = {
        "kimlik": kimlik(enlem, boylam),
        "model": MODEL_ADI,
        "calisma_sayisi": calisma,
        "tutusma_utc": tutusma_utc.isoformat(),
        "bitis_utc": senaryo.model_bitis_utc.isoformat(),
        "tutusma_konumu": {"enlem": enlem, "boylam": boylam},
        "olusturma_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        "sureler": sureler,
        "esikler": list(ESIKLER),
        "saatler": saatler,
        "buyume_ha": buyume(esik_toa, saatler, hucre_ha),
        "kenar_saat": kenara_ulasma_saati(esik_toa[0]),
        "hava_kaynagi": hava_kaynagi,
        "hava": hava_ozeti(ozet_alanlari, tutusma_utc, hucre, saatler),
        "tutusma_yakiti": int(paket.yakit[hucre]),
        "yakit_payi": {
            str(k): round(float(np.mean(yakit == k)), 3) for k in range(5)
        },  # ızgaradaki pay
    }
    if topluluk_hatasi:
        ozet["hava_topluluk_hatasi"] = topluluk_hatasi
    d = senaryo_dizini(ozet["kimlik"])
    profil = izgara.rasterio_profili("float32", np.nan) | {"count": len(ESIKLER)}
    with rasterio.open(d / "esik_toa.tif", "w", **profil) as ds:
        ds.write(esik_toa)
    (d / "sonuc.json").write_text(json.dumps(ozet, ensure_ascii=False, indent=2))
    return SenaryoSonucu(senaryo, esik_toa, ozet)
