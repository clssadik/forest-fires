import { SAAT_DILIMI } from './veri/ornekSenaryo'

/** Türkçe sayı ve tarih biçimleyicileri (tr-TR, 24 saat, Europe/Istanbul). */

const sayiBicimleri = [0, 1, 2].map((d) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: d }))
const yuzde = new Intl.NumberFormat('tr-TR', { style: 'percent', maximumFractionDigits: 0 })

export const sayi = (n: number, ondalik = 0) => sayiBicimleri[Math.min(Math.max(ondalik, 0), 2)].format(n)
export const yuzdeBicim = (oran: number) => yuzde.format(oran)

const parca = (secenek: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('tr-TR', { timeZone: SAAT_DILIMI, hourCycle: 'h23', ...secenek })

const gunAyF = parca({ day: 'numeric', month: 'short' })
const saatF = parca({ hour: '2-digit', minute: '2-digit' })
const gunAyYilF = parca({ day: 'numeric', month: 'short', year: 'numeric' })

/** "28 Tem" */
export const gunAy = (t: number) => gunAyF.format(t)
/** "12:00" */
export const saat = (t: number) => saatF.format(t)
/** "28 Tem 12:00" */
export const gunAySaat = (t: number) => `${gunAy(t)} ${saat(t)}`
/** "28 Tem 2021" */
export const gunAyYil = (t: number) => gunAyYilF.format(t)
/** "28 Tem 2021 12:00" */
export const tamTarih = (t: number) => `${gunAyYil(t)} ${saat(t)}`

/** Grafik ekseni için "yuvarlak" adım: en fazla ~5 çizgi (10, 50, 100, …, 50.000, 100.000). */
export const eksenAdimi = (enBuyuk: number) =>
  [10, 50, 100, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000].find((a) => enBuyuk / a <= 5) ?? 100_000
