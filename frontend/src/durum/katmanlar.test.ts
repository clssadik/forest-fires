import { describe, expect, it } from 'vitest'
import { anahtarEtkin, katmanGucleri, MOD_GRUPLARI } from './katmanlar'

const hepsiAcik = { izokron: true, ruzgar: true, duman: true }
const hepsiKapali = { izokron: false, ruzgar: false, duman: false }

const TEMATIK = ['varis', 'guven', 'hata', 'zamanFarki', 'siddet', 'ortu'] as const
const MODLAR = MOD_GRUPLARI.flatMap((g) => g.modlar)

describe('MOD_GRUPLARI', () => {
  it('her mod yalnızca bir grupta yer alır', () => {
    expect([...MODLAR].sort()).toEqual(['yayilim', ...TEMATIK].sort())
  })
})

describe('katmanGucleri', () => {
  it('yayılım modunda hiçbir tematik harita çizilmez', () => {
    const g = katmanGucleri('yayilim', hepsiAcik)
    expect(g.yayilim).toBe(1)
    expect(g.olasilik).toBeGreaterThan(0)
    expect(g.agaclar).toBe(true)
    for (const m of TEMATIK) expect(g[m]).toBe(0)
  })

  it.each(TEMATIK)('%s modu yalnızca kendi haritasını çizer, yangın çizimlerini kapatır', (mod) => {
    const g = katmanGucleri(mod, hepsiAcik)
    for (const m of TEMATIK) expect(g[m] > 0).toBe(m === mod)
    expect(g.yayilim).toBe(0)
    expect(g.olasilik).toBe(0)
    expect(g.izokron).toBe(0)
    expect(g.duman).toBe(0)
    expect(g.agaclar).toBe(false)
  })

  it('rüzgâr her modda açılabilir', () => {
    for (const mod of MODLAR) {
      expect(anahtarEtkin(mod, 'ruzgar')).toBe(true)
      expect(katmanGucleri(mod, hepsiAcik).ruzgar).toBeGreaterThan(0)
      expect(katmanGucleri(mod, hepsiKapali).ruzgar).toBe(0)
    }
  })

  it('izokron ve duman yalnızca yayılım modunda etkindir', () => {
    expect(anahtarEtkin('yayilim', 'izokron')).toBe(true)
    expect(anahtarEtkin('yayilim', 'duman')).toBe(true)
    for (const mod of TEMATIK) {
      expect(anahtarEtkin(mod, 'izokron')).toBe(false)
      expect(anahtarEtkin(mod, 'duman')).toBe(false)
    }
  })
})
