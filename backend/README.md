# Arka uç (Python)

Veri hazırlama, yayılım simülasyonu, doğrulama ve HTTP API.

```bash
uv sync            # bağımlılıkları kur
uv run orman       # API: http://127.0.0.1:8000 (belgeler: /docs)
uv run pytest      # testler
uv run ruff check  # lint
```

## Veri

```bash
cp .env.example .env               # FIRMS_MAP_KEY değerini doldurun
uv run orman-veri manavgat_2021    # bölge paketini üretir
```

Ham indirmeler `data/ham/<senaryo>/`, ortak ızgaraya oturtulmuş katmanlar `data/islenmis/<senaryo>/` altına yazılır (ikisi de git'e girmez). Görsel kontrol için: `data/islenmis/<senaryo>/onizleme/*.png`.
