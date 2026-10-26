import { describe, expect, it } from 'vitest'
import { YOK } from '../dogrulama/boyama'
import { boya, hucreZamanlari, type SenaryoRasterlari } from './boyama'

// 4 hücre: 0 hiç yanmıyor; 1 yalnız düşük olasılık (60 dk); 2 düşük 10, orta 30;
// 3 üç bant (0, 20, 40).
const r: SenaryoRasterlari = {
  genislik: 4,
  yukseklik: 1,
  bantlar: [
    new Uint16Array([YOK, 60, 10, 0]),
    new Uint16Array([YOK, YOK, 30, 20]),
    new Uint16Array([YOK, YOK, YOK, 40]),
  ],
}

describe('senaryo boyaması', () => {
  it('bant alanlarını t anına göre sayar; bantlar iç içe', () => {
    const cikti = new Uint32Array(4)
    expect(boya(r, 0, cikti)).toEqual([1, 0, 0])
    expect(boya(r, 30, cikti)).toEqual([2, 2, 0])
    expect(boya(r, 1000, cikti)).toEqual([3, 2, 1])
  })

  it('hücre ulaştığı en yüksek bandın rengini alır, yanmayan saydam', () => {
    const cikti = new Uint32Array(4)
    boya(r, 1000, cikti)
    const [hic, dusukRenk, ortaRenk, yuksekRenk] = cikti
    expect(hic).toBe(0)
    expect(new Set([dusukRenk, ortaRenk, yuksekRenk]).size).toBe(3)
    boya(r, 25, cikti) // hücre 2 yalnız düşük bantta, hücre 3 orta bantta
    expect(cikti[2]).toBe(dusukRenk)
    expect(cikti[3]).toBe(ortaRenk)
  })

  it('hücre zamanları: ulaşılmayan bant null', () => {
    expect(hucreZamanlari(r, 2)).toEqual([10, 30, null])
  })
})
