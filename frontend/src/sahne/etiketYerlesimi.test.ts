import { describe, expect, it } from 'vitest'
import { etiketlerCakisir, sonGecilenSaat } from './etiketYerlesimi'

describe('sonGecilenSaat', () => {
  it('geçilen izokronlardan en sonuncusunu verir', () => {
    expect(sonGecilenSaat([6, 12, 24], 13)).toBe(12)
    expect(sonGecilenSaat([6, 12, 24], 24)).toBe(24)
  })

  it('hiçbiri geçilmediyse null verir', () => {
    expect(sonGecilenSaat([6, 12], 5)).toBeNull()
    expect(sonGecilenSaat([], 100)).toBeNull()
  })
})

describe('etiketlerCakisir', () => {
  it('iki eksende de yakın olan etiketler çakışır', () => {
    expect(etiketlerCakisir(100, 20)).toBe(true)
    expect(etiketlerCakisir(-100, -20)).toBe(true)
  })

  it('tek eksende uzak olmak yeter', () => {
    expect(etiketlerCakisir(400, 10)).toBe(false)
    expect(etiketlerCakisir(10, 100)).toBe(false)
  })
})
