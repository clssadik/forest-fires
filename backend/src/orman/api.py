"""HTTP API. Ön yüz bu uç noktalardan veri ve simülasyon sonuçlarını alır."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from orman import __version__

app = FastAPI(title="Orman Yangını Yayılım API", version=__version__)

# Vite geliştirme sunucusu (localhost:5173) için.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/saglik")
def saglik() -> dict[str, str]:
    """Sunucunun ayakta olduğunu doğrular."""
    return {"durum": "ok", "surum": __version__}
