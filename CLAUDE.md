# Orman Yangını Yayılım Modelleme — Bitirme Projesi

Mersin Üniversitesi Bilgisayar Mühendisliği bitirme projesi (öğrenci: Sadık Çil, danışman: Prof. Dr. Hamza Erol). Kullanıcıyla Türkçe konuşulur.

Sistemin özü: NASA FIRMS tespitlerinden başlayan, hava + DEM + bitki örtüsü füzyonuyla çalışan bir **hücresel otomat yayılım modeli**, sonucun **3B web haritasında** zaman kaydırıcısıyla gösterimi, **sanal İHA keşif rotası optimizasyonu** ve geçmiş yangınlarda (2021 Manavgat) Sentinel-2 yanmış alanıyla **sayısal doğrulama**.

## Mevcut durum (2026-10-25)

- Teknoloji yığını onaylandı ([docs/04](docs/04-teknoloji-beyin-firtinasi.md) "Kararlar"). Proje iskeleti kuruldu, çalıştırma talimatları için kök [README.md](README.md).
- Git deposu `main` dalında; henüz commit yok (kullanıcı istemeden commit atmayın).
- İlham kaynağı FireTrace demo videosu ayrıntılı olarak belgelendi.

## Önce bunları okuyun

1. [docs/05-yol-haritasi.md](docs/05-yol-haritasi.md): **yaşayan plan**; hangi adımdayız, sıradaki görevler. Kaldığımız yer burası
2. [docs/04-teknoloji-beyin-firtinasi.md](docs/04-teknoloji-beyin-firtinasi.md): teknoloji soruları ve kararlar (Adım 0'ın parçası)
3. [docs/01-proje-onerisi.md](docs/01-proje-onerisi.md): resmi kapsam ve 16 haftalık plan
4. [docs/02-firetrace-teknik-inceleme.md](docs/02-firetrace-teknik-inceleme.md): referans demo; §12 mimari ipuçları, §13 projeyle eşleştirme

Görsellere gerçekten ihtiyacınız yoksa videoyu yeniden izlemeyin; inceleme dokümanı eksiksizdir. Gerekirse kare indeksi: [docs/03-firetrace-kare-indeksi.md](docs/03-firetrace-kare-indeksi.md).

## Kurallar

- FireTrace bir **ilham** kaynağı; kurgu verili bir konsept demo. Projenin değeri gerçek veri, gerçek model ve doğrulamadadır. Resources (uçak/araç) modu kapsam dışıdır.
- **Her çalışma oturumunun sonunda** `docs/05-yol-haritasi.md` dosyasını, dosyanın sonundaki "Güncelleme kuralları"na göre güncelleyin: biten görevler, durum tablosu, sonuçlar, değişiklik günlüğü.
- Takvimi ve ilerleme hızını kullanıcı yönetir. Hafta, tarih veya takvim sormayın.
- Teknoloji kararı alındığında `docs/04-…` içindeki "Kararlar" bölümüne tarih ve gerekçeyle yazın.
- `docs/referans/firetrace/firetrace-demo.mp4` 207 MB; git deposu açılınca bu dosyayı commit etmeyin (GitHub'ın 100 MB sınırını aşıyor). `.gitignore` buna göre ayarlı.
