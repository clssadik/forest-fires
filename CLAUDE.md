# Orman Yangını Yayılım Modelleme — Bitirme Projesi

Mersin Üniversitesi Bilgisayar Mühendisliği bitirme projesi (öğrenci: Sadık Çil, danışman: Prof. Dr. Hamza Erol). Kullanıcıyla Türkçe konuşulur.

Sistemin özü: NASA FIRMS tespitlerinden başlayan, hava + DEM + bitki örtüsü füzyonuyla çalışan bir **hücresel otomat yayılım modeli**, sonucun **3B web haritasında** zaman kaydırıcısıyla gösterimi, **sanal İHA keşif rotası optimizasyonu** ve geçmiş yangınlarda (2021 Manavgat) Sentinel-2 yanmış alanıyla **sayısal doğrulama**.

## Mevcut durum (2026-10-26)

- **Adım 0, 1 ve 2 bitti.** Manavgat 2021 bölge paketi tek komutla üretiliyor (`uv --directory backend run orman-veri manavgat_2021`; ilk çalıştırma Sentinel-2 indirmesiyle ~6 dk, önbellekle ~20 sn): yükseklik, eğim, bakı, yakıt sınıfı, saatlik hava (ızgaraya yayılmış: `BolgePaketi.hava_alani().alan(zaman)`), FIRMS tespitleri ve Sentinel-2 dNBR ile **gerçek yanmış alan** (`BolgePaketi.yanmis_alan`, 53.385 ha; doğrulama referansı).
- **Ön yüz:** üst barda iki sekme. **Doğrulama** (2B MapLibre, **gerçek veri**, Adım 5): model tahmini, gerçek alan, FIRMS, zaman kaydırıcısı, simülasyon düğmesi, ölçüt paneli. **Olay** (3B, FireTrace'in Türkçe kopyası): **veri hâlâ sahte** (`frontend/src/veri/ornekSenaryo.ts`, `frontend/src/model/*`); kullanıcı bu ekranı daha sonra büyük ölçüde değiştirecek, Adım 7'de gerçek veriye geçecek.
- **Adım 3 bitti:** hücresel otomat model v1 (rüzgâr + eğim, kalibrasyonsuz): `uv --directory backend run orman-model manavgat_2021 [--calisma 20]` → `data/islenmis/manavgat_2021/model_v1/` (toa.tif, olasilik.tif, ozet.json, onizleme_toa.png). Tasarım ve ilk sonuçlar: `docs/model.md`.
- **Adım 4 bitti:** doğrulama: `uv --directory backend run orman-dogrula manavgat_2021` → `data/islenmis/manavgat_2021/dogrulama/` (rapor.json + görseller). Model v1 alan eşitlenince IoU 0,400; aynı alanlı daire 0,442 → **model baseline'ı geçemiyor** (ERA5 rüzgârı yangının doğu koşusunu açıklamıyor). Ayrıntı: `docs/dogrulama.md`.
- **Adım 5 bitti:** uçtan uca v1. API (`orman/api.py`, dönüşümler `orman/gosterim.py`), simülasyon istek üzerine ~5 sn, sonuç `data/islenmis/<ad>/web/`. "Önce hesapla, sonra oynat" (WebSocket yok, gerekçe 04'te). Arayüzdeki sayılar `orman-dogrula` raporuyla birebir aynı.
- **Adım 6 sürüyor:** rüzgâr teşhisi bitti. Kuzeybatı rüzgârıyla model daireyi geçiyor (0,55), ama METAR, ERA5 ve ECMWF hepsi K–KD rüzgârı gösteriyor (`data/ham/manavgat_2021/ruzgar_kaynaklari/rapor.md`). **Model v2** (v1 + Alexandridis yakıt tablosu, `V2_YAKIT`) alan eşitlenmiş IoU 0,437 (v1 0,400, daire 0,442), zaman farkı +17 sa; `orman-dogrula`'da `model_v2` deneyi. Web simülasyonu hâlâ v1. Sırada nem/gece (durma sorunu) ve kalibrasyon; hedef daireyi geçmek. Ayrıntı: docs/05 → Adım 6.
- Teknoloji kararları: [docs/04](docs/04-teknoloji-beyin-firtinasi.md) "Kararlar". Çalıştırma: kök [README.md](README.md).
- Git deposu `main` dalında; uzak depo **herkese açık**: https://github.com/clssadik/forest-fires. Kullanıcı istemeden commit veya push yapmayın; commit mesajları İngilizce ve açıklayıcı olmalı.

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
  - `veri/`: `firms.py`, `dem.py`, `arazi_ortusu.py`, `hava.py`, `hava_alani.py`, `yanmis_alan.py` (Sentinel-2 dNBR), `bolge_paketi.py` (`olustur`, `yukle -> BolgePaketi`, CLI `orman-veri`)
  - `model/`: `yayilim.py` (Numba çekirdeği: `yayilim`, `coklu_yayilim`, `Parametreler`, `Arazi`, `Ruzgar`), `calistir.py` (CLI `orman-model`), `onizleme.py` (TOA görseli)
  - `dogrulama/`: `olcutler.py` (`dogrula(toa, Referans) -> Olcutler`: IoU, Dice, kappa, karışıklık matrisi, FIRMS zaman farkı, alan eşitleme), `calistir.py` (CLI `orman-dogrula`, baseline'lar), `rapor.py` (matplotlib görselleri)
  - `api.py`: FastAPI; uç noktalar dosyanın başında (yangın listesi, bilgi, altlık, GeoJSON, rasterlar, simülasyon). `gosterim.py`: Web Mercator'a yansıtma, uint16 dakika kodlama, GeoJSON, altlık PNG
- `frontend/src/`: `durum/` (Zustand; `zaman.ts` tek zaman kaynağı, `ekran.ts` sekme, `dogrulama.ts` doğrulama verisi), `bilesenler/` (üst bar, sağ panel, alt şerit, harita kontrolleri; `dogrulama/` 2B ekran), `dogrulama/` (API istemcisi, `boyama.ts` yangın katmanı + anlık sayım, `konum.ts`), `sahne/` (R3F: arazi, ağaçlar, yangın shader'ı, rüzgâr), `model/` + `veri/` (**sahte**, yalnızca Olay ekranı), `i18n/tr.json` (tüm metinler)
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
