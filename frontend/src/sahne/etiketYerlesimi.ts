/** Eksen etiketlerinin ekrandaki yerleşim kuralları. */

/** Tutuşma etiketi izokron etiketiyle bu kadar yakınsa (px) ikisi çakışır: kutu boyları + pay. */
const YATAY_PAY_PX = 170
const DIKEY_PAY_PX = 44

/** Geçilmiş son izokron saati; hiçbiri geçilmediyse null. */
export function sonGecilenSaat(saatler: number[], gecen: number): number | null {
  const gecilen = saatler.filter((s) => s <= gecen)
  return gecilen.length ? Math.max(...gecilen) : null
}

/** dx, dy: iki etiketin ekrandaki bağlantı noktaları arasındaki fark (px). */
export const etiketlerCakisir = (dx: number, dy: number) => Math.abs(dx) < YATAY_PAY_PX && Math.abs(dy) < DIKEY_PAY_PX
