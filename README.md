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

Üst bardaki iki sekme:

- **Doğrulama** (2B, gerçek veri): MapLibre haritasında model tahmini, gerçek yanmış alan sınırı ve FIRMS tespitleri; zaman kaydırıcısı, "Simülasyonu çalıştır" düğmesi ve ölçüt paneli. Önce bölge paketi gerekir (aşağıda "Veri"). Doğrudan açmak için: http://localhost:5173/#dogrulama
- **Olay** (3B): FireTrace'ten esinlenen sahne. Buradaki veriler şimdilik **örnek veridir** (`frontend/src/veri/ornekSenaryo.ts`).

## Veri

Model girdileri açık verilerden üretilir: Copernicus DEM (yükseklik), ESA WorldCover 2020 (bitki örtüsü), Open-Meteo / ERA5 (saatlik hava), NASA FIRMS (aktif yangın tespitleri). Doğrulama referansı olan gerçek yanmış alan Sentinel-2 L2A görüntülerinden (dNBR) çıkarılır.

```bash
cp backend/.env.example backend/.env
```

`backend/.env` içine ücretsiz [FIRMS MAP_KEY](https://firms.modaps.eosdis.nasa.gov/api/map_key/) değerini yazın, sonra:

```bash
uv --directory backend run orman-veri manavgat_2021
```

Çıktılar `data/islenmis/manavgat_2021/` altına yazılır; görsel kontrol için `onizleme/*.png`.

## Yayılım modeli

Hücresel otomat (Alexandridis vd. 2008 biçiminde; rüzgâr + eğim). Bölge paketi hazırsa:

```bash
uv --directory backend run orman-model manavgat_2021 --calisma 20
```

Her hücrenin varış zamanını (`toa.tif`, dakika), çoklu çalıştırmada yanma olasılığını
(`olasilik.tif`), bir özet (`ozet.json`) ve önizlemeyi (`onizleme_toa.png`)
`data/islenmis/manavgat_2021/model_v1/` altına yazar. Model v1 henüz kalibre edilmedi.

## Doğrulama

Modeli ve basit baseline'ları (rüzgârsız, eğimsiz, daire) gerçek yanmış alanla ve FIRMS
tespitleriyle karşılaştırır (~30 sn):

```bash
uv --directory backend run orman-dogrula manavgat_2021
```

Sonuç tablosunu ekrana basar. `data/islenmis/manavgat_2021/dogrulama/` altına şunları yazar:
`rapor.json` (IoU, Dice, kappa, karışıklık matrisi, zaman farkı, alan–zaman eğrileri),
`firms_varis.tif` ve görseller (`harita.png`, `buyume.png`, `karsilastirma.png`, `zaman_farki.png`).

## Web API

Arka uç ön yüze şunları sunar (`backend/src/orman/api.py`): yangın listesi, bölge bilgisi, harita altlığı (PNG), gerçek yanmış alan ve FIRMS (GeoJSON), Web Mercator'a yansıtılmış zaman rasterları (uint16 dakika) ve simülasyon. `POST /api/yanginlar/manavgat_2021/simulasyon` model v1'i 20 tohumla çalıştırır (~5 sn) ve sonucu `data/islenmis/manavgat_2021/web/` altına yazar. Tarayıcı sonucu bir kez indirip kendisi oynatır. Etkileşimli belgeler: http://127.0.0.1:8000/docs

## Senaryo modu: "şimdi burada yangın çıksa?"

Ön yüzde **Senaryo** sekmesi (`http://localhost:5173/#senaryo`): haritada herhangi bir yere
tıklayın. Arka uç noktanın çevresinde 40 × 40 km'lik bir ızgara kurar; Copernicus DEM (GLO-90,
uzaktan pencereyle), ESA WorldCover ve Open-Meteo **tahminini** indirir, model v3'ü 20 tohumla
48 saat çalıştırır (`POST /api/senaryo?enlem=..&boylam=..`; yeni bir yer için ~10–25 sn, yakın
bir noktaya tekrar ~1 sn). Sonuç: yanma olasılığının %10 / %50 / %90'a ulaştığı anlar;
tarayıcı bunları zaman kaydırıcısıyla oynatır. Çıktılar `data/islenmis/senaryolar/<kimlik>/`.

Aynı ayarların geçmiş yangınlarda ne kadar isabetli olduğu (~1 dk):

```bash
uv --directory backend run orman-senaryo-olc
```

## Testler

```bash
uv --directory backend run pytest
```

```bash
npm --prefix frontend test
```
