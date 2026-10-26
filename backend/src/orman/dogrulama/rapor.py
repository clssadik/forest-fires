"""Doğrulama raporunun görselleri (matplotlib, PNG).

- harita.png: doğru tahmin / yanlış alarm / kaçırılan alan; model v1 (alan eşitlenmiş ve bitişte)
  ve daire baseline'ı, gölgeli arazi üzerinde.
- buyume.png: yanan alan – zaman eğrileri (deneyler ve FIRMS'ten türetilen gözlem).
- karsilastirma.png: deneylerin IoU değerleri (alan eşitlenmiş ve bitişte), tohum sapmasıyla.
- zaman_farki.png: model v1'in FIRMS'e göre varış farkı dağılımı.

Renkler dataviz skill'inin doğrulanmış varsayılan paletinden (açık tema).
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch

from orman.dogrulama.olcutler import YAKIN_FARK_SAAT
from orman.model.calistir import tutusma_hucresi
from orman.veri.bolge_paketi import golgelendirme

YUZEY = "#fcfcfb"
METIN = "#0b0b0b"
IKINCIL_METIN = "#52514e"
IZGARA_CIZGISI = "#e4e3df"
SERILER = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]  # sabit sıra
# Karışıklık sınıfları: sırasıyla doğru, yanlış alarm, kaçırılan (ilk üç slot, tüm çiftler geçer).
DOGRU, YANLIS_ALARM, KACIRILAN = SERILER[0], SERILER[1], SERILER[2]
DENIZ = "#dfe8ef"
DPI = 150
KENAR_HUCRE = 60  # haritayı ilgili alana kırparken bırakılan pay

plt.rcParams.update(
    {
        "figure.facecolor": YUZEY,
        "axes.facecolor": YUZEY,
        "savefig.facecolor": YUZEY,
        "text.color": METIN,
        "axes.labelcolor": IKINCIL_METIN,
        "axes.edgecolor": IZGARA_CIZGISI,
        "xtick.color": IKINCIL_METIN,
        "ytick.color": IKINCIL_METIN,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "font.size": 10,
        "axes.titlesize": 11,
        "axes.titleweight": "bold",
        "axes.titlelocation": "left",
    }
)


def _ha(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".") + " ha"


def _sayi(x: float, basamak: int = 2) -> str:
    return f"{x:.{basamak}f}".replace(".", ",")


def _karisiklik_rgb(golge, deniz, tahmin, gercek) -> np.ndarray:
    gri = 0.55 + 0.45 * golge[..., None]
    rgb = np.repeat(gri, 3, axis=-1)
    rgb[deniz] = matplotlib.colors.to_rgb(DENIZ)
    for maske, renk in ((tahmin & gercek, DOGRU), (tahmin & ~gercek, YANLIS_ALARM),
                        (~tahmin & gercek, KACIRILAN)):  # fmt: skip
        rgb[maske] = 0.2 * rgb[maske] + 0.8 * np.array(matplotlib.colors.to_rgb(renk))
    return rgb


def _harita(sonuclar, referans, paket, yol: Path) -> Path:
    s = {x.ad: x for x in sonuclar}
    v1, daire = s["model_v1"], s["daire"]
    paneller = [
        ("Model v1 · alan eşitlenmiş", v1.toa <= v1.topluluk.esit_alan_esik, v1.topluluk.esit_alan,
         f"{_sayi(v1.topluluk.esit_alan_saat, 0)}. saat"),
        ("Model v1 · bitişte", ~np.isnan(v1.toa), v1.topluluk.bitis,
         f"{_sayi(referans.bitis_dk / 60, 0)}. saat"),
        ("Daire · alan eşitlenmiş", daire.toa <= daire.topluluk.esit_alan_esik,
         daire.topluluk.esit_alan, f"yarıçap {_sayi(daire.topluluk.esit_alan_esik / 1000, 1)} km"),
    ]  # fmt: skip
    ilgili = referans.gercek | paneller[1][1] | paneller[2][1]
    satirlar, sutunlar = np.nonzero(ilgili)
    r0, r1 = max(satirlar.min() - KENAR_HUCRE, 0), satirlar.max() + KENAR_HUCRE
    c0, c1 = max(sutunlar.min() - KENAR_HUCRE, 0), sutunlar.max() + KENAR_HUCRE
    kes = np.s_[r0:r1, c0:c1]

    golge = golgelendirme(paket.yukseklik, paket.senaryo.izgara.cozunurluk)
    deniz = ~paket.gecerli | (np.nan_to_num(paket.yukseklik) <= 0)
    tr, tc = tutusma_hucresi(paket)
    oran = (r1 - r0) / (c1 - c0)
    sekil, eksenler = plt.subplots(1, 3, figsize=(15, 5 * oran + 2.4))
    for ax, (baslik, tahmin, olcut, an) in zip(eksenler, paneller):
        ax.imshow(_karisiklik_rgb(golge[kes], deniz[kes], tahmin[kes], referans.gercek[kes]),
                  interpolation="nearest")  # fmt: skip
        ax.plot(tc - c0, tr - r0, marker="*", ms=14, color=METIN, mec=YUZEY, mew=1.5)
        ax.set_title(f"{baslik} ({an})")
        ax.set_xticks([])
        ax.set_yticks([])
        for kenar in ax.spines.values():
            kenar.set_visible(False)
        ax.text(0.0, -0.02, f"IoU {_sayi(olcut.iou)} · Kappa {_sayi(olcut.kappa)}",
                transform=ax.transAxes, va="top", fontsize=10, fontweight="bold")  # fmt: skip
        ax.legend(
            handles=[
                Patch(color=DOGRU, label=f"Doğru tahmin: {_ha(olcut.dogru_ha)}"),
                Patch(color=YANLIS_ALARM, label=f"Yanlış alarm: {_ha(olcut.yanlis_alarm_ha)}"),
                Patch(color=KACIRILAN, label=f"Kaçırılan: {_ha(olcut.kacirilan_ha)}"),
            ],
            loc="upper left", bbox_to_anchor=(0, -0.07), frameon=False, fontsize=9,
        )  # fmt: skip
    sekil.suptitle(
        f"Manavgat 2021: model ve gerçek yanmış alan (Sentinel-2, {_ha(referans.gercek_ha)})"
        "   ★ tutuşma noktası",
        x=0.01, ha="left", fontsize=13, fontweight="bold",
    )  # fmt: skip
    sekil.subplots_adjust(left=0.01, right=0.99, top=0.84, bottom=0.25, wspace=0.04)
    sekil.savefig(yol, dpi=DPI)
    plt.close(sekil)
    return yol


def _buyume(sonuclar, referans, saatler, firms_ha, yol: Path) -> Path:
    sekil, ax = plt.subplots(figsize=(9, 5.2))
    ax.grid(axis="y", color=IZGARA_CIZGISI, lw=0.8)
    ax.set_axisbelow(True)
    ax.axhline(referans.gercek_ha, color=IKINCIL_METIN, lw=1, ls=(0, (4, 3)))
    ax.text(saatler[-1], referans.gercek_ha, " gerçek alan", va="center", fontsize=9,
            color=IKINCIL_METIN)  # fmt: skip
    ax.plot(saatler, firms_ha, color=METIN, lw=2.5, label="Gözlem (FIRMS ayak izleri)")
    zamanli = [s for s in sonuclar if s.buyume_ha]
    for renk, s in zip(SERILER, zamanli):
        ax.plot(saatler, s.buyume_ha, color=renk, lw=2, label=s.aciklama)
    ax.set_xlim(0, saatler[-1])
    ax.set_ylim(0, max(max(s.buyume_ha) for s in zamanli) * 1.05)
    ax.yaxis.set_major_formatter(lambda y, _: f"{y / 1000:.0f} bin")
    ax.set_xlabel("Tutuşmadan bu yana saat")
    ax.set_ylabel("Yanan alan (ha)")
    ax.set_xticks(range(0, saatler[-1] + 1, 24))
    ax.set_title("Yanan alan – zaman: gözlem ve modeller")
    ax.legend(frameon=False, loc="upper left", fontsize=9)
    sekil.tight_layout()
    sekil.savefig(yol, dpi=DPI)
    plt.close(sekil)
    return yol


def _karsilastirma(sonuclar, yol: Path) -> Path:
    adlar = [s.aciklama for s in sonuclar][::-1]
    sekil, eksenler = plt.subplots(1, 2, figsize=(11, 3.6), sharey=True)
    for ax, (baslik, olcut, anahtar) in zip(eksenler, [
        ("IoU · alan eşitlenmiş (şekil)", lambda o: o.esit_alan.iou, "esit_alan_iou"),
        ("IoU · bitişte", lambda o: o.bitis.iou if o.bitis else np.nan, "bitis_iou"),
    ]):  # fmt: skip
        degerler = [olcut(s.topluluk) for s in sonuclar][::-1]
        sapmalar = [s.tohumlar.get(anahtar, {}).get("sapma", 0.0) for s in sonuclar][::-1]
        renkler = [SERILER[0] if s.ad.startswith("model_") else "#9ec5f4" for s in sonuclar][::-1]
        y = np.arange(len(adlar))
        ax.barh(y, np.nan_to_num(degerler), height=0.6, color=renkler, xerr=sapmalar,
                error_kw={"ecolor": METIN, "lw": 1, "capsize": 3})  # fmt: skip
        for yi, d in zip(y, degerler):
            metin = "—" if np.isnan(d) else _sayi(d, 3)
            ax.text((0 if np.isnan(d) else d) + 0.01, yi, metin, va="center", fontsize=9)
        ax.set_yticks(y, adlar)
        ax.set_xlim(0, 0.6)
        ax.xaxis.set_major_formatter(lambda x, _: _sayi(x, 1))
        ax.grid(axis="x", color=IZGARA_CIZGISI, lw=0.8)
        ax.set_axisbelow(True)
        ax.set_title(baslik)
    sekil.text(0.01, 0.01, "Hata çubukları: 20 tohum arası standart sapma. Daire zaman taşımaz.",
               fontsize=8, color=IKINCIL_METIN)  # fmt: skip
    sekil.tight_layout(rect=(0, 0.05, 1, 1))
    sekil.savefig(yol, dpi=DPI)
    plt.close(sekil)
    return yol


def _zaman_farki(sonuc, referans, yol: Path) -> Path:
    toa = np.where(sonuc.toa <= referans.bitis_dk, sonuc.toa, np.nan)
    ikisi = ~np.isnan(referans.firms_toa) & ~np.isnan(toa)
    fark = (toa[ikisi] - referans.firms_toa[ikisi]) / 60.0
    z = sonuc.topluluk.zaman
    sekil, ax = plt.subplots(figsize=(9, 4.5))
    agirlik = np.full(fark.size, referans.hucre_ha)
    ax.hist(fark, bins=np.arange(-96, 156, 6), weights=agirlik, color=SERILER[0],
            edgecolor=YUZEY, linewidth=1)  # fmt: skip
    ax.axvspan(-YAKIN_FARK_SAAT, YAKIN_FARK_SAAT, color=IZGARA_CIZGISI, alpha=0.6, zorder=0)
    ax.axvline(z.ortanca_saat, color=METIN, lw=1.5)
    ax.text(z.ortanca_saat, ax.get_ylim()[1] * 0.97, f"  ortanca {_sayi(z.ortanca_saat, 1)} sa",
            va="top", fontsize=9)  # fmt: skip
    ax.yaxis.set_major_formatter(lambda y, _: f"{y:,.0f}".replace(",", "."))
    ax.set_xlabel("Model varışı − FIRMS varışı (saat; + = model geç)")
    ax.set_ylabel("Alan (ha)")
    ax.grid(axis="y", color=IZGARA_CIZGISI, lw=0.8)
    ax.set_axisbelow(True)
    ax.set_title(
        f"Model v1 varış zamanı hatası · ±{YAKIN_FARK_SAAT:.0f} saat içinde: "
        f"%{z.oran_12_saat_icinde * 100:.0f} · model hiç yakmadı: %{z.yanmayan_oran * 100:.0f}"
    )
    sekil.tight_layout()
    sekil.savefig(yol, dpi=DPI)
    plt.close(sekil)
    return yol


def gorselleri_yaz(sonuclar, referans, paket, saatler, firms_ha, d: Path) -> dict[str, Path]:
    v1 = next(s for s in sonuclar if s.ad == "model_v1")
    return {
        "harita": _harita(sonuclar, referans, paket, d / "harita.png"),
        "buyume": _buyume(sonuclar, referans, saatler, firms_ha, d / "buyume.png"),
        "karsilastirma": _karsilastirma(sonuclar, d / "karsilastirma.png"),
        "zaman_farki": _zaman_farki(v1, referans, d / "zaman_farki.png"),
    }
