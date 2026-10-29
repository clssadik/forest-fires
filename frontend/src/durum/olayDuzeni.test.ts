import { describe, expect, it } from 'vitest'
import { duzenOku, VARSAYILAN_DUZEN } from './olayDuzeni'

const depo = (deger: string | null) =>
  ({
    getItem: () => deger,
  }) as unknown as Storage

describe('duzenOku', () => {
  it('kayıt yoksa varsayılanı döner', () => {
    expect(duzenOku(depo(null))).toEqual(VARSAYILAN_DUZEN)
  })
  it('geçerli kaydı okur', () => {
    expect(duzenOku(depo('{"cekmece":null,"seritlerAcik":true}'))).toEqual({ cekmece: null, seritlerAcik: true })
    expect(duzenOku(depo('{"cekmece":"analiz","seritlerAcik":false}'))).toEqual({ cekmece: 'analiz', seritlerAcik: false })
  })
  it('bozuk ya da bilinmeyen değerde varsayılana düşer', () => {
    expect(duzenOku(depo('{bozuk'))).toEqual(VARSAYILAN_DUZEN)
    expect(duzenOku(depo('{"cekmece":"iha","seritlerAcik":"evet"}'))).toEqual(VARSAYILAN_DUZEN)
  })
  it('depolama hata atarsa varsayılanı döner', () => {
    const atan = {
      getItem: () => {
        throw new Error('engelli')
      },
    } as unknown as Storage
    expect(duzenOku(atan)).toEqual(VARSAYILAN_DUZEN)
  })
})
