import type { ReactNode, SVGProps } from 'react'

/** Arayüz simgeleri: Lucide tarzı ince çizgili satır içi SVG'ler. */

type IkonOzellik = SVGProps<SVGSVGElement> & { boyut?: number }

function Ikon({ boyut = 16, dolgu = false, children, ...ozellik }: IkonOzellik & { dolgu?: boolean; children: ReactNode }) {
  return (
      <svg
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill={dolgu ? 'currentColor' : 'none'}
      stroke={dolgu ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...ozellik}
    >
      {children}
      </svg>
  )
}

export function IkonHarita(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </Ikon>
  )
}

export function IkonIha(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="18" cy="6" r="2.6" />
      <circle cx="6" cy="18" r="2.6" />
      <circle cx="18" cy="18" r="2.6" />
      <path d="M8 8l2.5 2.5M16 8l-2.5 2.5M8 16l2.5-2.5M16 16l-2.5-2.5" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
    </Ikon>
  )
}

export function IkonArac(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M3 16V8.5A1.5 1.5 0 0 1 4.5 7H13v9" />
      <path d="M13 10h4l3 3.5V16h-2" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
      <path d="M9 16.5h5" />
    </Ikon>
  )
}

export function IkonTakvim(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" />
    </Ikon>
  )
}

export function IkonGrafik(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M4 20h16M7 16V9M11 16V5M15 16v-6M19 16v-3" />
    </Ikon>
  )
}

export function IkonPaylas(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
    </Ikon>
  )
}

export function IkonAyar(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Ikon>
  )
}

export function IkonAsagi(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="m6 9 6 6 6-6" />
    </Ikon>
  )
}

export function IkonCizgi(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M5 12h14" />
    </Ikon>
  )
}

export function IkonOynat(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M7 4.5v15l12.5-7.5z" />
    </Ikon>
  )
}

export function IkonDuraklat(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </Ikon>
  )
}

export function IkonIleri(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M5 4.5v15L16 12z" />
      <rect x="16.5" y="4.5" width="3" height="15" rx="1" />
    </Ikon>
  )
}

export function IkonDonSol(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </Ikon>
  )
}

export function IkonDonSag(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </Ikon>
  )
}

/** Eğ: ufka doğru bak (yatık paralelkenar + aşağı ok). */
export function IkonEg(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M6 14h14l-2 6H4z" />
      <path d="M12 3v7M9 7l3 3 3-3" />
    </Ikon>
  )
}

/** Dikleş: tepeden bak (kare + yukarı ok). */
export function IkonDik(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <rect x="5" y="13" width="14" height="8" rx="1" />
      <path d="M12 10V3M9 6l3-3 3 3" />
    </Ikon>
  )
}

export function IkonHedef(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Ikon>
  )
}

export function IkonTamEkran(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5" />
    </Ikon>
  )
}

export function IkonArti(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M12 5v14M5 12h14" />
    </Ikon>
  )
}

export function IkonUcNokta(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </Ikon>
  )
}

export function IkonRuzgar(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />
    </Ikon>
  )
}

export function IkonTermometre(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M14 14.8V4.5a2 2 0 0 0-4 0v10.3a4 4 0 1 0 4 0z" />
      <path d="M12 9v7" />
    </Ikon>
  )
}

export function IkonDamla(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M12 2.8s6.5 7.2 6.5 11.7a6.5 6.5 0 0 1-13 0C5.5 10 12 2.8 12 2.8z" />
    </Ikon>
  )
}

export function IkonYaprak(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M5 20c0-9 5-15 16-16-1 11-7 16-16 16z" />
      <path d="M5 20 13 12" stroke="#dedace" strokeWidth={1.6} />
    </Ikon>
  )
}

export function IkonAlev(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M12 2.5c1 3.5 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.5 1.4-4.2 2.6-5.4.2 1.8 1 2.9 2.2 3.4C11 9 10.8 5.6 12 2.5z" />
    </Ikon>
  )
}

export function IkonAlevBoyu(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="M12 3v15M8.5 14.5 12 21l3.5-6.5" />
    </Ikon>
  )
}

export function IkonUcgen(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M12 4 21.5 20h-19z" />
    </Ikon>
  )
}

export function IkonKumSaati(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <path d="M6 3h12l-5 9 5 9H6l5-9z" />
    </Ikon>
  )
}

export function IkonKare(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
    </Ikon>
  )
}

export function IkonDaire(p: IkonOzellik) {
  return (
    <Ikon {...p} dolgu>
      <circle cx="12" cy="12" r="8" />
    </Ikon>
  )
}

export function IkonTik(p: IkonOzellik) {
  return (
    <Ikon {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Ikon>
  )
}

/** Logo: iki tepeli dağ, kırmızıdan turuncuya. */
export function Logo({ boyut = 30 }: { boyut?: number }) {
  return (
      <svg width={boyut * 1.6} height={boyut} viewBox="0 0 48 30" aria-hidden>
      <defs>
        <linearGradient id="logo-a" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9733d" />
          <stop offset="1" stopColor="#c8452a" />
        </linearGradient>
      </defs>
      <path d="M2 25 16 9l6 7 6-9 18 18z" fill="url(#logo-a)" />
      <path d="M2 25 16 9l4 4.6L11 25z" fill="#7a4a35" opacity="0.55" />
      </svg>
  )
}
