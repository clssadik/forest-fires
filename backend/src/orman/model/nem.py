"""Ölü ince yakıt nemi ve yayılmaya etkisi (model v3).

Denge nemi (EMC): Simard (1968) bağıntısı, sıcaklık ve bağıl nemden (Fosberg yangın hava indeksi
de bunu kullanır). İnce yakıt (1 saatlik) havayla bir saat içinde dengeye geldiği için yakıt nemi
yerine denge nemi kullanılır.

Nem sönümü: Rothermel (1972) η_M = 1 − 2,59 r + 5,11 r² − 3,52 r³, r = M / M_x (M_x: sönme nemi).
Yayılma hızı η_M ile çarpılır; gece nem artınca yangın yavaşlar, M ≥ M_x olunca yayılmaz.
"""

import numpy as np
from numba import njit


def denge_nemi(sicaklik_c, bagil_nem):
    """Denge nemi (kuru ağırlığa oran, ör. 0,05 = %5). Simard (1968); formülde sıcaklık °F."""
    t = np.asarray(sicaklik_c, dtype=np.float64) * 1.8 + 32.0
    h = np.clip(np.asarray(bagil_nem, dtype=np.float64), 0.0, 100.0)
    yuzde = np.where(
        h < 10.0,
        0.03229 + 0.281073 * h - 0.000578 * h * t,
        np.where(
            h < 50.0,
            2.22749 + 0.160107 * h - 0.01478 * t,
            21.0606 + 0.005565 * h**2 - 0.00035 * h * t - 0.483199 * h,
        ),
    )
    return np.maximum(yuzde, 0.0) / 100.0


@njit(cache=True, nogil=True)
def nem_sonumu(nem: float, sonme_nemi: float) -> float:
    """Rothermel nem sönüm katsayısı (0–1). `sonme_nemi` ≤ 0 ise etki kapalıdır (1 döner)."""
    if sonme_nemi <= 0.0:
        return 1.0
    r = nem / sonme_nemi
    if r >= 1.0:
        return 0.0
    r = max(r, 0.0)
    return max(1.0 - 2.59 * r + 5.11 * r * r - 3.52 * r * r * r, 0.0)
