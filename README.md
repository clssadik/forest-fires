# Orman Yangını Yayılım Modelleme

Uydu tabanlı aktif yangın gözlemleri ile meteorolojik ve topoğrafik veri füzyonuna dayalı, hücresel otomat temelli orman yangını yayılım modellemesi, 3B coğrafi görselleştirme ve çoklu İHA keşif rotası optimizasyonu.
Mersin Üniversitesi Bilgisayar Mühendisliği bitirme projesi.

Proje dokümantasyonu (plan, kararlar, referanslar) `docs/` klasöründe yalnızca yerelde tutulur ve bu depoda yer almaz.

## Klasörler

| Klasör | İçerik |
|---|---|
| `backend/` | Python: veri hazırlama, simülasyon, doğrulama, FastAPI |
| `frontend/` | React + TypeScript + Vite; analiz ekranı, 3B sahne (React Three Fiber), 2D harita (MapLibre) |
| `data/` | İndirilen ham veri (`ham/`) ve ortak ızgaraya oturtulmuş katmanlar (`islenmis/`); git'e girmez |
| `notebooks/` | Keşif ve deney defterleri |
| `docs/` | Dokümantasyon ve referans görseller (yalnızca yerelde, git'e girmez) |

## Çalıştırma

Gereksinimler: [uv](https://docs.astral.sh/uv/) (Python 3.12'yi kendisi kurar) ve Node.js 20+.

İki ayrı terminalde:

```bash
uv --directory backend run orman
```

```bash
npm --prefix frontend install && npm --prefix frontend run dev
```

Ardından http://localhost:5173 adresini açın. Ön yüz `/api` isteklerini arka uca (127.0.0.1:8000) yönlendirir; üst bardaki küçük nokta arka uç bağlantısını gösterir.

> Analiz ekranındaki veriler şimdilik **örnek veridir** (`frontend/src/veri/ornekSenaryo.ts`); yayılım modeli tamamlanınca gerçek çıktılarla değiştirilecek.

## Veri

Model girdileri açık verilerden üretilir: Copernicus DEM (yükseklik), ESA WorldCover 2020 (bitki örtüsü), Open-Meteo / ERA5 (saatlik hava), NASA FIRMS (aktif yangın tespitleri).

```bash
cp backend/.env.example backend/.env
```

`backend/.env` içine ücretsiz [FIRMS MAP_KEY](https://firms.modaps.eosdis.nasa.gov/api/map_key/) değerini yazın, sonra:

```bash
uv --directory backend run orman-veri manavgat_2021
```

Çıktılar `data/islenmis/manavgat_2021/` altına yazılır; görsel kontrol için `onizleme/*.png`.

## Testler

```bash
uv --directory backend run pytest
```

```bash
npm --prefix frontend test
```
