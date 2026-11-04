import { describe, expect, it } from 'vitest'
import { anahtarEtkin, katmanGucleri } from './katmanlar'

const hepsiAcik = { izokron: true, ruzgar: true, duman: true }
const hepsiKapali = { izokron: false, ruzgar: false, duman: false }

describe('katmanGucleri', () => {
  it('yayılım modunda gözlem ve hata çizilmez', () => {
    const g = katmanGucleri('yayilim', hepsiAcik)
    expect(g.yayilim).toBe(1)
    expect(g.olasilik).toBeGreaterThan(0)
    expect(g.gercekSinir).toBe(0)
    expect(g.firms).toBe(0)
    expect(g.hata).toBe(0)
  })

  it('karşılaştırma modu gerçek sınırı ve FIRMS noktalarını modele ekler', () => {
    const g = katmanGucleri('karsilastirma', hepsiKapali)
    expect(g.yayilim).toBe(1)
    expect(g.gercekSinir).toBe(1)
    expect(g.firms).toBe(1)
    expect(g.hata).toBe(0)
  })

  it('hata modu model çizimlerini ve ağaçları kapatır, anahtarlar onları açamaz', () => {
    const g = katmanGucleri('hata', hepsiAcik)
    expect(g.hata).toBeGreaterThan(0)
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

  it('izokron ve duman yalnızca hata modunda etkisizdir', () => {
    expect(anahtarEtkin('yayilim', 'izokron')).toBe(true)
    expect(anahtarEtkin('karsilastirma', 'duman')).toBe(true)
    expect(anahtarEtkin('hata', 'izokron')).toBe(false)
    expect(anahtarEtkin('hata', 'duman')).toBe(false)
  })
})
