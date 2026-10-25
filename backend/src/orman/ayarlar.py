"""Proje yolları ve gizli ayarlar (backend/.env)."""

import os
from pathlib import Path

BACKEND_DIZINI = Path(__file__).resolve().parents[2]
PROJE_DIZINI = BACKEND_DIZINI.parent
VERI_DIZINI = PROJE_DIZINI / "data"
HAM_VERI_DIZINI = VERI_DIZINI / "ham"  # kaynaktan indirildiği gibi
ISLENMIS_VERI_DIZINI = VERI_DIZINI / "islenmis"  # ortak model ızgarasına oturtulmuş


def _env_dosyasini_oku(yol: Path) -> dict[str, str]:
    """`ANAHTAR=deger` satırlarını okur; boşlukları ve tırnakları temizler."""
    degerler: dict[str, str] = {}
    if not yol.exists():
        return degerler
    for satir in yol.read_text(encoding="utf-8").splitlines():
        satir = satir.strip()
        if not satir or satir.startswith("#") or "=" not in satir:
            continue
        anahtar, deger = satir.split("=", 1)
        degerler[anahtar.strip()] = deger.strip().strip("'\"")
    return degerler


def ayar(anahtar: str) -> str:
    """Önce ortam değişkenine, sonra backend/.env dosyasına bakar."""
    deger = os.environ.get(anahtar) or _env_dosyasini_oku(BACKEND_DIZINI / ".env").get(anahtar)
    if not deger:
        raise RuntimeError(
            f"{anahtar} tanımlı değil. backend/.env.example dosyasını backend/.env "
            "olarak kopyalayıp değeri doldurun."
        )
    return deger
