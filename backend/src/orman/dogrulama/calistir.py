"""Model sürümlerini ve baseline'ları gerçek yangınla karşılaştırır; sonucu `dogrulama/` altına yazar.

    uv run orman-dogrula manavgat_2021              # 20 tohum
    uv run orman-dogrula manavgat_2021 --calisma 5

Deneyler: model v1, v2 (+ yakıt türü), v3 (+ nem, kalibre), v4 (+ söndürme), v5 (+ söndürmeden
kaçak), v6 (+ büyüme hızına bağlı söndürme) ve basit baseline'lar (rüzgârsız, eğimsiz, ikisi de yok, tutuşma merkezli
daire). Her deney için topluluk (çalıştırmaların en az yarısında yanan alan) ölçütleri ve
tohumlar arası ortalama ± sapma. Çıktılar `data/islenmis/<ad>/dogrulama/`: rapor.json,
firms_varis.tif ve görseller (rapor.py).
"""

import argparse
import json
import time
from dataclasses import asdict, dataclass, field, replace

import numpy as np

from orman.ayarlar import ISLENMIS_VERI_DIZINI
from orman.dogrulama.olcutler import Olcutler, Referans, buyume_egrisi, daire_toa, dogrula
from orman.model.calistir import tutusma_hucreleri, tutusma_hucresi, yaz_raster
from orman.model.yayilim import V2_YAKIT, Arazi, Parametreler, Ruzgar, coklu_yayilim, yayilim
from orman.senaryo import Senaryo
from orman.veri.bolge_paketi import SENARYOLAR, BolgePaketi, yukle

V1 = Parametreler()
V2 = V2_YAKIT  # v1 + yakıt türü (Alexandridis tablosu)
# v3: v2 + yakıt nemi, `orman-kalibre` ile Manavgat 2021'e ayarlı (2026-10-26, 200 deneme, en iyi
# aday 20 yeni tohumla seçildi). Eğim etkisi ~0'a, rüzgâr yönü etkisi düştü; bkz. docs/05 Adım 6.
V3 = replace(V2, hiz_olcegi=0.087, c1=0.126, c2=0.081, a=0.0, sonme_nemi=0.19)
# v4: v3 + söndürme vekili (2026-10-29): 6. saatten sonra p < 0,52 olan geçişler olmaz. Eşik
# Manavgat'ta elle tarandı (0,50–0,53 arası keskin geçiş; 0,525 biraz daha iyiydi, yuvarlak değer
# seçildi), Marmaris ayarsız. Bkz. docs/05, "durma ve kare şekli".
V4 = replace(V3, sondurme_esigi=0.52, sondurme_baslangic_dk=360.0)
# v5: eşik altı geçişlerin %20'si kaçar; v4 nemli gecede yangını kalıcı söndürüyordu (Marmaris
# 2.000 ha'da kaldı). Eşik 0,60 ve tutma 0,80 Manavgat'ta elle tarandı (0,58–0,65 × 0,75–0,85 bir
# sırt; yuvarlak değer), Marmaris ayarsız. Bkz. docs/05, "durma ve kare şekli".
V5 = replace(V4, sondurme_esigi=0.60, sondurme_olasiligi=0.80)
# v6: itfaiyenin gücü yangının büyüme hızına bağlı (2026-10-29). Son 60 dk'daki büyüme
# `sondurme_doygunluk_ha_sa`'ya yaklaşınca etkin tutma düşer; yavaş büyüyen yangında ekipler
# kenarları tutar. Eşik 0,58, tutma 0,85 ve doygunluk 26.500 ha/sa Manavgat 2021'de tarandı
# (6000–80800 × 0,55–0,70 × 0,80–0,95; en iyi aday 20 yeni tohumla doğrulandı),
# Marmaris ayarsız. Büyüme ~500–1000 ha/sa olduğundan etkin tutma ~0,82–0,85 arasında oynar;
# kazancın çoğu tutmanın 0,80'den yükselmesinden gelir (kuralsız sabit 0,84: Marmaris 8.584 ha,
# v6 6.016 ha). Model tutmaya çok duyarlı: sabit 0,82 → Manavgat 74 bin ha, 0,85 → 40 bin ha.
V6 = replace(
    V5,
    sondurme_esigi=0.58,
    sondurme_olasiligi=0.85,
    sondurme_doygunluk_ha_sa=26500.0,
)
GUNCEL_MODEL = "model_v6"  # web simülasyonu ve senaryo modunun kullandığı model
# Ad -> (açıklama, parametreler); None = daire baseline'ı (modelsiz).
DENEYLER: dict[str, tuple[str, Parametreler | None]] = {
    "model_v1": ("Model v1 (rüzgâr + eğim)", V1),
    "model_v2": ("Model v2 (+ yakıt türü)", V2),
    "model_v3": ("Model v3 (+ nem, kalibre)", V3),
    "model_v4": ("Model v4 (+ söndürme)", V4),
    "model_v5": ("Model v5 (+ söndürmeden kaçak)", V5),
    "model_v6": ("Model v6 (+ büyümeye bağlı söndürme)", V6),
    "ruzgarsiz": ("Rüzgârsız model", replace(V1, c1=0.0, c2=0.0)),
    "egimsiz": ("Eğimsiz model", replace(V1, a=0.0)),
    "ruzgarsiz_egimsiz": ("Rüzgârsız ve eğimsiz model", replace(V1, c1=0.0, c2=0.0, a=0.0)),
    "daire": ("Daire (tutuşma merkezli, eşit alan)", None),
}
BUYUME_SAATLERI = list(range(0, 160, 2))
# Tohumlar arası ortalama ± sapma verilen ölçütler: (ad, Olcutler'den okuma)
TOHUM_OLCUTLERI = {
    "esit_alan_iou": lambda o: o.esit_alan.iou,
    "esit_alan_kappa": lambda o: o.esit_alan.kappa,
    "esit_alan_saat": lambda o: o.esit_alan_saat,
    "bitis_iou": lambda o: o.bitis.iou,
    "bitis_dice": lambda o: o.bitis.dice,
    "bitis_kappa": lambda o: o.bitis.kappa,
    "bitis_model_ha": lambda o: o.bitis.model_ha,
    "zaman_ortanca_saat": lambda o: o.zaman.ortanca_saat,
}


@dataclass
class DeneySonucu:
    ad: str
    aciklama: str
    topluluk: Olcutler
    toa: np.ndarray  # topluluk TOA'sı (daire: uzaklık, m)
    tohumlar: dict[str, dict[str, float]]  # ölçüt -> {"ortalama", "sapma"}
    buyume_ha: list[float] | None
    olasilik: np.ndarray | None = None  # hücrenin yandığı tohum oranı (yalnız model deneyleri)

    def sozluk(self) -> dict:
        return {
            "ad": self.ad,
            "aciklama": self.aciklama,
            "topluluk": asdict(self.topluluk),
            "tohumlar": self.tohumlar,
            "buyume_ha": self.buyume_ha,
        }


def _tohum_ozeti(olcutler: list[Olcutler]) -> dict[str, dict[str, float]]:
    ozet = {}
    for ad, oku in TOHUM_OLCUTLERI.items():
        degerler = np.array([oku(o) for o in olcutler], dtype=np.float64)
        ozet[ad] = {"ortalama": float(np.nanmean(degerler)), "sapma": float(np.nanstd(degerler))}
    return ozet


@dataclass
class DeneyOrtami:
    """Bir senaryonun deneyler arasında ortak girdileri (paket, referans, arazi, rüzgâr).

    `tutusma`: ana tutuşma hücresi (daire baseline'ı, olay ekranı). `tutusmalar`: modelin
    kullandığı bütün tutuşmalar (satır, sütun, dk); boşsa yalnızca ana tutuşma.
    """

    paket: BolgePaketi
    referans: Referans
    arazi: Arazi
    ruzgar: Ruzgar
    tutusma: tuple[int, int]
    tutusmalar: list[tuple[int, int, float]] = field(default_factory=list)

    @property
    def model_tutusmalari(self) -> list:
        return self.tutusmalar or [self.tutusma]

    @classmethod
    def hazirla(cls, senaryo: Senaryo) -> "DeneyOrtami":
        paket = yukle(senaryo)
        ortam = cls(
            paket=paket,
            referans=Referans.paketten(paket),
            arazi=Arazi.paketten(paket),
            ruzgar=Ruzgar.hava_alanindan(paket.hava_alani(), senaryo.tutusma_utc),
            tutusma=tutusma_hucresi(paket),
            tutusmalar=tutusma_hucreleri(paket),
        )
        yayilim(ortam.arazi, ortam.ruzgar, [ortam.tutusma], V1, 0, 1.0)  # Numba derlemesi
        return ortam


def model_deneyi(
    ortam: DeneyOrtami,
    ad: str,
    aciklama: str,
    parametreler: Parametreler,
    calisma: int,
    ilk_tohum: int = 0,
    is_parcacigi: int | None = None,
) -> DeneySonucu:
    """Modeli `calisma` tohumla çalıştırır; topluluk TOA'sını ve ölçütleri döndürür."""
    referans = ortam.referans
    sonuc = coklu_yayilim(
        ortam.arazi,
        ortam.ruzgar,
        ortam.model_tutusmalari,
        parametreler,
        range(ilk_tohum, ilk_tohum + calisma),
        referans.bitis_dk,
        is_parcacigi=is_parcacigi,
    )
    tek_tek = [dogrula(t, referans) for t in sonuc.toalar]
    return DeneySonucu(
        ad=ad,
        aciklama=aciklama,
        topluluk=dogrula(sonuc.toa_topluluk, referans),
        toa=sonuc.toa_topluluk,
        tohumlar=_tohum_ozeti(tek_tek),
        buyume_ha=buyume_egrisi(
            sonuc.toa_topluluk, referans.kapsam, BUYUME_SAATLERI, referans.hucre_ha
        ),
        olasilik=sonuc.olasilik,
    )


def deneyleri_calistir(
    senaryo: Senaryo, calisma: int = 20
) -> tuple[list[DeneySonucu], Referans, BolgePaketi]:
    ortam = DeneyOrtami.hazirla(senaryo)
    sonuclar = []
    for ad, (aciklama, parametreler) in DENEYLER.items():
        if parametreler is None:
            toa = daire_toa(ortam.tutusma, ortam.paket.yanabilir, senaryo.izgara.cozunurluk)
            sonuclar.append(
                DeneySonucu(
                    ad, aciklama, dogrula(toa, ortam.referans, zamanli=False), toa, {}, None
                )
            )
            continue
        sonuclar.append(model_deneyi(ortam, ad, aciklama, parametreler, calisma))
    return sonuclar, ortam.referans, ortam.paket


def _tablo(sonuclar: list[DeneySonucu]) -> str:
    # Ana ölçüt: bitişte Sørensen (daire: gerçek alanla aynı büyüklükte, yani bitişi eşit alandır).
    satirlar = [
        (
            f"{'Deney':<36} {'Sørensen':>8} {'Yakalama':>8} {'İsabet':>7} {'IoU (eş.)':>9} "
            f"{'Alan (bitiş)':>12} {'Zaman farkı':>11}"
        )
    ]
    for s in sonuclar:
        o = s.topluluk
        b = o.bitis or o.esit_alan
        bitis = (
            f"{o.bitis.model_ha:>9,.0f} ha {o.zaman.ortanca_saat:>+9.1f} sa"
            if o.bitis
            else f"{'—':>12} {'—':>11}"
        )
        satirlar.append(
            f"{s.aciklama:<36} {b.dice:>8.1%} {b.duyarlilik:>8.1%} {b.isabet:>7.1%} "
            f"{o.esit_alan.iou:>9.3f} {bitis}"
        )
    return "\n".join(satirlar)


def calistir(senaryo: Senaryo, calisma: int = 20) -> dict:
    from orman.dogrulama.rapor import gorselleri_yaz  # matplotlib yalnızca rapor için

    baslangic = time.perf_counter()
    sonuclar, referans, paket = deneyleri_calistir(senaryo, calisma)
    d = ISLENMIS_VERI_DIZINI / senaryo.ad / "dogrulama"
    d.mkdir(parents=True, exist_ok=True)
    yaz_raster(d / "firms_varis.tif", referans.firms_toa, senaryo)
    firms_ha = buyume_egrisi(
        referans.firms_toa, referans.kapsam, BUYUME_SAATLERI, referans.hucre_ha
    )
    yollar = gorselleri_yaz(sonuclar, referans, paket, BUYUME_SAATLERI, firms_ha, d)
    rapor = {
        "senaryo": senaryo.ad,
        "calisma_sayisi": calisma,
        "gercek_ha": round(referans.gercek_ha),
        "firms_gordugu_gercek_ha": round(
            float(np.count_nonzero(~np.isnan(referans.firms_toa))) * referans.hucre_ha
        ),
        "bitis_saat": referans.bitis_dk / 60.0,
        "buyume_saatleri": BUYUME_SAATLERI,
        "firms_buyume_ha": firms_ha,
        "deneyler": [s.sozluk() for s in sonuclar],
        "gorseller": {ad: yol.name for ad, yol in yollar.items()},
        "sure_sn": round(time.perf_counter() - baslangic, 1),
    }
    (d / "rapor.json").write_text(json.dumps(rapor, ensure_ascii=False, indent=2))
    rapor["tablo"] = _tablo(sonuclar)
    return rapor


def main() -> None:
    ayristirici = argparse.ArgumentParser(
        description="Modeli ve baseline'ları gerçek yanmış alanla karşılaştırır."
    )
    ayristirici.add_argument("senaryo", choices=sorted(SENARYOLAR))
    ayristirici.add_argument("--calisma", type=int, default=20, help="tohum sayısı (varsayılan 20)")
    secim = ayristirici.parse_args()
    rapor = calistir(SENARYOLAR[secim.senaryo], secim.calisma)
    print(rapor["tablo"])
    print(
        f"\nGerçek alan {rapor['gercek_ha']:,} ha. eş. = alan eşitlenmiş; zaman farkı: model − FIRMS "
        f"(ortanca, + = model geç). Rapor: {ISLENMIS_VERI_DIZINI / secim.senaryo / 'dogrulama'}"
    )
