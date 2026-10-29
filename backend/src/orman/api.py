"""HTTP API. Ön yüz bu uç noktalardan veri ve simülasyon sonuçlarını alır.

Yaklaşım "önce hesapla, sonra oynat": simülasyon istek üzerine Python'da baştan sona çalışır
(~5 sn), sonuç diske yazılır; tarayıcı varış zamanı (TOA) rasterını bir kez indirip zaman
kaydırıcısıyla kendisi oynatır. Adım adım akış (WebSocket) gerekmez.

Uç noktalar (`{ad}` = senaryo adı, ör. `manavgat_2021`):
    GET  /api/yanginlar                      senaryo listesi
    GET  /api/yanginlar/{ad}                 bölge bilgisi, harita köşeleri, baseline ölçütleri
    GET  /api/yanginlar/{ad}/altlik.png      gölgeli arazi + bitki örtüsü altlığı
    GET  /api/yanginlar/{ad}/gercek_alan     gerçek yanmış alan sınırı (GeoJSON)
    GET  /api/yanginlar/{ad}/firms           FIRMS tespitleri (GeoJSON)
    GET  /api/yanginlar/{ad}/raster/{katman} model_toa | firms_varis (uint16 dk) | gercek (uint8)
    GET  /api/yanginlar/{ad}/sonuc           son simülasyonun ölçütleri
    POST /api/yanginlar/{ad}/simulasyon      modeli çalıştırır, ölçütleri döndürür

Olay ekranı (3B; `olay.py`; simülasyon yoksa ilk istekte çalıştırılır):
    GET  /api/yanginlar/{ad}/olay            kaba ızgara, saatlik seriler, eksen profili, olaylar
    GET  /api/yanginlar/{ad}/olay/{bant}     yukseklik (float32 m) | ortu | gercek | olasilik
                                             (uint8; son ikisi 0–255 oran) | model_toa | firms_toa
                                             (uint16 dk)

Senaryo modu ("şimdi burada yangın çıksa?", `senaryo_modu.py`; `{kimlik}` yanıttan gelir):
    POST /api/senaryo?enlem=..&boylam=..     paketi hazırlar, modeli çalıştırır, özeti döndürür
    GET  /api/senaryo/{kimlik}/raster        %10/%50/%90 olasılığa ulaşma anı (3 × uint16 dk)
    GET  /api/senaryo/{kimlik}/altlik.png    gölgeli arazi + bitki örtüsü altlığı
"""

import json
import threading
import time
from dataclasses import asdict
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response

from orman import __version__, gosterim, olay, senaryo_modu
from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import (
    BUYUME_SAATLERI,
    DENEYLER,
    GUNCEL_MODEL,
    DeneyOrtami,
    model_deneyi,
)
from orman.dogrulama.olcutler import buyume_egrisi
from orman.model.calistir import yaz_raster
from orman.senaryo import Senaryo
from orman.veri.bolge_paketi import SENARYOLAR, model_girdilerini_yukle

app = FastAPI(title="Orman Yangını Yayılım API", version=__version__)

# Vite geliştirme sunucusu (localhost:5173) için.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
# Zaman rasterları büyük ama çoğu "YOK"; sıkıştırma boyutu ~10 kat küçültür.
app.add_middleware(GZipMiddleware, minimum_size=1000)

RASTER_KATMANLARI = ("model_toa", "firms_varis", "gercek")
OLAY_BANTLARI = ("yukseklik", "ortu", "gercek", "olasilik", "model_toa", "firms_toa")
EN_FAZLA_CALISMA = 50
_simulasyon_kilidi = threading.Lock()


def _web_dizini(ad: str) -> Path:
    """Simülasyon sonuçlarının yazıldığı yer (`data/islenmis/<ad>/web/`)."""
    return ISLENMIS_VERI_DIZINI / ad / "web"


def _senaryo(ad: str) -> Senaryo:
    if ad not in SENARYOLAR:
        raise HTTPException(404, f"Bilinmeyen yangın: {ad}")
    if not (ISLENMIS_VERI_DIZINI / ad / "yanmis_alan.tif").exists():
        raise HTTPException(
            409, f"Bölge paketi yok. Önce: uv --directory backend run orman-veri {ad}"
        )
    return SENARYOLAR[ad]


@lru_cache(maxsize=2)
def _ortam(ad: str) -> DeneyOrtami:
    """Paket, referans, arazi, rüzgâr; ilk istekte bir kez yüklenir (birkaç saniye)."""
    return DeneyOrtami.hazirla(SENARYOLAR[ad])


@lru_cache(maxsize=2)
def _harita(ad: str):
    return gosterim.harita_izgarasi(SENARYOLAR[ad].izgara)


@lru_cache(maxsize=8)
def _raster_baytlari(ad: str, katman: str, surum: float) -> bytes:
    """Harita ızgarasına yansıtılmış raster; `surum` (dosya zamanı) değişince önbellek yenilenir."""
    izgara, harita = SENARYOLAR[ad].izgara, _harita(ad)
    if katman == "gercek":
        gercek = _ortam(ad).referans.gercek.astype(np.uint8)
        return gosterim.haritaya_yansit(gercek, izgara, harita, 0).tobytes()
    if katman == "firms_varis":
        dakika = _ortam(ad).referans.firms_toa
    else:
        with rasterio.open(_web_dizini(ad) / "model_toa.tif") as ds:
            dakika = ds.read(1)
    yansitilmis = gosterim.haritaya_yansit(dakika.astype(np.float32), izgara, harita, np.nan)
    return gosterim.dakika_kodla(yansitilmis).tobytes()


def _baseline_ozeti(ad: str) -> dict | None:
    """`orman-dogrula` raporundaki deneylerin özet ölçütleri; rapor yoksa None."""
    yol = ISLENMIS_VERI_DIZINI / ad / "dogrulama" / "rapor.json"
    if not yol.exists():
        return None
    rapor = json.loads(yol.read_text())
    deneyler = []
    for d in rapor["deneyler"]:
        t = d["topluluk"]
        deneyler.append(
            {
                "ad": d["ad"],
                "aciklama": d["aciklama"],
                "esit_alan_iou": t["esit_alan"]["iou"],
                "esit_alan_iou_sapma": d["tohumlar"].get("esit_alan_iou", {}).get("sapma"),
                "bitis_iou": t["bitis"]["iou"] if t["bitis"] else None,
                # Ana ölçüt. Daire gerçek alanla aynı büyüklükte: bitişi eşit alan bakışıdır.
                "bitis_dice": (t["bitis"] or t["esit_alan"])["dice"],
                "bitis_dice_sapma": d["tohumlar"].get("bitis_dice", {}).get("sapma"),
            }
        )
    return {"calisma_sayisi": rapor["calisma_sayisi"], "deneyler": deneyler}


@app.get("/api/saglik")
def saglik() -> dict[str, str]:
    """Sunucunun ayakta olduğunu doğrular."""
    return {"durum": "ok", "surum": __version__}


@app.get("/api/yanginlar")
def yanginlar() -> list[dict]:
    return [
        {
            "ad": ad,
            "baslik": s.baslik or ad,
            "konum": s.konum,
            "tutusma_utc": s.tutusma_utc.isoformat(),
            "bitis_utc": s.model_bitis_utc.isoformat() if s.model_bitis_utc else None,
            "paket_hazir": (ISLENMIS_VERI_DIZINI / ad / "yanmis_alan.tif").exists(),
            "sonuc_var": (_web_dizini(ad) / "sonuc.json").exists(),
        }
        for ad, s in SENARYOLAR.items()
    ]


@app.get("/api/yanginlar/{ad}")
def yangin(ad: str) -> dict:
    senaryo = _senaryo(ad)
    harita = _harita(ad)
    referans = _ortam(ad).referans
    return {
        "ad": ad,
        "baslik": senaryo.baslik or ad,
        "konum": senaryo.konum,
        "tutusma_utc": senaryo.tutusma_utc.isoformat(),
        "bitis_utc": senaryo.model_bitis_utc.isoformat(),
        "tutusma_konumu": {"enlem": senaryo.tutusma_konumu[0], "boylam": senaryo.tutusma_konumu[1]},
        "izgara": {
            "crs": senaryo.izgara.crs,
            "cozunurluk_m": senaryo.izgara.cozunurluk,
            "genislik": senaryo.izgara.genislik,
            "yukseklik": senaryo.izgara.yukseklik,
        },
        "harita": {
            "genislik": harita.genislik,
            "yukseklik": harita.yukseklik,
            "koseler": gosterim.koseler(harita),
            "sinirlar": senaryo.izgara.wgs84_sinirlari(),
        },
        "gercek_ha": round(referans.gercek_ha),
        "tespit_sayisi": len(_ortam(ad).paket.tespitler),
        "baseline": _baseline_ozeti(ad),
    }


@app.get("/api/yanginlar/{ad}/altlik.png")
def altlik(ad: str) -> Response:
    _senaryo(ad)
    return Response(_altlik_png(ad), media_type="image/png")


@lru_cache(maxsize=2)
def _altlik_png(ad: str) -> bytes:
    return gosterim.png(gosterim.altlik_rgba(_ortam(ad).paket, _harita(ad)))


@app.get("/api/yanginlar/{ad}/gercek_alan")
def gercek_alan(ad: str) -> dict:
    _senaryo(ad)
    return _gercek_alan_geojson(ad)


@lru_cache(maxsize=2)
def _gercek_alan_geojson(ad: str) -> dict:
    referans = _ortam(ad).referans
    return gosterim.sinir_geojson(referans.gercek & referans.kapsam, SENARYOLAR[ad].izgara)


@app.get("/api/yanginlar/{ad}/firms")
def firms(ad: str) -> dict:
    senaryo = _senaryo(ad)
    return gosterim.firms_geojson(_ortam(ad).paket.tespitler, senaryo.tutusma_utc)


@app.get("/api/yanginlar/{ad}/raster/{katman}")
def raster(ad: str, katman: str) -> Response:
    """Harita ızgarasında ham dizi (satır sırasıyla, küçük-sonlu). Boyut: `/api/yanginlar/{ad}`."""
    _senaryo(ad)
    if katman not in RASTER_KATMANLARI:
        raise HTTPException(404, f"Bilinmeyen katman: {katman}")
    surum = 0.0
    if katman == "model_toa":
        yol = _web_dizini(ad) / "model_toa.tif"
        if not yol.exists():
            raise HTTPException(404, "Henüz simülasyon çalıştırılmadı.")
        surum = yol.stat().st_mtime
    harita = _harita(ad)
    return Response(
        _raster_baytlari(ad, katman, surum),
        media_type="application/octet-stream",
        headers={
            "X-Veri-Turu": "uint8" if katman == "gercek" else "uint16",
            "X-Genislik": str(harita.genislik),
            "X-Yukseklik": str(harita.yukseklik),
        },
    )


@app.get("/api/yanginlar/{ad}/sonuc")
def sonuc(ad: str) -> dict:
    _senaryo(ad)
    yol = _web_dizini(ad) / "sonuc.json"
    if not yol.exists():
        raise HTTPException(404, "Henüz simülasyon çalıştırılmadı.")
    return json.loads(yol.read_text())


@app.post("/api/yanginlar/{ad}/simulasyon")
def simulasyon(ad: str, calisma: int = Query(20, ge=1, le=EN_FAZLA_CALISMA)) -> dict:
    """Güncel modeli (`GUNCEL_MODEL`) `calisma` tohumla çalıştırır, topluluk TOA'sını ve ölçütleri kaydeder."""
    senaryo = _senaryo(ad)
    if not _simulasyon_kilidi.acquire(blocking=False):
        raise HTTPException(409, "Bir simülasyon zaten çalışıyor.")
    try:
        ortam = _ortam(ad)
        baslangic = time.perf_counter()
        aciklama, parametreler = DENEYLER[GUNCEL_MODEL]
        deney = model_deneyi(ortam, GUNCEL_MODEL, aciklama, parametreler, calisma)
        sure = time.perf_counter() - baslangic
        referans = ortam.referans
        kayit = {
            "senaryo": ad,
            "model": GUNCEL_MODEL,
            "aciklama": deney.aciklama,
            "calisma_sayisi": calisma,
            "parametreler": asdict(parametreler),
            "olusturma_utc": datetime.now(UTC).isoformat(timespec="seconds"),
            "sure_sn": round(sure, 1),
            "olcutler": asdict(deney.topluluk),
            "tohumlar": deney.tohumlar,
            "buyume_saatleri": BUYUME_SAATLERI,
            "buyume_ha": deney.buyume_ha,
            "firms_buyume_ha": buyume_egrisi(
                referans.firms_toa, referans.kapsam, BUYUME_SAATLERI, referans.hucre_ha
            ),
        }
        d = _web_dizini(ad)
        d.mkdir(parents=True, exist_ok=True)
        yaz_raster(d / "model_toa.tif", deney.toa, senaryo)
        yaz_raster(d / "model_olasilik.tif", deney.olasilik, senaryo)
        (d / "sonuc.json").write_text(json.dumps(kayit, ensure_ascii=False, indent=2))
        return kayit
    finally:
        _simulasyon_kilidi.release()


@lru_cache(maxsize=2)
def _olay_paketi(ad: str, surum: float) -> olay.OlayPaketi:
    """`surum`: model_toa.tif zamanı; yeni simülasyondan sonra paket yeniden kurulur."""
    d = _web_dizini(ad)
    with rasterio.open(d / "model_toa.tif") as ds:
        toa = ds.read(1)
    with rasterio.open(d / "model_olasilik.tif") as ds:
        olasilik = ds.read(1)
    kayit = json.loads((d / "sonuc.json").read_text())
    return olay.olay_paketi(_ortam(ad), toa, olasilik, _model_ozeti(kayit, _baseline_ozeti(ad)))


def _model_ozeti(kayit: dict, baseline: dict | None) -> dict:
    """Olay ekranının Analiz sekmesi: son simülasyonun ölçütleri ve `orman-dogrula` deneyleri."""
    olc = kayit["olcutler"]
    deneyler = (baseline or {}).get("deneyler", [])
    daire = next((x for x in deneyler if x["ad"] == "daire"), None)
    alanlar = ("dogru_ha", "yanlis_alarm_ha", "kacirilan_ha", "iou", "dice", "kappa")
    bitis = olc.get("bitis")
    zaman = olc.get("zaman")
    return {
        "ad": kayit["model"],
        "aciklama": kayit["aciklama"],
        "calisma_sayisi": kayit["calisma_sayisi"],
        "esit_alan_iou": olc["esit_alan"]["iou"],
        "esit_alan_iou_sapma": kayit.get("tohumlar", {}).get("esit_alan_iou", {}).get("sapma"),
        "daire_iou": daire["esit_alan_iou"] if daire else None,
        # Ana ölçüt: bitişte Sørensen (yakalama ve isabetin harmonik ortalaması).
        "bitis_dice": bitis["dice"] if bitis else None,
        "bitis_dice_sapma": kayit.get("tohumlar", {}).get("bitis_dice", {}).get("sapma"),
        "daire_dice": daire["bitis_dice"] if daire else None,
        "esit_alan": {a: olc["esit_alan"][a] for a in alanlar},
        # Model alanının gerçek alana eşitlendiği an; ön yüz hata katmanını bununla çizer.
        "esit_alan_esik_dk": olc["esit_alan_esik"],
        "bitis": {a: bitis[a] for a in ("model_ha", "iou", "dice", "isabet", "duyarlilik")}
        if bitis
        else None,
        "zaman": {
            a: zaman[a]
            for a in ("ortanca_saat", "ceyrek_alt_saat", "ceyrek_ust_saat", "oran_12_saat_icinde")
        }
        if zaman
        else None,
        "deneyler": [
            {
                "ad": x["ad"],
                "aciklama": x["aciklama"],
                "iou": x["esit_alan_iou"],
                "dice": x["bitis_dice"],
            }
            for x in deneyler
        ],
    }


def _guncel_olay_paketi(ad: str) -> olay.OlayPaketi:
    _senaryo(ad)
    d = _web_dizini(ad)
    # Olasılık rasterı Adım 7'de eklendi; eski simülasyonlarda yok, o zaman yeniden çalıştırılır.
    if not all((d / f).exists() for f in ("model_toa.tif", "model_olasilik.tif", "sonuc.json")):
        simulasyon(ad, calisma=20)
    return _olay_paketi(ad, (d / "model_toa.tif").stat().st_mtime)


@app.get("/api/yanginlar/{ad}/olay")
def olay_bilgisi(ad: str) -> dict:
    return _guncel_olay_paketi(ad).bilgi


@app.get("/api/yanginlar/{ad}/olay/{bant}")
def olay_bandi(ad: str, bant: str) -> Response:
    """Kaba ızgarada ham dizi (satır sırasıyla, küçük-sonlu). Boyut: `/olay` → `izgara`."""
    if bant not in OLAY_BANTLARI:
        raise HTTPException(404, f"Bilinmeyen bant: {bant}")
    veri = _guncel_olay_paketi(ad).bantlar[bant]
    if bant in ("model_toa", "firms_toa"):
        veri = gosterim.dakika_kodla(veri)
    elif bant in ("gercek", "olasilik"):
        veri = np.round(np.nan_to_num(veri, nan=0.0) * 255).astype(np.uint8)
    elif bant == "yukseklik":
        veri = veri.astype("<f4")
    return Response(
        np.ascontiguousarray(veri).tobytes(),
        media_type="application/octet-stream",
        headers={
            "X-Veri-Turu": str(veri.dtype),
            "X-Genislik": str(veri.shape[1]),
            "X-Yukseklik": str(veri.shape[0]),
        },
    )


def _senaryo_sonucu(kimlik: str) -> tuple[dict, Senaryo]:
    """Kaydedilmiş senaryo özeti ve (özetteki tutuşmadan yeniden kurulan) senaryo."""
    yol = senaryo_modu.senaryo_dizini(kimlik) / "sonuc.json"
    if "/" in kimlik or ".." in kimlik or not yol.exists():
        raise HTTPException(404, f"Bilinmeyen senaryo: {kimlik}")
    ozet = json.loads(yol.read_text())
    konum = ozet["tutusma_konumu"]
    senaryo = senaryo_modu.noktadan_senaryo(
        konum["enlem"], konum["boylam"], datetime.fromisoformat(ozet["tutusma_utc"])
    )
    return ozet, senaryo


@lru_cache(maxsize=4)
def _senaryo_raster(kimlik: str, surum: float) -> bytes:
    _, senaryo = _senaryo_sonucu(kimlik)
    harita = gosterim.harita_izgarasi(senaryo.izgara)
    with rasterio.open(senaryo_modu.senaryo_dizini(kimlik) / "esik_toa.tif") as ds:
        bantlar = ds.read()
    return b"".join(
        gosterim.dakika_kodla(
            gosterim.haritaya_yansit(bant, senaryo.izgara, harita, np.nan)
        ).tobytes()
        for bant in bantlar
    )


@app.post("/api/senaryo")
def senaryo_calistir(
    enlem: float = Query(..., ge=-60, le=70), boylam: float = Query(..., ge=-180, le=180)
) -> dict:
    """Seçilen noktada şimdi (bu saatin başında) tutuşan bir yangını modeller.

    Yeni bir nokta için ~20–40 sn (arazi verisi indirilir), aynı yakın nokta için ~1 sn.
    """
    if not _simulasyon_kilidi.acquire(blocking=False):
        raise HTTPException(409, "Bir simülasyon zaten çalışıyor.")
    try:
        sonuc = senaryo_modu.calistir(enlem, boylam)
    except ValueError as e:  # tutuşma noktasında yanabilir bitki yok
        raise HTTPException(422, str(e)) from e
    except (OSError, RuntimeError) as e:  # veri kaynağına ulaşılamadı
        raise HTTPException(502, f"Veri indirilemedi: {e}") from e
    finally:
        _simulasyon_kilidi.release()
    harita = gosterim.harita_izgarasi(sonuc.senaryo.izgara)
    return sonuc.ozet | {
        "harita": {
            "genislik": harita.genislik,
            "yukseklik": harita.yukseklik,
            "koseler": gosterim.koseler(harita),
            "sinirlar": sonuc.senaryo.izgara.wgs84_sinirlari(),
        }
    }


@app.get("/api/senaryo/{kimlik}/raster")
def senaryo_raster(kimlik: str) -> Response:
    """Harita ızgarasında art arda üç bant (eşik sırasıyla), her biri uint16 küçük-sonlu."""
    _, senaryo = _senaryo_sonucu(kimlik)
    yol = senaryo_modu.senaryo_dizini(kimlik) / "esik_toa.tif"
    harita = gosterim.harita_izgarasi(senaryo.izgara)
    return Response(
        _senaryo_raster(kimlik, yol.stat().st_mtime),
        media_type="application/octet-stream",
        headers={
            "X-Veri-Turu": "uint16",
            "X-Bant-Sayisi": str(len(senaryo_modu.ESIKLER)),
            "X-Genislik": str(harita.genislik),
            "X-Yukseklik": str(harita.yukseklik),
        },
    )


@app.get("/api/senaryo/{kimlik}/altlik.png")
def senaryo_altlik(kimlik: str) -> Response:
    _senaryo_sonucu(kimlik)  # bilinmeyen kimlik → 404
    return Response(_senaryo_altlik(kimlik), media_type="image/png")


@lru_cache(maxsize=4)
def _senaryo_altlik(kimlik: str) -> bytes:
    _, senaryo = _senaryo_sonucu(kimlik)
    paket = model_girdilerini_yukle(senaryo)
    return gosterim.png(gosterim.altlik_rgba(paket, gosterim.harita_izgarasi(senaryo.izgara)))
