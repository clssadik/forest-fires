import { describe, expect, it } from 'vitest'
import { KARSILASTIRMA_RENKLERI, YAS_DURAKLARI, YOK, boya, iou, paketle, sorensen, type Rasterlar } from './boyama'

// 1 × 4'lük ızgara. Hücreler: model 10. dk'da yakar; FIRMS 30. dk'da görür; ikisi de;
// hiçbiri (yalnızca gerçek alanda, FIRMS görmedi).
const r: Rasterlar = {
  genislik: 4,
  yukseklik: 1,
  model: new Uint16Array([10, YOK, 20, YOK]),
  firms: new Uint16Array([YOK, 30, 40, YOK]),
  gercek: new Uint8Array([0, 1, 1, 1]),
}

const renkKodu = (h: string, a: number) =>
  paketle(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a)

describe('boya', () => {
  it('t anına kadar yananları sayar', () => {
    const cikti = new Uint32Array(4)
    expect(boya(r, 5, 100, 'yayilim', cikti)).toEqual({ model: 0, gozlenen: 0, kesisim: 0 })
    expect(boya(r, 25, 100, 'yayilim', cikti)).toEqual({ model: 2, gozlenen: 0, kesisim: 0 })
    expect(boya(r, 45, 100, 'yayilim', cikti)).toEqual({ model: 2, gozlenen: 2, kesisim: 1 })
  })

  it('bitişte gerçek alanın tamamını gözlenen sayar (FIRMS görmese de)', () => {
    const s = boya(r, 100, 100, 'yayilim', new Uint32Array(4))
    expect(s).toEqual({ model: 2, gozlenen: 3, kesisim: 1 })
    expect(iou(s)).toBeCloseTo(1 / 4)
    expect(sorensen(s)).toBeCloseTo((2 * 1) / (2 + 3))
  })

  it('yayılım kipinde yeni tutuşan hücre cephe rengini alır, yanmayan saydamdır', () => {
    const cikti = new Uint32Array(4)
    boya(r, 10, 100, 'yayilim', cikti)
    const [, renk, alfa] = YAS_DURAKLARI[0]
    expect(cikti[0]).toBe(renkKodu(renk, alfa))
    expect(cikti[1]).toBe(0)
  })

  it('karşılaştırma kipi: doğru, yanlış alarm, kaçırılan', () => {
    const cikti = new Uint32Array(4)
    boya(r, 100, 100, 'karsilastirma', cikti)
    expect(cikti[0]).toBe(renkKodu(KARSILASTIRMA_RENKLERI.yanlisAlarm, 215))
    expect(cikti[1]).toBe(renkKodu(KARSILASTIRMA_RENKLERI.kacirilan, 215))
    expect(cikti[2]).toBe(renkKodu(KARSILASTIRMA_RENKLERI.dogru, 215))
  })

  it('model yoksa ve gizliyse yalnızca sayar', () => {
    const cikti = new Uint32Array(4).fill(7)
    expect(boya({ ...r, model: null }, 45, 100, 'karsilastirma', cikti, false)).toEqual({
      model: 0,
      gozlenen: 2,
      kesisim: 0,
    })
    expect([...cikti]).toEqual([0, 0, 0, 0])
  })
})

describe('iou', () => {
  it('boş kümede null', () => expect(iou({ model: 0, gozlenen: 0, kesisim: 0 })).toBeNull())
})

describe('sorensen', () => {
  it('boş kümede null', () => expect(sorensen({ model: 0, gozlenen: 0, kesisim: 0 })).toBeNull())
  it('her yeri yakmak puanı düşürür', () => {
    // Gerçek 10 hücre, hepsi yakalanmış; model 10 da yakarsa 1, 100 yakarsa 0,18.
    expect(sorensen({ model: 10, gozlenen: 10, kesisim: 10 })).toBeCloseTo(1)
    expect(sorensen({ model: 100, gozlenen: 10, kesisim: 10 })).toBeCloseTo(20 / 110)
  })
})
