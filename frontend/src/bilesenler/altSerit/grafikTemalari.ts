/** Alt şerit grafiklerinin renk temaları (geçmiş: dolu, gelecek: soluk). */

export interface GrafikTemasi {
  cizgi: string
  dolgu: string
  gelecekCizgi: string
  gelecekDolgu: string
}

export const TEMALAR = {
  alan: { cizgi: '#c9543a', dolgu: '#dd8c6c', gelecekCizgi: '#d9a088', gelecekDolgu: '#e6c8b4' },
  hiz: { cizgi: '#c22a24', dolgu: '#efc3b6', gelecekCizgi: '#e1a091', gelecekDolgu: '#f0ddd4' },
  profil: { cizgi: '#4f5f41', dolgu: '#7f906c', gelecekCizgi: '#a3ad92', gelecekDolgu: '#c3cab3' },
} satisfies Record<string, GrafikTemasi>
