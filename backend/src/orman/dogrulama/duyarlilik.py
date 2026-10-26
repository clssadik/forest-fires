"""Duyarlılık analizi: güncel modelin her parametresi ±%20 oynatılınca sonuç ne kadar değişir?

    uv run orman-duyarlilik                       # Manavgat 2021 + Marmaris 2022, 10 tohum
    uv run orman-duyarlilik --calisma 5 --oran 0.1

Kalibrasyonda aranan parametreler (`kalibrasyon.ARALIKLAR`) tek tek oynatılır, diğerleri sabit.
Değeri 0 olan parametre (ör. v3'te eğim `a`) oranla oynatılamaz; onun yerine arama aralığının
`oran` katı kadar artırılır (yalnız yukarı, çünkü aralık 0'dan başlıyor). Ölçütler kalibrasyonla
aynı: alan eşitlenmiş IoU (şekil) ve uydu geçişlerinde zamanlı IoU (zamanlama). Tohumlar
kalibrasyonun arama ve doğrulama tohumlarından ayrı (2000…).
Çıktı: `data/islenmis/duyarlilik/sonuc.json`.
"""

import argparse
import json
import time
from dataclasses import asdict, replace

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import DENEYLER, GUNCEL_MODEL, DeneyOrtami
from orman.dogrulama.kalibrasyon import ARALIKLAR, degerlendir, gecis_anlari
from orman.model.yayilim import Parametreler
from orman.veri.bolge_paketi import SENARYOLAR

YANGINLAR = ("manavgat_2021", "marmaris_2022")
TOHUM_BASI = 2000


def oynatmalar(taban: Parametreler, oran: float = 0.2) -> list[tuple[str, str, Parametreler]]:
    """(parametre, yön, parametreler) listesi: her aranan parametre için −oran ve +oran."""
    sonuc = []
    for ad, (alt, ust, _) in ARALIKLAR.items():
        x = getattr(taban, ad)
        if x == 0:
            sonuc.append((ad, "+", replace(taban, **{ad: oran * (ust - alt)})))
            continue
        sonuc.append((ad, "-", replace(taban, **{ad: x * (1 - oran)})))
        sonuc.append((ad, "+", replace(taban, **{ad: x * (1 + oran)})))
    return sonuc


def analiz(yanginlar=YANGINLAR, calisma: int = 10, oran: float = 0.2, yazdir=print) -> dict:
    baslangic = time.perf_counter()
    taban = DENEYLER[GUNCEL_MODEL][1]
    tohumlar = range(TOHUM_BASI, TOHUM_BASI + calisma)
    rapor: dict = {
        "model": GUNCEL_MODEL,
        "taban": asdict(taban),
        "oran": oran,
        "calisma_sayisi": calisma,
        "yanginlar": {},
    }
    for ad in yanginlar:
        ortam = DeneyOrtami.hazirla(SENARYOLAR[ad])
        anlar = gecis_anlari(ortam.referans.firms_toa, ortam.referans.kapsam)
        t = degerlendir(ortam, taban, tohumlar, anlar)
        yazdir(f"\n{ad}: taban şekil {t.sekil:.3f}  zamanlama {t.zamanlama:.3f}")
        satirlar = []
        for parametre, yon, p in oynatmalar(taban, oran):
            d = degerlendir(ortam, p, tohumlar, anlar)
            satir = {
                "parametre": parametre,
                "yon": yon,
                "deger": getattr(p, parametre),
                "sekil": d.sekil,
                "zamanlama": d.zamanlama,
                "sekil_fark": d.sekil - t.sekil,
                "zamanlama_fark": d.zamanlama - t.zamanlama,
                "bitis_ha": d.bitis_ha,
            }
            satirlar.append(satir)
            yazdir(
                f"  {parametre:<11} {yon} ({satir['deger']:.3f})  şekil {d.sekil:.3f} "
                f"({satir['sekil_fark']:+.3f})  zamanlama {d.zamanlama:.3f} "
                f"({satir['zamanlama_fark']:+.3f})"
            )
        rapor["yanginlar"][ad] = {
            "taban": {"sekil": t.sekil, "zamanlama": t.zamanlama, "bitis_ha": t.bitis_ha},
            "oynatmalar": satirlar,
        }
    rapor["sure_sn"] = round(time.perf_counter() - baslangic, 1)
    d = ISLENMIS_VERI_DIZINI / "duyarlilik"
    d.mkdir(parents=True, exist_ok=True)
    (d / "sonuc.json").write_text(json.dumps(rapor, ensure_ascii=False, indent=2))
    yazdir(f"\nSüre {rapor['sure_sn']} sn. Rapor: {d / 'sonuc.json'}")
    return rapor


def main() -> None:
    ayristirici = argparse.ArgumentParser(description="Güncel modelin parametre duyarlılığı.")
    ayristirici.add_argument("--calisma", type=int, default=10, help="tohum sayısı")
    ayristirici.add_argument("--oran", type=float, default=0.2, help="oynatma oranı")
    s = ayristirici.parse_args()
    analiz(calisma=s.calisma, oran=s.oran)
