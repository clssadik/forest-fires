"""Hafif kalibrasyon: birkaç ana parametreyi gerçek yangına göre otomatik ayarlar.

    uv run orman-kalibre manavgat_2021                 # 150 rastgele + 50 yerel deneme
    uv run orman-kalibre manavgat_2021 --deneme 40 --yerel 10

Hedef, şekil ve zamanlamanın ortalamasıdır (ikisi de 0–1):
- **şekil:** alan eşitlenmiş IoU (zaman ölçeğinden bağımsız),
- **zamanlama:** uydunun her geçişinde, o ana kadar FIRMS'in gördüğü gerçek alan ile modelin
  yaktığı alanın IoU'su; geçişlerin ortalaması (arayüzdeki "anlık örtüşme"nin aynısı). Bu,
  "X saatte nereye varır?" sorusunun ölçüsüdür.

Arama: önce aralıklardan rastgele örnekleme, sonra en iyilerin çevresinde yerel arama; her deneme
az tohumla (hız için). En iyi birkaç aday sonunda **başka tohumlarla** ve daha çok çalıştırmayla
yeniden ölçülür; seçimin tohum şansına dayanmaması için. Yakıt tablosu ve yanma süresi aranmaz.

Kalibrasyon yalnızca ana yangında yapılır; genelleme ikinci yangında, hiç ayar yapmadan ölçülür.
Çıktı: `data/islenmis/<ad>/kalibrasyon/sonuc.json`.
"""

import argparse
import json
import math
import time
from dataclasses import asdict, dataclass, replace

import numpy as np

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import V1, V2, DeneyOrtami
from orman.dogrulama.olcutler import Referans, dogrula, mekansal_olcutler
from orman.model.yayilim import Parametreler, coklu_yayilim
from orman.senaryo import Senaryo
from orman.veri.bolge_paketi import SENARYOLAR

# Aranan parametreler: ad -> (alt, üst, ölçek). "log": aralıkta logaritmik düzgün.
ARALIKLAR: dict[str, tuple[float, float, str]] = {
    "hiz_olcegi": (0.02, 0.3, "log"),  # 1/dk; düzde yayılma hızı ≈ hiz_olcegi · p_h · 30 m
    "c1": (0.0, 0.15, "dogrusal"),  # rüzgâr hızının genel etkisi
    "c2": (0.0, 0.4, "dogrusal"),  # rüzgâr yönünün etkisi
    "a": (0.0, 0.1, "dogrusal"),  # eğim etkisi
    "sonme_nemi": (0.10, 0.40, "dogrusal"),  # yakıtın sönme nemi
}
GECIS_ARALIGI_DK = 180.0  # bundan kısa aralıklı tespitler aynı uydu geçişinden sayılır


def gecis_anlari(
    firms_toa: np.ndarray, kapsam: np.ndarray, en_az_oran: float = 0.05, en_gec_saat: float = 72.0
) -> np.ndarray:
    """Uydu geçiş anları (dk): FIRMS varış değerleri kümelenir, her kümenin son anı alınır.

    Gerçek alanın (FIRMS'in gördüğü kısmın) `en_az_oran`'ından azını görmüş ilk geçişler ve
    `en_gec_saat`'ten sonrakiler atlanır (çok küçük alanlar gürültülü, sonrası söndürme dönemi).
    """
    degerler = np.sort(firms_toa[kapsam & ~np.isnan(firms_toa)].astype(np.float64))
    if degerler.size == 0:
        return np.zeros(0)
    son = np.append(np.diff(degerler) > GECIS_ARALIGI_DK, True)
    anlar = np.unique(degerler[son])
    oran = np.searchsorted(degerler, anlar, "right") / degerler.size
    return anlar[(oran >= en_az_oran) & (anlar <= en_gec_saat * 60.0)]


def zamanli_iou(toa: np.ndarray, referans: Referans, anlar_dk) -> float:
    """Her anda modelin yaktığı ile FIRMS'in o ana kadar gördüğü alanın IoU'su; ortalama."""
    r = referans
    degerler = [
        mekansal_olcutler(toa <= t, r.firms_toa <= t, r.kapsam, r.hucre_ha).iou for t in anlar_dk
    ]
    return float(np.mean(degerler)) if degerler else float("nan")


def hedef(sekil: float, zamanlama: float) -> float:
    return 0.5 * sekil + 0.5 * zamanlama


def rastgele_parametreler(rng: np.random.Generator, taban: Parametreler) -> Parametreler:
    degerler = {}
    for ad, (alt, ust, olcek) in ARALIKLAR.items():
        if olcek == "log":
            degerler[ad] = float(math.exp(rng.uniform(math.log(alt), math.log(ust))))
        else:
            degerler[ad] = float(rng.uniform(alt, ust))
    return replace(taban, **degerler)


def komsu_parametreler(
    rng: np.random.Generator, merkez: Parametreler, oran: float = 0.15
) -> Parametreler:
    """Yerel arama: her parametreyi aralık genişliğinin `oran`'ı kadar oynatır (sınırda kırpar)."""
    degerler = {}
    for ad, (alt, ust, olcek) in ARALIKLAR.items():
        x = getattr(merkez, ad)
        if olcek == "log":
            genislik = math.log(ust) - math.log(alt)
            y = math.exp(math.log(x) + rng.normal(0.0, oran * genislik))
        else:
            y = x + rng.normal(0.0, oran * (ust - alt))
        degerler[ad] = float(min(max(y, alt), ust))
    return replace(merkez, **degerler)


@dataclass
class Degerlendirme:
    parametreler: dict
    hedef: float
    sekil: float  # alan eşitlenmiş IoU
    zamanlama: float  # geçişlerde zamanlı IoU ortalaması
    esit_alan_saat: float
    zaman_ortanca_saat: float
    bitis_iou: float
    bitis_ha: float


def degerlendir(
    ortam: DeneyOrtami, parametreler: Parametreler, tohumlar, anlar_dk
) -> Degerlendirme:
    r = ortam.referans
    toa = coklu_yayilim(
        ortam.arazi, ortam.ruzgar, [ortam.tutusma], parametreler, tohumlar, r.bitis_dk
    ).toa_topluluk
    o = dogrula(toa, r)
    zamanlama = zamanli_iou(toa, r, anlar_dk)
    return Degerlendirme(
        parametreler=asdict(parametreler),
        hedef=hedef(o.esit_alan.iou, zamanlama),
        sekil=o.esit_alan.iou,
        zamanlama=zamanlama,
        esit_alan_saat=o.esit_alan_saat,
        zaman_ortanca_saat=o.zaman.ortanca_saat,
        bitis_iou=o.bitis.iou,
        bitis_ha=o.bitis.model_ha,
    )


def _satir(etiket: str, d: Degerlendirme) -> str:
    p = d.parametreler
    return (
        f"{etiket:<14} hedef {d.hedef:.3f}  şekil {d.sekil:.3f}  zamanlama {d.zamanlama:.3f}  "
        f"fark {d.zaman_ortanca_saat:+5.1f} sa  bitiş {d.bitis_iou:.3f} {d.bitis_ha:>8,.0f} ha  | "
        f"hız {p['hiz_olcegi']:.3f} c1 {p['c1']:.3f} c2 {p['c2']:.3f} a {p['a']:.3f} "
        f"M_x {p['sonme_nemi']:.2f}"
    )


def kalibre(
    senaryo: Senaryo,
    deneme: int = 150,
    yerel: int = 50,
    calisma: int = 5,
    finalist: int = 5,
    dogrulama_calisma: int = 20,
    tohum: int = 0,
    yazdir=print,
) -> dict:
    baslangic = time.perf_counter()
    ortam = DeneyOrtami.hazirla(senaryo)
    anlar = gecis_anlari(ortam.referans.firms_toa, ortam.referans.kapsam)
    yazdir(f"Uydu geçişleri (sa): {', '.join(f'{t / 60:.1f}' for t in anlar)}")
    rng = np.random.default_rng(tohum)
    arama_tohumlari = range(calisma)
    denemeler: list[Degerlendirme] = []

    def dene(p: Parametreler) -> None:
        denemeler.append(degerlendir(ortam, p, arama_tohumlari, anlar))
        if len(denemeler) % 10 == 0:
            en_iyi = max(denemeler, key=lambda x: x.hedef)
            yazdir(f"[{len(denemeler):3d}] en iyi {_satir('', en_iyi)}")

    for _ in range(deneme):
        dene(rastgele_parametreler(rng, V2))
    for i in range(yerel):  # en iyi üç denemenin çevresinde sırayla
        en_iyiler = sorted(denemeler, key=lambda x: -x.hedef)[:3]
        merkez = Parametreler(**_demet(en_iyiler[i % len(en_iyiler)].parametreler))
        dene(komsu_parametreler(rng, merkez))

    # Finalistler ve referans modeller, arama tohumlarından farklı tohumlarla yeniden ölçülür.
    dogrulama_tohumlari = range(1000, 1000 + dogrulama_calisma)
    adaylar = sorted(denemeler, key=lambda x: -x.hedef)[:finalist]
    yazdir(f"\nFinalistler ({dogrulama_calisma} yeni tohum):")
    referanslar = {"model_v1": V1, "model_v2": V2}
    sonuclar = {}
    for ad, p in referanslar.items():
        sonuclar[ad] = degerlendir(ortam, p, dogrulama_tohumlari, anlar)
        yazdir(_satir(ad, sonuclar[ad]))
    finaller = []
    for i, d in enumerate(adaylar):
        f = degerlendir(ortam, Parametreler(**_demet(d.parametreler)), dogrulama_tohumlari, anlar)
        finaller.append(f)
        yazdir(_satir(f"aday {i + 1}", f))
    en_iyi = max(finaller, key=lambda x: x.hedef)

    rapor = {
        "senaryo": senaryo.ad,
        "hedef": "0,5 · alan eşitlenmiş IoU + 0,5 · uydu geçişlerinde zamanlı IoU ortalaması",
        "gecis_anlari_saat": [round(t / 60.0, 2) for t in anlar],
        "araliklar": ARALIKLAR,
        "arama": {"rastgele": deneme, "yerel": yerel, "tohum_sayisi": calisma, "rng": tohum},
        "dogrulama_tohumlari": [dogrulama_tohumlari.start, dogrulama_tohumlari.stop],
        "referanslar": {ad: asdict(d) for ad, d in sonuclar.items()},
        "finalistler": [asdict(d) for d in finaller],
        "en_iyi": asdict(en_iyi),
        "denemeler": [asdict(d) for d in denemeler],
        "sure_sn": round(time.perf_counter() - baslangic, 1),
    }
    d = ISLENMIS_VERI_DIZINI / senaryo.ad / "kalibrasyon"
    d.mkdir(parents=True, exist_ok=True)
    (d / "sonuc.json").write_text(json.dumps(rapor, ensure_ascii=False, indent=2))
    yazdir(f"\nEn iyi: {_satir('', en_iyi)}\nSüre {rapor['sure_sn']} sn. Rapor: {d / 'sonuc.json'}")
    return rapor


def _demet(parametreler: dict) -> dict:
    """`asdict` demetleri listeye çevirir; `Parametreler`'e geri verirken demete döndürülür."""
    return {k: tuple(v) if isinstance(v, list) else v for k, v in parametreler.items()}


def main() -> None:
    ayristirici = argparse.ArgumentParser(
        description="Model parametrelerini gerçek yangına ayarlar."
    )
    ayristirici.add_argument("senaryo", choices=sorted(SENARYOLAR))
    ayristirici.add_argument("--deneme", type=int, default=150, help="rastgele deneme sayısı")
    ayristirici.add_argument("--yerel", type=int, default=50, help="yerel arama deneme sayısı")
    ayristirici.add_argument("--calisma", type=int, default=5, help="denemede tohum sayısı")
    ayristirici.add_argument("--finalist", type=int, default=5)
    ayristirici.add_argument("--tohum", type=int, default=0, help="arama rastgeleliği")
    s = ayristirici.parse_args()
    kalibre(SENARYOLAR[s.senaryo], s.deneme, s.yerel, s.calisma, s.finalist, tohum=s.tohum)
