import { beforeEach, describe, expect, it } from 'vitest'
import { useZaman } from './zaman'

const SAAT = 3_600_000

describe('zaman durumu', () => {
  beforeEach(() => {
    useZaman.setState({ baslangic: 0, bitis: 10 * SAAT, t: 0, oynatiliyor: false, hiz: 60 })
  })

  it('aralık dışına çıkmaz', () => {
    useZaman.getState().zamanaGit(99 * SAAT)
    expect(useZaman.getState().t).toBe(10 * SAAT)
  })

  it('oynatılırken hızla orantılı ilerler', () => {
    useZaman.getState().oynatDuraklat()
    useZaman.getState().ilerlet(1000) // 1 gerçek saniye = 60 simülasyon dakikası
    expect(useZaman.getState().t).toBe(SAAT)
  })

  it('duraklatılmışken ilerlemez', () => {
    useZaman.getState().ilerlet(1000)
    expect(useZaman.getState().t).toBe(0)
  })

  it('sona gelince durur', () => {
    useZaman.getState().oynatDuraklat()
    useZaman.getState().ilerlet(60_000)
    expect(useZaman.getState()).toMatchObject({ t: 10 * SAAT, oynatiliyor: false })
  })
})
