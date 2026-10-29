/** Alt şerit grafiklerinin renk temaları, siyah zemin için (geçmiş: dolu, gelecek: soluk). */

export interface GrafikTemasi {
  cizgi: string
  dolgu: string
  gelecekCizgi: string
  gelecekDolgu: string
}

export const TEMALAR = {
  alan: { cizgi: '#f06a45', dolgu: '#7c2f1d', gelecekCizgi: '#9a5d4b', gelecekDolgu: '#33201a' },
  hiz: { cizgi: '#ff5a44', dolgu: '#5e211b', gelecekCizgi: '#8f4c43', gelecekDolgu: '#2c1a17' },
  profil: { cizgi: '#9bbd7e', dolgu: '#3d4f30', gelecekCizgi: '#65735a', gelecekDolgu: '#20281b' },
} satisfies Record<string, GrafikTemasi>
