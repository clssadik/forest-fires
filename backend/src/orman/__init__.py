"""Orman yangını yayılım modelleme sistemi: arka uç paketi."""

__version__ = "0.1.0"


def main() -> None:
    """Geliştirme sunucusunu başlatır (`uv run orman`)."""
    import uvicorn

    uvicorn.run("orman.api:app", host="127.0.0.1", port=8000, reload=True)
