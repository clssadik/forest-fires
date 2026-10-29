import { describe, expect, it } from 'vitest'
import { notOku, notYaz } from './notlar'

class BellekDeposu implements Storage {
  private d = new Map<string, string>()
  get length() {
    return this.d.size
  }
  clear() {
    this.d.clear()
  }
  getItem(k: string) {
    return this.d.get(k) ?? null
  }
  key(i: number) {
    return [...this.d.keys()][i] ?? null
  }
  removeItem(k: string) {
    this.d.delete(k)
  }
  setItem(k: string, v: string) {
    this.d.set(k, v)
  }
}

const bozukDepo = {
  getItem: () => {
    throw new Error('engelli')
  },
  setItem: () => {
    throw new Error('engelli')
  },
} as unknown as Storage

describe('notlar', () => {
  it('yangın başına ayrı saklar, boş notu siler', () => {
    const depo = new BellekDeposu()
    expect(notYaz('manavgat_2021', 'doğu koşusu', depo)).toBe(true)
    expect(notOku('manavgat_2021', depo)).toBe('doğu koşusu')
    expect(notOku('marmaris_2022', depo)).toBe('')
    notYaz('manavgat_2021', '  ', depo)
    expect(depo.length).toBe(0)
  })

  it('depolama kapalıysa hata fırlatmaz', () => {
    expect(notOku('x', bozukDepo)).toBe('')
    expect(notYaz('x', 'not', bozukDepo)).toBe(false)
    expect(notYaz('x', 'not', undefined)).toBe(false)
  })
})
