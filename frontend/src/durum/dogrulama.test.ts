import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { YanginBilgisi } from '../dogrulama/api'

// API istemcisi sahte: her çağrı hangi yangın için yapıldığını geri verir.
const bekleyenler: Record<string, () => void> = {}
vi.mock('../dogrulama/api', () => ({
  yanginBilgisi: async (ad: string) => {
    if (ad === 'yavas') await new Promise<void>((r) => (bekleyenler[ad] = r))
    return bilgi(ad)
  },
  rasterGetir: async (ad: string) => new Uint16Array([ad.length]),
  sonucGetir: async (ad: string) => ({ model: `sonuc_${ad}` }),
}))

const { useDogrulama } = await import('./dogrulama')

function bilgi(ad: string): YanginBilgisi {
  return {
    ad,
    baslik: ad,
    konum: '',
    tutusma_utc: '2021-07-28T10:00:00Z',
    bitis_utc: '2021-08-03T00:00:00Z',
    tutusma_konumu: { enlem: 0, boylam: 0 },
    harita: { genislik: 1, yukseklik: 1, koseler: [], sinirlar: [0, 0, 0, 0] },
    gercek_ha: 1,
    tespit_sayisi: 1,
    baseline: null,
  }
}

describe('doğrulama durumu: yangın seçimi', () => {
  beforeEach(() => {
    useDogrulama.setState({ ad: 'manavgat_2021', yukleme: 'bos', bilgi: null, sonuc: null, rasterlar: null })
  })

  it('yangın değişince yeni yangının verisini yükler', async () => {
    await useDogrulama.getState().yukle()
    expect(useDogrulama.getState().bilgi?.ad).toBe('manavgat_2021')

    await useDogrulama.getState().yanginSec('marmaris_2022')
    const d = useDogrulama.getState()
    expect(d).toMatchObject({ ad: 'marmaris_2022', yukleme: 'hazir', anlik: null })
    expect(d.bilgi?.ad).toBe('marmaris_2022')
    expect(d.sonuc?.model).toBe('sonuc_marmaris_2022')
  })

  it('aynı yangın seçilirse yeniden yüklemez', async () => {
    await useDogrulama.getState().yukle()
    const once = useDogrulama.getState().bilgi
    await useDogrulama.getState().yanginSec('manavgat_2021')
    expect(useDogrulama.getState().bilgi).toBe(once)
  })

  it('eski yangının geç gelen yanıtı yeni seçimi ezmez', async () => {
    const yavas = useDogrulama.getState().yanginSec('yavas')
    const hizli = useDogrulama.getState().yanginSec('marmaris_2022')
    await hizli
    bekleyenler.yavas()
    await yavas
    const d = useDogrulama.getState()
    expect(d.ad).toBe('marmaris_2022')
    expect(d.bilgi?.ad).toBe('marmaris_2022')
    expect(d.yukleme).toBe('hazir')
  })
})
