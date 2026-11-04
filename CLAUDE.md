# Orman Yangını Yayılım Modelleme — Bitirme Projesi

Mersin Üniversitesi Bilgisayar Mühendisliği bitirme projesi (öğrenci: Sadık Çil, danışman: Prof. Dr. Hamza Erol). Kullanıcıyla Türkçe konuşulur.

Sistemin özü: NASA FIRMS tespitlerinden başlayan, hava + DEM + bitki örtüsü füzyonuyla çalışan bir **hücresel otomat yayılım modeli**, sonucun **3B web haritasında** zaman kaydırıcısıyla gösterimi, **sanal İHA keşif rotası optimizasyonu** ve geçmiş yangınlarda (2021 Manavgat) Sentinel-2 yanmış alanıyla **sayısal doğrulama**.

## Mevcut durum (2026-11-02, Adım 7 bitti, tek model: v1; Adım 8 bekliyor)

- **Adım 0, 1 ve 2 bitti.** Manavgat 2021 bölge paketi tek komutla üretiliyor (`uv --directory backend run orman-veri manavgat_2021`; ilk çalıştırma Sentinel-2 indirmesiyle ~6 dk, önbellekle ~20 sn): yükseklik, eğim, bakı, yakıt sınıfı, saatlik hava (ızgaraya yayılmış: `BolgePaketi.hava_alani().alan(zaman)`), FIRMS tespitleri ve Sentinel-2 dNBR ile **gerçek yanmış alan** (`BolgePaketi.yanmis_alan`, 53.385 ha; doğrulama referansı).
- **Ön yüz:** sol rayda ekranlar. **Doğrulama** (2B MapLibre, **gerçek veri**): model tahmini, gerçek alan, FIRMS, zaman kaydırıcısı, simülasyon düğmesi, ölçüt paneli. **Olay** (3B, FireTrace düzeni): **gerçek veri**, aynı yangın seçicisiyle (Manavgat ↔ Marmaris).
- **Tek model: v1** (2026-11-02, kullanıcı kararı; geliştirme sırasındaki ara sürümler silindi, eski adıyla v6). Parametreler `model/yayilim.py` → `V1`: Alexandridis yakıt tablosu (`YAKIT_TABLOSU`), yakıt nemi (`model/nem.py`, sönme nemi 0,19), büyüme hızına bağlı söndürme (6. saatten sonra `p < 0,58` geçişler `0,85 · max(0, 1 − büyüme/26.500 ha/sa)` olasılıkla tutulur; büyüme = son 60 dk yanan alan hızı). Hız, rüzgâr, eğim ve nem `orman-kalibre` ile, söndürme elle tarandı; yalnızca Manavgat'ta. Eğim etkisi kalibrasyonda 0'a indi. Model tutmaya çok duyarlı (sabit 0,82 → Manavgat 74 bin ha, 0,85 → 40 bin ha). `GUNCEL_MODEL = "model_v1"`; ekranlar, simülasyon ve senaryo modu bunu kullanır. Tek çalıştırma: `uv --directory backend run orman-model manavgat_2021 [--calisma 20]` → `data/islenmis/manavgat_2021/model_v1/`. Tasarım: `docs/model.md`.
- **Doğrulama:** `uv --directory backend run orman-dogrula <ad>` (~10 sn) → `data/islenmis/<ad>/dogrulama/` (rapor.json + görseller). Deneyler (`dogrulama/calistir.py` → `DENEYLER`): v1, rüzgârsız v1 (ablasyon) ve aynı alanlı daire baseline'ı. **Ana ölçü bitişte Sørensen** (kullanıcı kararı): Manavgat v1 %58 (yakalama %83, isabet %45, 99.161 ha, gerçeğin ~1,9 katı), daire %61 → **geçemiyor** (kalan hata büyük olasılıkla rüzgâr hızı, ERA5 fırtınayı görmüyor; yangın rüzgârın yanına, doğuya koştu); rüzgârsız %14. **Marmaris 2022 (ayarsız, genelleme testi)** v1 %69 (6.016 ha), daire %50, rüzgârsız %31. **Manavgat çoklu tutuşma** (`Senaryo.ek_tutusmalar`: FIRMS'ten 4 + 29 Tem Saraçlı kundaklaması). Duyarlılık (`orman-duyarlilik`): ±%20 → şekil IoU Manavgat'ta en fazla ±0,05, Marmaris'te −0,17'ye kadar (en duyarlı `c1` ve sönme nemi). Ayrıntı: `docs/dogrulama.md`.
- **Uçtan uca:** API (`orman/api.py`, dönüşümler `orman/gosterim.py`), simülasyon istek üzerine ~5 sn, sonuç `data/islenmis/<ad>/web/`. "Önce hesapla, sonra oynat" (WebSocket yok, gerekçe 04'te). Arayüzdeki sayılar `orman-dogrula` raporuyla birebir aynı.
- **Senaryo modu:** ön yüzde **Senaryo** ekranı; haritaya tıkla → arka uç (`senaryo_modu.py`, `POST /api/senaryo`) 40 × 40 km ızgara kurar, DEM GLO-90 + WorldCover + Open-Meteo tahminini indirir (yeni nokta 6–25 sn), v1'i 20 tohum 48 sa çalıştırır, %10/%50/%90 olasılık bantlarını döndürür. Hava: Open-Meteo Ensemble (ECMWF IFS 51 üye → 20 çalıştırma; erişilemezse tekil tahmin, `sonuc.json` → `hava_kaynagi`); ölçülen noktada bantlar belirgin genişlemedi. Elle hava girişi yok (kullanıcı kararı). İsabet (`orman-senaryo-olc`, "olası" bant): 12. saatte yakalama %54–82, isabet %72–77, daire %48–60; Marmaris 48. saatte gerçeğin ~1,5 katı. Ayrıntı: docs/dogrulama.md §6–7.
- **Olay ekranı (Adım 7, 2026-10-29):** arka uç `orman/olay.py` (`GET /api/yanginlar/{ad}/olay[/{bant}]`): 150 m kaba ızgara (DEM, WorldCover örtüsü, model TOA ve olasılık, Sentinel-2 oranı, FIRMS), saatlik seriler, ana yayılım ekseni profili, otomatik olaylar, ölçüt özeti (`model`) ve veri künyesi (`kanitlar`). Ön yüz `olay/veri.ts` (`OlayVerisi`) + `durum/olay.ts`; sahne, paneller, grafikler, tıklanabilir olay çizelgesi. Sahne efektleri ve kamera ızgara boyuna ve yangın büyüklüğüne göre ölçeklenir (`hucreAgirligi`, `yanginOlcegi`). Harita görünümü yedi modla seçilir (`durum/katmanlar.ts`): Model (Yayılım, Varış zamanı, Güven), Doğruluk (Hata, Zaman farkı), Gerçek (Yanma şiddeti, Bitki örtüsü); üstüne üç anahtar biner (Varış çizgileri, Rüzgâr, Duman). Tematik renkler `sahne/tematikRenkler.ts` içinde tek yerde; renk anahtarı haritada (`bilesenler/harita/ModLejanti.tsx`). Sağ çekmece (haritanın üstüne biner) sekmeleri: Özet, Katmanlar, Analiz (tek sayfa: bitiş alanları, hata dağılımı, zaman farkı, kıyas, veri künyesi, model sınırları, localStorage notu). Uydu görüntüsü ve yollar Adım 9'a.
- **Denenip bırakılanlar:** OSM yol/akarsu engel katmanı (`veri/engeller.py`, `engeller.tif`, `Parametreler.engel_etkisi`) var ama kapalı: tek başına durdurmuyor, güçlenince Manavgat Çayı yangını kilitliyor. WindNinja (`veri/ruzgar_arazi.py`, isteğe bağlı, ikili `~/araclar/windninja`): rüzgârı doğuya çevirmiyor, şekil IoU düşüyor; doğuya koşu arazi bükmesiyle açıklanmıyor. Raporlar: `docs/deneyler/2026-10-29/`. Altlık kenarı `gosterim.kenar_maskesi` ile düzensiz saydamlaşıyor.
- Teknoloji kararları: [docs/04](docs/04-teknoloji-beyin-firtinasi.md) "Kararlar". Çalıştırma: kök [README.md](README.md).
- Git deposu `main` dalında; uzak depo **herkese açık**: https://github.com/clssadik/forest-fires. **Her anlamlı işten sonra commit atın** (kullanıcı kuralı, 2026-10-26): çalışan ve testleri geçen her mantıksal parça (özellik, deney altyapısı, düzeltme) bitince, bir sonrakine geçmeden. Push yalnızca kullanıcı isteyince. Commit mesajları İngilizce ve açıklayıcı; `docs/` hiçbir zaman commit edilmez.

## Önce bunları okuyun

1. [docs/05-yol-haritasi.md](docs/05-yol-haritasi.md): **yaşayan plan**; hangi adımdayız, sıradaki görevler. Kaldığımız yer burası
2. [docs/04-teknoloji-beyin-firtinasi.md](docs/04-teknoloji-beyin-firtinasi.md): teknoloji kararları
3. [docs/06-dogrulama-yanginlari.md](docs/06-dogrulama-yanginlari.md): Manavgat 2021 (ana) ve Marmaris 2022 (genelleme testi); tutuşma zamanı ve konumu, veri erişimi
4. [docs/07-literatur.md](docs/07-literatur.md): kaynaklar ve okuma sırası (model için Alexandridis 2008)
5. [docs/01-proje-onerisi.md](docs/01-proje-onerisi.md): resmi kapsam ve 16 haftalık plan
6. [docs/02-firetrace-teknik-inceleme.md](docs/02-firetrace-teknik-inceleme.md): referans demo; §12 mimari ipuçları, §13 projeyle eşleştirme

## Kod haritası

- `backend/src/orman/`
  - `ayarlar.py`: yollar (`data/ham`, `data/islenmis`) ve `backend/.env` okuma
  - `izgara.py`: ortak model ızgarası (`MANAVGAT_2021`: EPSG:32636, 30 m, 1583 × 1808) ve `izgaraya_yansit`
  - `senaryo.py`: senaryo = ızgara + tarih aralığı + tutuşma zamanı/konumu
  - `veri/`: `firms.py`, `dem.py` (senaryo modunda GLO-90 uzaktan), `arazi_ortusu.py`, `engeller.py` (OSM yol/akarsu, Overpass), `hava.py`, `hava_alani.py`, `yanmis_alan.py` (Sentinel-2 dNBR), `bolge_paketi.py` (`olustur`, `yukle -> BolgePaketi`, CLI `orman-veri`)
  - `model/`: `yayilim.py` (Numba çekirdeği: `yayilim`, `coklu_yayilim`, `Parametreler`, `Arazi`, `Ruzgar`), `calistir.py` (CLI `orman-model`), `onizleme.py` (TOA görseli)
  - `dogrulama/`: `olcutler.py` (`dogrula(toa, Referans) -> Olcutler`: IoU, Dice, kappa, karışıklık matrisi, FIRMS zaman farkı, alan eşitleme), `calistir.py` (CLI `orman-dogrula`, baseline'lar), `rapor.py` (matplotlib görselleri), `kalibrasyon.py` (CLI `orman-kalibre`), `duyarlilik.py` (CLI `orman-duyarlilik`)
  - `senaryo_modu.py`: haritadan seçilen nokta için senaryo (`noktadan_senaryo`), canlı paket, olasılık bantları (`esik_toalari`), `calistir`. `dogrulama/senaryo_olcumu.py`: CLI `orman-senaryo-olc`
  - `olay.py`: Olay (3B) ekranının paketi (`olay_paketi`): kaba rasterlar, seriler, eksen, olaylar
  - `api.py`: FastAPI; uç noktalar dosyanın başında (yangın listesi, bilgi, altlık, GeoJSON, rasterlar, simülasyon, senaryo). `gosterim.py`: Web Mercator'a yansıtma, uint16 dakika kodlama, GeoJSON, altlık PNG
- `frontend/src/`: `durum/` (Zustand; `zaman.ts` tek zaman kaynağı, `ekran.ts` sekme, `dogrulama.ts` doğrulama verisi, `senaryo.ts` senaryo verisi), `bilesenler/` (üst bar, sağ panel, alt şerit, harita kontrolleri; `dogrulama/` ve `senaryo/` 2B ekranlar), `dogrulama/` (API istemcisi, `boyama.ts` yangın katmanı + anlık sayım, `konum.ts`), `senaryo/` (API istemcisi, `boyama.ts` olasılık bantları), `olay/` (Olay ekranı API istemcisi ve `OlayVerisi`), `durum/olay.ts`, `sahne/` (R3F: arazi, ağaçlar, yangın shader'ı, rüzgâr, eksen/izokron etiketleri), `model/gurultu.ts` (rastgele üreteç), `i18n/tr.json` (tüm metinler)
- Kod stili: Türkçe tanımlayıcılar ve açıklamalar. Testler: `uv --directory backend run pytest`, `npm --prefix frontend test`.

Görsellere gerçekten ihtiyacınız yoksa videoyu yeniden izlemeyin; inceleme dokümanı eksiksizdir. Gerekirse kare indeksi: [docs/03-firetrace-kare-indeksi.md](docs/03-firetrace-kare-indeksi.md).

## Kurallar

- FireTrace bir **ilham** kaynağı; kurgu verili bir konsept demo. Projenin değeri gerçek veri, gerçek model ve doğrulamadadır. Resources (uçak/araç) modu kapsam dışıdır.
- **Her çalışma oturumunun sonunda** `docs/05-yol-haritasi.md` dosyasını, dosyanın sonundaki "Güncelleme kuralları"na göre güncelleyin: biten görevler, durum tablosu, sonuçlar, değişiklik günlüğü.
- Takvimi ve ilerleme hızını kullanıcı yönetir. Hafta, tarih veya takvim sormayın.
- **Gizli anahtarlar** (`FIRMS_MAP_KEY`) yalnızca `backend/.env` dosyasında durur (git'e girmez). Değeri asla yazdırmayın, loglamayın, commit etmeyin; commit öncesi staged değişikliklerde anahtar geçmediğini kontrol edin.
- `data/` git'e girmez; her şey `orman-veri` komutuyla yeniden üretilebilir olmalı.
- Teknoloji kararı alındığında `docs/04-…` içindeki "Kararlar" bölümüne tarih ve gerekçeyle yazın.
- **`docs/` klasörü yalnızca yerelde tutulur ve asla commit edilmez.** Kişisel bilgiler (öğrenci numarası, öneri PDF'i) ve başkasına ait video kareleri içeriyor; depo herkese açık. `.gitignore` buna göre ayarlı. Dokümanları güncellemeye devam edin, sadece git'e eklemeyin. Depoyu temiz bir klondan açan ajanlarda `docs/` bulunmaz.
