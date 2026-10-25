import { useEffect, useRef } from 'react'
import type { KatmanKimligi } from '../../durum/katmanlar'
import { rastgeleUreteci } from '../../model/gurultu'

/**
 * Katman satırındaki küçük önizleme resmi. Gerçek katman verisi gelene kadar
 * her katmanın görünümünü taklit eden küçük bir prosedürel desen çizer.
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
  mudahale: (c, r) => {
    benekli('#b79a74', ['#a88b66', '#c7ab85', '#9a7d5a'], 300, 2)(c, r)
    c.strokeStyle = '#c8302a'
    c.lineWidth = 2.2
    c.beginPath()
    c.moveTo(4, 40)
    c.bezierCurveTo(16, 30, 30, 36, 48, 18)
    c.stroke()
  },
  yapilar: (c, r) => {
    benekli('#8f8d88', ['#a3a19b', '#7a7873', '#9a9892'], 400, 1.8)(c, r)
    c.fillStyle = '#f2efe8'
    for (let i = 0; i < 6; i++) c.fillRect(6 + r() * 38, 6 + r() * 38, 3, 3)
  },
  yollar: (c) => {
    c.fillStyle = '#d3cfc6'
    c.fillRect(0, 0, BOYUT, BOYUT)
    c.strokeStyle = '#6c675e'
    c.lineWidth = 1.3
    for (const [x1, y1, x2, y2] of [
      [4, 8, 48, 44],
      [6, 46, 46, 6],
      [0, 28, 52, 24],
      [26, 0, 22, 52],
    ]) {
      c.beginPath()
      c.moveTo(x1, y1)
      c.lineTo(x2, y2)
      c.stroke()
    }
  },
  sinirlar: (c) => {
    c.fillStyle = '#d6d2c9'
    c.fillRect(0, 0, BOYUT, BOYUT)
    c.strokeStyle = '#6c675e'
    c.setLineDash([2, 3])
    c.lineWidth = 1.2
    c.beginPath()
    c.moveTo(6, 10)
    c.lineTo(26, 26)
    c.lineTo(46, 14)
    c.moveTo(26, 26)
    c.lineTo(24, 48)
    c.stroke()
    c.fillStyle = '#4a463e'
    for (const [x, y] of [
      [6, 10],
      [46, 14],
      [24, 48],
    ])
      c.fillRect(x - 1.5, y - 1.5, 3, 3)
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
