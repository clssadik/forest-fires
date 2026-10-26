import numpy as np
import pytest
from fastapi.testclient import TestClient

from orman import api
from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import V3

client = TestClient(api.app)
AD = "manavgat_2021"
# Gerçek veriyle çalışan testler: bölge paketi yoksa (temiz klon) atlanır.
paket_gerekli = pytest.mark.skipif(
    not (ISLENMIS_VERI_DIZINI / AD / "yanmis_alan.tif").exists(),
    reason="Bölge paketi yok (uv run orman-veri manavgat_2021)",
)


def test_saglik():
    yanit = client.get("/api/saglik")
    assert yanit.status_code == 200
    assert yanit.json()["durum"] == "ok"


def test_yangin_listesi():
    yanginlar = client.get("/api/yanginlar").json()
    basliklar = {y["ad"]: y["baslik"] for y in yanginlar}
    assert basliklar == {AD: "Manavgat 2021", "marmaris_2022": "Marmaris 2022"}


def test_bilinmeyen_yangin_404():
    assert client.get("/api/yanginlar/yok_boyle").status_code == 404
    assert client.post("/api/yanginlar/yok_boyle/simulasyon").status_code == 404


@paket_gerekli
def test_yangin_bilgisi_ve_rasterlar():
    bilgi = client.get(f"/api/yanginlar/{AD}").json()
    assert 53_000 < bilgi["gercek_ha"] < 54_000
    genislik, yukseklik = bilgi["harita"]["genislik"], bilgi["harita"]["yukseklik"]
    assert len(bilgi["harita"]["koseler"]) == 4

    gercek = client.get(f"/api/yanginlar/{AD}/raster/gercek")
    assert gercek.headers["x-veri-turu"] == "uint8"
    maske = np.frombuffer(gercek.content, np.uint8)
    assert maske.size == genislik * yukseklik
    # Mercator'a yansıtma alanı korur (hücre yerde ~30 m).
    assert abs(np.count_nonzero(maske) * 0.09 - bilgi["gercek_ha"]) / bilgi["gercek_ha"] < 0.01

    firms = np.frombuffer(client.get(f"/api/yanginlar/{AD}/raster/firms_varis").content, np.uint16)
    assert firms.size == genislik * yukseklik
    assert np.all(maske[firms != api.gosterim.YOK] == 1)  # FIRMS varışı yalnızca gerçek alanda

    assert client.get(f"/api/yanginlar/{AD}/raster/bilinmeyen").status_code == 404


@paket_gerekli
def test_vektorler_ve_altlik():
    sinir = client.get(f"/api/yanginlar/{AD}/gercek_alan").json()
    assert sinir["features"][0]["geometry"]["type"] in ("Polygon", "MultiPolygon")
    firms = client.get(f"/api/yanginlar/{AD}/firms").json()
    assert len(firms["features"]) > 1000
    altlik = client.get(f"/api/yanginlar/{AD}/altlik.png")
    assert altlik.headers["content-type"] == "image/png"


@paket_gerekli
def test_simulasyon_kaydeder_ve_sonucu_verir(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "_web_dizini", lambda ad: tmp_path / ad)
    assert client.get(f"/api/yanginlar/{AD}/sonuc").status_code == 404
    assert client.get(f"/api/yanginlar/{AD}/raster/model_toa").status_code == 404

    kayit = client.post(f"/api/yanginlar/{AD}/simulasyon?calisma=2").json()
    assert kayit["calisma_sayisi"] == 2
    assert kayit["model"] == "model_v3" and kayit["parametreler"]["c1"] == V3.c1
    assert 0 < kayit["olcutler"]["esit_alan"]["iou"] < 1
    assert len(kayit["buyume_ha"]) == len(kayit["buyume_saatleri"])
    assert client.get(f"/api/yanginlar/{AD}/sonuc").json() == kayit

    toa = np.frombuffer(client.get(f"/api/yanginlar/{AD}/raster/model_toa").content, np.uint16)
    yanan = toa[toa != api.gosterim.YOK]
    assert yanan.size > 0 and yanan.max() <= 159 * 60  # model bitişte duruyor


def test_simulasyon_calisma_sinirlari():
    assert client.post(f"/api/yanginlar/{AD}/simulasyon?calisma=0").status_code == 422
    assert client.post(f"/api/yanginlar/{AD}/simulasyon?calisma=500").status_code == 422
