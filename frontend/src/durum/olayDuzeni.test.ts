import { describe, expect, it } from 'vitest'
import { cekmeceOku, VARSAYILAN_CEKMECE } from './olayDuzeni'

const depo = (deger: string | null) =>
  ({
    getItem: () => deger,
  }) as unknown as Storage

describe('cekmeceOku', () => {
  it('kayıt yoksa varsayılanı döner', () => {
    expect(cekmeceOku(depo(null))).toBe(VARSAYILAN_CEKMECE)
  })
  it('geçerli kaydı okur', () => {
    expect(cekmeceOku(depo('{"cekmece":null}'))).toBeNull()
    expect(cekmeceOku(depo('{"cekmece":"analiz","seritlerAcik":false}'))).toBe('analiz')
  })
  it("Analiz'e katılan eski sekmeleri Analiz'e çevirir", () => {
    expect(cekmeceOku(depo('{"cekmece":"kanitlar"}'))).toBe('analiz')
    expect(cekmeceOku(depo('{"cekmece":"notlar"}'))).toBe('analiz')
  })
  it('bozuk ya da bilinmeyen değerde varsayılana düşer', () => {
    expect(cekmeceOku(depo('{bozuk'))).toBe(VARSAYILAN_CEKMECE)
    expect(cekmeceOku(depo('{"cekmece":"iha"}'))).toBe(VARSAYILAN_CEKMECE)
  })
  it('depolama hata atarsa varsayılanı döner', () => {
    const atan = {
      getItem: () => {
        throw new Error('engelli')
      },
    } as unknown as Storage
    expect(cekmeceOku(atan)).toBe(VARSAYILAN_CEKMECE)
  })
})
