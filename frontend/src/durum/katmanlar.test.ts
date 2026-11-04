import { describe, expect, it } from 'vitest'
import { anahtarEtkin, katmanGucleri } from './katmanlar'

const hepsiAcik = { izokron: true, ruzgar: true, duman: true }
const hepsiKapali = { izokron: false, ruzgar: false, duman: false }

describe('katmanGucleri', () => {
  it('yayılım modunda kıyas ve hata çizilmez', () => {
    const g = katmanGucleri('yayilim', hepsiAcik)
    expect(g.yayilim).toBe(1)
    expect(g.olasilik).toBeGreaterThan(0)
    expect(g.kiyas).toBe(0)
    expect(g.hata).toBe(0)
  })

  it.each(['karsilastirma', 'hata'] as const)('%s modu düz harita çizer, model çizimlerini kapatır', (mod) => {
    const g = katmanGucleri(mod, hepsiAcik)
    expect(g.kiyas > 0).toBe(mod === 'karsilastirma')
    expect(g.hata > 0).toBe(mod === 'hata')
    expect(g.yayilim).toBe(0)
    expect(g.olasilik).toBe(0)
    expect(g.izokron).toBe(0)
    expect(g.duman).toBe(0)
    expect(g.agaclar).toBe(false)
  })

  it('rüzgâr her modda açılabilir', () => {
    for (const mod of ['yayilim', 'karsilastirma', 'hata'] as const) {
      expect(anahtarEtkin(mod, 'ruzgar')).toBe(true)
      expect(katmanGucleri(mod, hepsiAcik).ruzgar).toBeGreaterThan(0)
      expect(katmanGucleri(mod, hepsiKapali).ruzgar).toBe(0)
    }
  })

  it('izokron ve duman yalnızca yayılım modunda etkindir', () => {
    expect(anahtarEtkin('yayilim', 'izokron')).toBe(true)
    expect(anahtarEtkin('yayilim', 'duman')).toBe(true)
    expect(anahtarEtkin('karsilastirma', 'duman')).toBe(false)
    expect(anahtarEtkin('hata', 'izokron')).toBe(false)
  })
})
