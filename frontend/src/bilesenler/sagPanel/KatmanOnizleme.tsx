import { useEffect, useRef } from 'react'
import type { KatmanKimligi } from '../../durum/katmanlar'
import { rastgeleUreteci } from '../../model/gurultu'

/**
 * Katman satırındaki küçük önizleme resmi: her katmanın sahnedeki görünümünü
 * taklit eden küçük bir prosedürel desen.
 */

const BOYUT = 52 // piksel (2x yoğunluk için CSS boyutunun iki katı)

type Ciz = (c: CanvasRenderingContext2D, r: () => number) => void

const benekli =
  (zemin: string, renkler: string[], adet = 500, yaricap = 2.2): Ciz =>
  (c, r) => {
    c.fillStyle = zemin
    c.fillRect(0, 0, BOYUT, BOYUT)
    for (let i = 0; i < adet; i++) {
      c.fillStyle = renkler[Math.floor(r() * renkler.length)]
      c.beginPath()
      c.arc(r() * BOYUT, r() * BOYUT, r() * yaricap + 0.6, 0, Math.PI * 2)
      c.fill()
    }
  }

const cizimler: Record<KatmanKimligi, Ciz> = {
  arazi: (c, r) => {
    benekli('#5b6b3c', ['#3f4f2a', '#7d8a50', '#2f3b20', '#93955e'], 420)(c, r)
    const g = c.createLinearGradient(0, 0, 0, BOYUT)
    g.addColorStop(0, 'rgba(230,225,205,0.55)')
    g.addColorStop(0.45, 'rgba(230,225,205,0)')
    c.fillStyle = g
    c.fillRect(0, 0, BOYUT, BOYUT)
  },
  goruntu: benekli('#9c9a96', ['#c9c7c2', '#7d7b77', '#b3b0aa', '#8e8b85'], 600, 1.8),
  yanikIzi: benekli('#3a2016', ['#5a2c18', '#8a3a1c', '#c4521e', '#24130d'], 520, 1.8),
  yayilim: benekli('#e67a2a', ['#f19a3f', '#d65f1f', '#f6b45a', '#c94f18'], 520, 2),
  olasilik: (c, r) => {
    benekli('#d0402a', ['#e2553a', '#b72f20', '#e86a42'], 400, 2)(c, r)
    const g = c.createRadialGradient(BOYUT / 2, BOYUT / 2, 1, BOYUT / 2, BOYUT / 2, 12)
    g.addColorStop(0, 'rgba(255,240,180,1)')
    g.addColorStop(1, 'rgba(255,140,60,0)')
    c.fillStyle = g
    c.fillRect(0, 0, BOYUT, BOYUT)
  },
  ruzgar: (c, r) => {
    benekli('#c3cfd2', ['#d9e2e3', '#b4c2c6'], 300, 2.5)(c, r)
    c.strokeStyle = 'rgba(255,255,255,0.9)'
    c.lineWidth = 1.4
    for (let i = 0; i < 7; i++) {
      const y = r() * BOYUT
      const x = r() * BOYUT * 0.5
      c.beginPath()
      c.moveTo(x, y)
      c.quadraticCurveTo(x + 12, y - 4, x + 24, y - 2)
      c.stroke()
    }
  },
  izokron: (c) => {
    c.fillStyle = '#2a2420'
    c.fillRect(0, 0, BOYUT, BOYUT)
    c.strokeStyle = '#f08c2a'
    c.lineWidth = 1.4
    for (const r of [8, 16, 26, 38]) {
      c.beginPath()
      c.ellipse(14, 40, r * 1.2, r * 0.8, -0.5, 0, Math.PI * 2)
      c.stroke()
    }
  },
  firms: (c, r) => {
    c.fillStyle = '#6e6a5e'
    c.fillRect(0, 0, BOYUT, BOYUT)
    for (let i = 0; i < 40; i++) {
      c.fillStyle = r() < 0.5 ? '#ff5a28' : '#9a2216'
      c.fillRect(r() * BOYUT, r() * BOYUT, 4, 4)
    }
  },
}

export function KatmanOnizleme({ kimlik, soluk }: { kimlik: KatmanKimligi; soluk: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current?.getContext('2d')
    if (!c) return
    cizimler[kimlik](c, rastgeleUreteci(kimlik.length * 97 + 13))
  }, [kimlik])
  return (
    <canvas
      ref={ref}
      width={BOYUT}
      height={BOYUT}
      className={`size-[26px] shrink-0 rounded-[3px] ${soluk ? 'opacity-50' : ''}`}
    />
  )
}
