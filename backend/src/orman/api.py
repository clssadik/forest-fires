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

from orman import __version__, gosterim
from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import BUYUME_SAATLERI, DENEYLER, V1, DeneyOrtami, model_deneyi
from orman.dogrulama.olcutler import buyume_egrisi
from orman.model.calistir import MODEL_SURUMU, yaz_raster
from orman.senaryo import Senaryo
from orman.veri.bolge_paketi import SENARYOLAR

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
    """Model v1'i `calisma` tohumla çalıştırır, topluluk TOA'sını ve ölçütleri kaydeder."""
    senaryo = _senaryo(ad)
    if not _simulasyon_kilidi.acquire(blocking=False):
        raise HTTPException(409, "Bir simülasyon zaten çalışıyor.")
    try:
        ortam = _ortam(ad)
        baslangic = time.perf_counter()
        deney = model_deneyi(ortam, MODEL_SURUMU, DENEYLER[MODEL_SURUMU][0], V1, calisma)
        sure = time.perf_counter() - baslangic
        referans = ortam.referans
        kayit = {
            "senaryo": ad,
            "model": MODEL_SURUMU,
            "aciklama": deney.aciklama,
            "calisma_sayisi": calisma,
            "parametreler": asdict(V1),
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
        (d / "sonuc.json").write_text(json.dumps(kayit, ensure_ascii=False, indent=2))
        return kayit
    finally:
        _simulasyon_kilidi.release()
