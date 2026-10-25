"""NASA FIRMS aktif yangın tespitleri (https://firms.modaps.eosdis.nasa.gov/api/area/).

Tarihsel yangınlar için standart işlenmiş (SP) kaynaklar kullanılır. API bir istekte
en fazla 5 gün döndürür; daha uzun aralıklar parçalara bölünür.
"""

import io
from datetime import date, timedelta

import pandas as pd
import requests

from orman.ayarlar import ayar

API = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
TARIHSEL_KAYNAKLAR = ("VIIRS_SNPP_SP", "VIIRS_NOAA20_SP", "MODIS_SP")
EN_FAZLA_GUN = 5

BBox = tuple[float, float, float, float]  # (batı, güney, doğu, kuzey), WGS84


def _gun_parcalari(baslangic: date, bitis: date) -> list[tuple[date, int]]:
    """[baslangic, bitis] aralığını en fazla 5 günlük (başlangıç, gün sayısı) parçalarına böler."""
    parcalar = []
    gun = baslangic
    while gun <= bitis:
        sayi = min(EN_FAZLA_GUN, (bitis - gun).days + 1)
        parcalar.append((gun, sayi))
        gun += timedelta(days=sayi)
    return parcalar


def tespitleri_indir(
    bbox: BBox, baslangic: date, bitis: date, kaynaklar: tuple[str, ...] = TARIHSEL_KAYNAKLAR
) -> pd.DataFrame:
    """Kutudaki tüm tespitleri tek tabloda döndürür; `zaman_utc` ve `kaynak` sütunları eklenir."""
    anahtar = ayar("FIRMS_MAP_KEY")
    alan = ",".join(f"{v:g}" for v in bbox)
    tablolar = []
    for kaynak in kaynaklar:
        for gun, sayi in _gun_parcalari(baslangic, bitis):
            yanit = requests.get(f"{API}/{anahtar}/{kaynak}/{alan}/{sayi}/{gun.isoformat()}", timeout=60)
            if yanit.status_code != 200 or not yanit.text.startswith("latitude"):
                # Anahtar URL'de olduğu için URL'yi hataya yazmıyoruz.
                raise RuntimeError(f"FIRMS {kaynak} {gun}: {yanit.status_code} {yanit.text[:200]}")
            tablo = pd.read_csv(io.StringIO(yanit.text))
            if not tablo.empty:
                tablo["kaynak"] = kaynak
                tablolar.append(tablo)
    if not tablolar:
        return pd.DataFrame()
    tum = pd.concat(tablolar, ignore_index=True)
    saat = tum["acq_time"].astype(int).astype(str).str.zfill(4)
    tum["zaman_utc"] = pd.to_datetime(tum["acq_date"] + " " + saat, format="%Y-%m-%d %H%M", utc=True)
    return tum.sort_values("zaman_utc", ignore_index=True)
