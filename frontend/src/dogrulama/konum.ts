/** Harita koordinatı ↔ Web Mercator raster hücresi. */

const mercatorY = (enlem: number) => Math.log(Math.tan(Math.PI / 4 + (enlem * Math.PI) / 360))

/**
 * [boylam, enlem] noktasının raster dizisindeki indeksi; raster dışındaysa null.
 * `koseler`: sol üst, sağ üst, sağ alt, sol alt (arka ucun gönderdiği sıra).
 */
export function hucreIndeksi(
  koseler: [number, number][],
  genislik: number,
  yukseklik: number,
  boylam: number,
  enlem: number,
): number | null {
  const [[bati, kuzey], [dogu], , [, guney]] = koseler
  const sutun = Math.floor(((boylam - bati) / (dogu - bati)) * genislik)
  const satir = Math.floor(((mercatorY(kuzey) - mercatorY(enlem)) / (mercatorY(kuzey) - mercatorY(guney))) * yukseklik)
  if (sutun < 0 || sutun >= genislik || satir < 0 || satir >= yukseklik) return null
  return satir * genislik + sutun
}
