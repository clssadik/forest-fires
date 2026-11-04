import { describe, expect, it } from 'vitest'
import { rampaGlsl } from './tematikRenkler'

describe('rampaGlsl', () => {
  it('her renk aralığı için bir parça üretir', () => {
    const glsl = rampaGlsl('rampaDeneme', ['#000000', '#808080', '#ffffff'])
    expect(glsl).toContain('vec3 rampaDeneme(float t)')
    expect(glsl.match(/return mix/g)).toHaveLength(2)
    expect(glsl).toContain('t, 0.0, 1.0) * 2.0')
  })

  it('renkleri doğrusal uzaya çevirir', () => {
    expect(rampaGlsl('r', ['#808080', '#808080'])).toContain('0.2159')
  })
})
