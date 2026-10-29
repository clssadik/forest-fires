/**
 * Kullanıcının yangın başına notu. Yalnızca bu tarayıcıda (localStorage) durur, sunucuya gitmez.
 * Depolama kapalıysa (gizli pencere, engellenmiş site verisi) okuma boş, yazma `false` döner.
 */

const anahtar = (ad: string) => `orman.not.${ad}`

export function notOku(ad: string, depo: Storage | undefined = globalThis.localStorage): string {
  try {
    return depo?.getItem(anahtar(ad)) ?? ''
  } catch {
    return ''
  }
}

/** Boş not anahtarı siler. Yazılabildiyse `true`. */
export function notYaz(ad: string, metin: string, depo: Storage | undefined = globalThis.localStorage): boolean {
  try {
    if (!depo) return false
    if (metin.trim()) depo.setItem(anahtar(ad), metin)
    else depo.removeItem(anahtar(ad))
    return true
  } catch {
    return false
  }
}
