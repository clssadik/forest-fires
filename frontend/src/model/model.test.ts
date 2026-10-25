import { describe, expect, it } from 'vitest'
import { gunAySaat } from '../bicim'
import { olay, tsi, yayilimParametreleri } from '../veri/ornekSenaryo'
import { havaDurumu, pusulaYonu } from './hava'
import { cepheMesafesiM, eksenNoktasi, varisZamaniSaat, yananAlanHa, yayilmaHiziMDk } from './yayilim'

const SAAT = 3_600_000

describe('yer tutucu yayılım modeli', () => {
  it('tutuşmadan önce alan sıfır, sonda toplam alana ulaşır', () => {
    expect(yananAlanHa(olay.baslangic - SAAT)).toBe(0)
    expect(yananAlanHa(olay.bitis)).toBeCloseTo(olay.toplamAlanHa, 0)
  })

  it('alan zamanla azalmaz', () => {
    let onceki = 0
    for (let t = olay.baslangic; t <= olay.bitis; t += SAAT) {
      const a = yananAlanHa(t)
      expect(a).toBeGreaterThanOrEqual(onceki)
      onceki = a
    }
  })

  it('yayılma hızı öğleden sonra geceden yüksek', () => {
    expect(yayilmaHiziMDk(tsi(2021, 7, 29, 15))).toBeGreaterThan(yayilmaHiziMDk(tsi(2021, 7, 29, 3)) * 2)
  })

  it('varış zamanı cephe mesafesiyle tutarlı', () => {
    const t = tsi(2021, 7, 29, 16)
    const ic = eksenNoktasi(cepheMesafesiM(t) * 0.5)
    const s = (t - olay.baslangic) / SAAT
    expect(varisZamaniSaat(ic.x, ic.z)).toBeLessThan(s)
    expect(varisZamaniSaat(yayilimParametreleri.tutusma.x, yayilimParametreleri.tutusma.z)).toBe(0)
    expect(varisZamaniSaat(60, 60)).toBe(Infinity)
  })
})

describe('yer tutucu hava modeli', () => {
  it('öğleden sonra gece yarısından sıcak ve kuru', () => {
    const gunduz = havaDurumu(tsi(2021, 7, 29, 15))
    const gece = havaDurumu(tsi(2021, 7, 30, 3))
    expect(gunduz.sicaklik).toBeGreaterThan(gece.sicaklik)
    expect(gunduz.nem).toBeLessThan(gece.nem)
    expect(gunduz.ruzgarKmSa).toBeGreaterThan(gece.ruzgarKmSa)
  })

  it('pusula yönleri Türkçe', () => {
    expect(pusulaYonu(0)).toBe('K')
    expect(pusulaYonu(225)).toBe('GB')
    expect(pusulaYonu(340)).toBe('KKB')
  })
})

describe('biçimleme', () => {
  it('tarihleri İstanbul saatiyle yazar', () => {
    expect(gunAySaat(tsi(2021, 7, 28, 12))).toBe('28 Tem 12:00')
  })
})
