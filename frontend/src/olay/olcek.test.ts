import { describe, expect, it } from 'vitest'
import { guzelUst, kirpilmisUst } from './olcek'

describe('guzelUst', () => {
  it('bir üst güzel sayıya yuvarlar', () => {
    expect(guzelUst(99_161)).toBe(100_000)
    expect(guzelUst(21.4)).toBe(25)
    expect(guzelUst(7)).toBe(8)
  })
  it('sıfır ve eksi değerde 1 döner', () => {
    expect(guzelUst(0)).toBe(1)
    expect(guzelUst(-5)).toBe(1)
  })
})

describe('kirpilmisUst', () => {
  it('tek tük sıçramayı ölçeğe katmaz', () => {
    const hiz = [150, 152, ...Array.from({ length: 200 }, (_, i) => (i % 10) + 1)]
    expect(kirpilmisUst(hiz)).toBe(15)
  })
  it('boş dizide 1 döner', () => {
    expect(kirpilmisUst([])).toBe(1)
  })
})
