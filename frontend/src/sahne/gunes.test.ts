import { describe, expect, it } from 'vitest'
import { gokRenkleri, gunesKonumu, gunesYonu } from './gunes'

// Manavgat, 28 Temmuz 2021
const ENLEM = 36.9
const BOYLAM = 31.5

describe('gunesKonumu', () => {
  it('öğlen güneşi güneyde ve yüksekte (90 − enlem + sapma ≈ 72°)', () => {
    const g = gunesKonumu(Date.parse('2021-07-28T10:00:00Z'), ENLEM, BOYLAM)
    expect(g.yukseklik).toBeGreaterThan(70)
    expect(g.yukseklik).toBeLessThan(74)
    expect(Math.abs(g.azimut - 180)).toBeLessThan(12)
  })

  it('akşam batıda batıyor, gece ufkun altında', () => {
    const aksam = gunesKonumu(Date.parse('2021-07-28T16:30:00Z'), ENLEM, BOYLAM)
    expect(aksam.yukseklik).toBeGreaterThan(-3)
    expect(aksam.yukseklik).toBeLessThan(8)
    expect(aksam.azimut).toBeGreaterThan(280)
    expect(aksam.azimut).toBeLessThan(305)
    expect(gunesKonumu(Date.parse('2021-07-28T21:00:00Z'), ENLEM, BOYLAM).yukseklik).toBeLessThan(-20)
  })

  it('yön vektörü birim uzunlukta; doğu +x, güney +z', () => {
    const [x, y, z] = gunesYonu({ yukseklik: 0, azimut: 90 })
    expect(x).toBeCloseTo(1)
    expect(y).toBeCloseTo(0)
    expect(z).toBeCloseTo(0)
    expect(gunesYonu({ yukseklik: 0, azimut: 180 })[2]).toBeCloseTo(1)
  })
})

describe('gokRenkleri', () => {
  it('gündüz ışık geceden güçlü, ufuk tepeden açık', () => {
    const gun = gokRenkleri(50)
    const gece = gokRenkleri(-30)
    expect(gun.isikSiddeti).toBeGreaterThan(gece.isikSiddeti * 3)
    expect(gun.ufuk.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(gun.tepe.getHSL({ h: 0, s: 0, l: 0 }).l)
  })
})
