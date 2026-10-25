# Ön yüz (React + TypeScript)

Analiz ekranı: 3B sahne (React Three Fiber), 2D harita (MapLibre), katman paneli, zaman çubuğu, grafikler ve olay listesi.

```bash
npm install     # bağımlılıkları kur
npm run dev     # http://localhost:5173 (/api istekleri 127.0.0.1:8000'e yönlenir)
npm test        # Vitest
npm run lint    # oxlint
npm run build   # tip denetimi + üretim derlemesi
```

## Yapı

| Klasör | İçerik |
|---|---|
| `src/durum/` | Zustand durumları. `zaman.ts` tek zaman kaynağıdır; harita, grafikler ve listeler buradan türetilir |
| `src/bilesenler/` | Üst bar, sağ panel (katmanlar, olay özeti, hava), alt şerit (zaman çubuğu, grafikler, olaylar), harita kontrolleri |
| `src/sahne/` | 3B sahne: arazi, ağaçlar, su, yangın shader'ı, rüzgâr çizgileri, etiketler, kamera |
| `src/model/`, `src/veri/` | **Örnek (sahte) veri ve modeller.** Yayılım modeli tamamlanınca arka uç çıktısıyla değiştirilecek |
| `src/i18n/` | Arayüz metinleri (`tr.json`) |

Arayüz metinleri `src/i18n/tr.json` içindedir; koda gömülü metin yazmayın.
