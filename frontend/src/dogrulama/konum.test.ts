import { describe, expect, it } from 'vitest'
import { hucreIndeksi } from './konum'

const koseler: [number, number][] = [
  [31, 37],
  [32, 37],
  [32, 36],
  [31, 36],
]

describe('hucreIndeksi', () => {
  it('köşeler ve dışı', () => {
    expect(hucreIndeksi(koseler, 10, 10, 31.0001, 36.9999)).toBe(0)
    expect(hucreIndeksi(koseler, 10, 10, 31.9999, 36.0001)).toBe(99)
    expect(hucreIndeksi(koseler, 10, 10, 30.9, 36.5)).toBeNull()
    expect(hucreIndeksi(koseler, 10, 10, 31.5, 37.1)).toBeNull()
  })

  it('enlem Mercator ölçeğinde: orta enlem satırların tam ortasında değil', () => {
    // Mercator'da kuzey yarı daha uzun; 36,5° enlemi ortadan biraz aşağıda (satır 5) kalır.
    const i = hucreIndeksi(koseler, 1, 1000, 31.5, 36.5)!
    expect(i).toBeGreaterThan(500)
    expect(i).toBeLessThan(510)
  })
})
