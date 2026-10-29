"""Senaryo modunun geçmiş yangınlarda ne kadar isabetli olduğunu ölçer.

    uv run orman-senaryo-olc               # Manavgat 2021 ve Marmaris 2022

Senaryo modu (`senaryo_modu.py`) ile aynı ayarlar: güncel model, 20 tohum, 48 saat, %10/%50/%90
olasılık bantları. Fark yalnızca hava: burada tahmin değil, olay anının ERA5 havası (yani
"hava tahmini kusursuz olsaydı"). Her bant ve her saat için:

- yakalama: o saate kadar gerçekten yanan alanın (FIRMS'in gördüğü gerçek alan) yüzde kaçı
  bandın içinde;
- isabet: bandın yüzde kaçı sonunda gerçekten yandı (Sentinel-2 yanmış alanı). Gerçek alanla
  karşılaştırılır, çünkü FIRMS ilk saatlerde alanın bir kısmını görmüyor;
- aynı alanlı daire (tutuşma merkezli) ile aynı iki ölçüt: modelin yön ve yakıt bilgisinin
  basit bir halkadan fazlasını söyleyip söylemediği.

Çıktı: `data/islenmis/senaryo_olcumu.json` ve ekrana tablo.
"""

import json

import numpy as np

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.calistir import DeneyOrtami
from orman.dogrulama.olcutler import daire_toa
from orman.model.yayilim import coklu_yayilim
from orman.senaryo import MANAVGAT_2021, MARMARIS_2022, Senaryo
from orman.senaryo_modu import CALISMA, ESIKLER, PARAMETRELER, SURE_SA, esik_toalari

SAATLER = (6, 12, 24, 48)
BANT_ADLARI = ("dusuk", "orta", "yuksek")


def _oranlar(tahmin: np.ndarray, gozlenen: np.ndarray, gercek: np.ndarray) -> dict:
    n_tahmin, n_gozlenen = int(tahmin.sum()), int(gozlenen.sum())
    return {
        "yakalama": float((tahmin & gozlenen).sum() / n_gozlenen) if n_gozlenen else None,
        "isabet": float((tahmin & gercek).sum() / n_tahmin) if n_tahmin else None,
    }


def olc(senaryo: Senaryo, calisma: int = CALISMA) -> dict:
    ortam = DeneyOrtami.hazirla(senaryo)
    ref = ortam.referans
    sonuc = coklu_yayilim(
        ortam.arazi,
        ortam.ruzgar,
        ortam.model_tutusmalari,
        PARAMETRELER,
        range(calisma),
        SURE_SA * 60.0,
    )
    bantlar = esik_toalari(sonuc.toalar, ESIKLER)
    uzaklik = daire_toa(ortam.tutusma, ortam.paket.yanabilir, senaryo.izgara.cozunurluk)
    gercek = ref.gercek & ref.kapsam

    satirlar = []
    for saat in SAATLER:
        gozlenen = gercek & (ref.firms_toa <= saat * 60.0)
        satir = {"saat": saat, "gozlenen_ha": round(float(gozlenen.sum()) * ref.hucre_ha)}
        for ad, bant in zip(BANT_ADLARI, bantlar):
            tahmin = (bant <= saat * 60.0) & ref.kapsam
            satir[ad] = {"ha": round(float(tahmin.sum()) * ref.hucre_ha)} | _oranlar(
                tahmin, gozlenen, gercek
            )
            # Aynı alanlı daire: uzaklığa göre sıralı ilk n yanabilir hücre.
            n = int(tahmin.sum())
            daire = np.zeros_like(tahmin)
            if n:
                esik = np.partition(uzaklik[~np.isnan(uzaklik)], n - 1)[n - 1]
                daire = (uzaklik <= esik) & ref.kapsam
            satir[ad]["daire"] = _oranlar(daire, gozlenen, gercek)
        satirlar.append(satir)
    return {
        "senaryo": senaryo.ad,
        "gercek_ha": round(ref.gercek_ha),
        "calisma_sayisi": calisma,
        "saatler": satirlar,
    }


def _yuzde(x: float | None) -> str:
    return "  —" if x is None else f"{x * 100:3.0f}"


def tablo(sonuc: dict) -> str:
    satirlar = [
        f"{sonuc['senaryo']} (gerçek alan {sonuc['gercek_ha']:,} ha)",
        (
            f"{'saat':>4} {'gözlenen':>9} | {'bant':<6} {'alan':>8} {'yakalama':>8} {'isabet':>6}"
            f" | {'daire yak.':>10} {'daire is.':>9}"
        ),
    ]
    for s in sonuc["saatler"]:
        for ad in BANT_ADLARI:
            b = s[ad]
            satirlar.append(
                f"{s['saat']:>4} {s['gozlenen_ha']:>6,} ha | {ad:<6} {b['ha']:>5,} ha "
                f"{_yuzde(b['yakalama']):>7}% {_yuzde(b['isabet']):>5}% | "
                f"{_yuzde(b['daire']['yakalama']):>9}% {_yuzde(b['daire']['isabet']):>8}%"
            )
    return "\n".join(satirlar)


def main() -> None:
    sonuclar = [olc(s) for s in (MANAVGAT_2021, MARMARIS_2022)]
    yol = ISLENMIS_VERI_DIZINI / "senaryo_olcumu.json"
    yol.write_text(json.dumps(sonuclar, ensure_ascii=False, indent=2))
    for s in sonuclar:
        print(tablo(s), end="\n\n")
    print(f"Kaydedildi: {yol}")
