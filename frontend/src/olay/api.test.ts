import { describe, expect, it } from 'vitest'
import { gercekAlanaUlasti } from './api'

describe('gercekAlanaUlasti', () => {
  it('alan eşitken yanlış alarm ile kaçırılan aynı', () => {
    expect(gercekAlanaUlasti({ yanlis_alarm_ha: 8000, kacirilan_ha: 8020 })).toBe(true)
  })
  it('model erken durduysa yanlış alarm küçük kalır', () => {
    expect(gercekAlanaUlasti({ yanlis_alarm_ha: 8058, kacirilan_ha: 25748 })).toBe(false)
  })
})
