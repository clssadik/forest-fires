from fastapi.testclient import TestClient

from orman.api import app

istemci = TestClient(app)


def test_bilinmeyen_senaryo_404():
    assert istemci.get("/api/senaryo/99.99_99.99/raster").status_code == 404


def test_kimlikte_yol_gecisi_reddedilir():
    assert istemci.get("/api/senaryo/..%2F..%2Fmanavgat_2021/raster").status_code == 404


def test_gecersiz_koordinat_422():
    assert istemci.post("/api/senaryo?enlem=95&boylam=30").status_code == 422
