from fastapi.testclient import TestClient

from orman.api import app

client = TestClient(app)


def test_saglik():
    yanit = client.get("/api/saglik")
    assert yanit.status_code == 200
    assert yanit.json()["durum"] == "ok"
