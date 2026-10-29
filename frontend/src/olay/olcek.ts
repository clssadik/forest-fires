/** Zaman şeritlerinin dikey ölçeği. */

/** Eksen üst sınırı için "güzel" yuvarlama (1, 1,5, 2, 2,5 … × 10^n). */
export function guzelUst(v: number) {
  if (!(v > 0)) return 1
  const us = 10 ** Math.floor(Math.log10(v))
  for (const k of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * us >= v) return k * us
  return 10 * us
}

/**
 * Tek tük sıçramaların ölçeği ezmemesi için üst sınır: değerlerin `yuzdelik` dilimi (ör. 0,98),
 * biraz pay bırakılıp yuvarlanır. Bunun üstündeki değerler şeridin tepesinde kırpılır. Manavgat'ta
 * cephe hızı ilk saatlerde ek tutuşmalar yüzünden ~150 m/dk'ya sıçrıyor; gerisi 0–10 m/dk.
 */
export function kirpilmisUst(degerler: number[], yuzdelik = 0.98) {
  const sirali = degerler.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sirali.length) return 1
  const v = sirali[Math.min(Math.floor(yuzdelik * (sirali.length - 1)), sirali.length - 1)]
  return guzelUst(v * 1.15)
}
