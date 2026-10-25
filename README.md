# Orman Yangını Yayılım Modelleme

Uydu tabanlı aktif yangın gözlemleri ile meteorolojik ve topoğrafik veri füzyonuna dayalı, hücresel otomat temelli orman yangını yayılım modellemesi, 3B coğrafi görselleştirme ve çoklu İHA keşif rotası optimizasyonu.
Mersin Üniversitesi Bilgisayar Mühendisliği bitirme projesi.

- Plan ve ilerleme: [docs/05-yol-haritasi.md](docs/05-yol-haritasi.md)
- Tüm dokümanlar: [docs/README.md](docs/README.md)

## Klasörler

| Klasör | İçerik |
|---|---|
| `backend/` | Python: veri hazırlama, simülasyon, doğrulama, FastAPI |
| `frontend/` | React + TypeScript + Vite; 3B sahne (React Three Fiber), 2D harita (MapLibre) |
| `data/` | İndirilen ham veri ve üretilen bölge paketleri (git'e girmez) |
| `notebooks/` | Keşif ve deney defterleri |
| `docs/` | Dokümantasyon ve referans görseller |

## Çalıştırma

Gereksinimler: [uv](https://docs.astral.sh/uv/) (Python 3.12'yi kendisi kurar) ve Node.js 20+.

İki ayrı terminalde:

```bash
uv --directory backend run orman
```

```bash
npm --prefix frontend install && npm --prefix frontend run dev
```

Ardından http://localhost:5173 adresini açın. Sağ üstte "Sunucu bağlı" görünmeli. Ön yüz `/api` isteklerini arka uca (127.0.0.1:8000) yönlendirir.

## Testler

```bash
uv --directory backend run pytest
```

```bash
npm --prefix frontend test
```
