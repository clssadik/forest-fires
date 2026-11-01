import { describe, expect, it } from 'vitest'
import { kisaSayi } from './bicim'

describe('kisaSayi', () => {
  it('binin altını olduğu gibi, binleri k, milyonları M ile kısaltır', () => {
    expect(kisaSayi(950)).toBe('950')
    expect(kisaSayi(21122)).toBe('21,1k')
    expect(kisaSayi(1250000)).toBe('1,3M')
  })
})
