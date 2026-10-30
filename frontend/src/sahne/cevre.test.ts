import { describe, expect, it } from 'vitest'
import type { OrtuSinifi } from '../olay/veri'
import { Cevre, type CevreVerisi } from './cevre'

/** 21 × 31 hücrelik sahte ızgara: kuzeyi dağ (yükseklik kuzeye doğru artar), güney şeridi deniz. */
function sahteVeri(): CevreVerisi {
  const satir = 21
  const sutun = 31
  const hucreKm = 0.5
  const genislikKm = sutun * hucreKm
  const yukseklikKm = satir * hucreKm
  const az = yukseklikKm / 2 - hucreKm / 2
  const kenetle = (v: number, s: number) => Math.min(Math.max(v, -s), s)
  return {
    satir,
    sutun,
    hucreKm,
    genislikKm,
    yukseklikKm,
    yukseklikM: (_x: number, z: number) => Math.max(400 - (kenetle(z, az) + az) * 80, 0),
    ortuKenetli: (_x: number, z: number): OrtuSinifi => (kenetle(z, az) > az - 1.5 ? 'su' : 'orman'),
  } as unknown as CevreVerisi
}

describe('Cevre', () => {
  const veri = sahteVeri()
  const c = new Cevre(veri, 30)

  it('yakın örgü gerçek örgünün kenarından geçer, uzak örgü yakının dış kenarından', () => {
    const { yakin, uzak } = c
    expect(yakin.xs).toContain(c.ax)
    expect(yakin.xs).toContain(-c.ax)
    expect(yakin.zs).toContain(c.az)
    expect(yakin.xs[0]).toBeCloseTo(-yakin.xs[yakin.xs.length - 1])
    expect(uzak.xs).toContain(uzak.delikX)
    expect(uzak.delikX).toBe(yakin.xs[yakin.xs.length - 1])
    expect(uzak.xs[uzak.xs.length - 1]).toBeGreaterThan(c.ax + 29)
    for (const xs of [yakin.xs, yakin.zs, uzak.xs, uzak.zs]) for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  })

  it('kenarda gerçek yükseklikle birebir, hemen dışında sürekli başlar', () => {
    for (const x of [-5, 0, 3.3]) {
      const kenar = c.nokta(x, -c.az)
      expect(kenar.hM).toBeCloseTo(veri.yukseklikM(x, -c.az))
      const disari = c.nokta(x, -c.az - 0.05)
      expect(Math.abs(disari.hM - kenar.hM)).toBeLessThan(15)
    }
  })

  it('kenarı deniz olan taraf dışarıda da deniz kalır, kara tarafı denize dönmez', () => {
    expect(c.nokta(0, c.az + 10).su).toBeGreaterThan(0.9)
    expect(c.nokta(0, c.az + 10).hM).toBeLessThan(0)
    expect(c.nokta(0, -c.az - 10).su).toBeLessThan(0.1)
    expect(c.nokta(0, -c.az - 10).hM).toBeGreaterThan(0)
  })

  it('kareye uzaklık içeride 0', () => {
    expect(c.uzaklik(0, 0)).toBe(0)
    expect(c.uzaklik(c.ax + 3, 0)).toBeCloseTo(3)
  })
})
