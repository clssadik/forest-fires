import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, UnsignedByteType } from 'three'
import { rastgeleUreteci } from '../model/gurultu'

/**
 * Gölgelendiricilerin ortak gürültü dokusu: 256 × 256 rastgele değer, tekrarlı ve doğrusal
 * süzgeçli; bir okuma = değer gürültüsü. Her pikselde sin/hash hesaplamaktan çok daha ucuz,
 * uzakta mipmap sayesinde titreşmez.
 */
export const GURULTU_BOYUTU = 256

function olustur() {
  const r = rastgeleUreteci(4242)
  const veri = new Uint8Array(GURULTU_BOYUTU * GURULTU_BOYUTU)
  for (let i = 0; i < veri.length; i++) veri[i] = Math.floor(r() * 256)
  const d = new DataTexture(veri, GURULTU_BOYUTU, GURULTU_BOYUTU, RedFormat, UnsignedByteType)
  d.wrapS = d.wrapT = RepeatWrapping
  d.magFilter = LinearFilter
  d.minFilter = LinearMipmapLinearFilter
  d.generateMipmaps = true
  d.needsUpdate = true
  return d
}

export const gurultuDokusu = olustur()

/** GLSL: `uGurultu` örnekleyicisiyle değer gürültüsü (0–1) ve 4 oktavlı fBm. */
export const DOKU_GURULTU_GLSL = /* glsl */ `
uniform sampler2D uGurultu;
float dGurultu(vec2 p) { return texture2D(uGurultu, (p + 0.5) / ${GURULTU_BOYUTU}.0).r; }
float dFbm(vec2 p) {
  float t = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { t += a * dGurultu(p); p = p * 2.03 + 3.1; a *= 0.5; }
  return t / 0.9375;
}
`
