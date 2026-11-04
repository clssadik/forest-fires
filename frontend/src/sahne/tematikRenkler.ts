import { Color } from 'three'
import type { OrtuSinifi } from '../olay/veri'

/**
 * Tematik görünüm modlarının renkleri. Gölgelendirici, lejant ve önizlemeler aynı listeden
 * okur; renkler üçünde de aynı kalsın diye tek yerde durur.
 */

/** Hata modu: doğru, fazla (yanlış alarm), kaçırılan. */
export const HATA_RENKLERI = { dogru: '#d4472a', fazla: '#f0b43c', kacirilan: '#3f6db5' }

export const RAMPALAR = {
  /** Erken varış → geç varış. */
  varis: ['#fff0a8', '#f9a03f', '#d9482b', '#8a1f66', '#2f1460'],
  /** Az çalıştırmada yandı → hepsinde yandı. */
  guven: ['#d7ecf5', '#6db6d9', '#2a78b8', '#123a7a'],
  /** Model erken → zamanında → model geç. */
  zamanFarki: ['#2166ac', '#7fb2d9', '#f7f3e8', '#e8836a', '#b2182b'],
  /** Düşük şiddet → yüksek şiddet. */
  siddet: ['#fde6a0', '#f58a3c', '#c42a22', '#4a0a12'],
}

export const ORTU_RENKLERI: Partial<Record<OrtuSinifi, string>> = {
  orman: '#2f7a3f',
  maki: '#93b84f',
  ot: '#e0cf6a',
  tarim: '#c9894a',
  yerlesim: '#9a9a9a',
}

/** Renk gölgelendiriciye doğrusal uzayda girer; `Color` onaltılık değeri ona çevirir. */
const vec3Glsl = (hex: string) => {
  const c = new Color(hex)
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`
}

export const renkGlsl = vec3Glsl

/** 0..1 girdiyi renk durakları arasında doğrusal gezdiren GLSL işlevi. */
export function rampaGlsl(ad: string, renkler: string[]) {
  const n = renkler.length - 1
  const parcalar = renkler
    .slice(0, -1)
    .map((r, i) => `  if (s < ${i + 1}.0) return mix(${vec3Glsl(r)}, ${vec3Glsl(renkler[i + 1])}, s - ${i}.0);`)
  return `vec3 ${ad}(float t) {
  float s = clamp(t, 0.0, 1.0) * ${n}.0;
${parcalar.join('\n')}
  return ${vec3Glsl(renkler[n])};
}`
}
