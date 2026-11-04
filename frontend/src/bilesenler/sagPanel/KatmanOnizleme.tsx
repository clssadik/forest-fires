import { useEffect, useRef } from 'react'
import type { GorunumModu, HaritaAnahtari } from '../../durum/katmanlar'
import { rastgeleUreteci } from '../../model/gurultu'

/**
 * Katman satırındaki küçük önizleme resmi: her mod ve anahtarın sahnedeki görünümünü
 * taklit eden küçük bir prosedürel desen.
 */

const BOYUT = 52 // desenlerin çizim birimi
const PIKSEL = 64 // tuval boyutu: 2x yoğunluk için CSS boyutunun (32 px) iki katı

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

const kesikSinir = (c: CanvasRenderingContext2D) => {
  c.strokeStyle = 'rgba(247,245,235,0.95)'
  c.lineWidth = 1.6
  c.setLineDash([4, 3])
  c.beginPath()
  c.ellipse(BOYUT / 2, BOYUT / 2, 19, 15, -0.4, 0, Math.PI * 2)
  c.stroke()
  c.setLineDash([])
}

export type OnizlemeKimligi = GorunumModu | HaritaAnahtari

const cizimler: Record<OnizlemeKimligi, Ciz> = {
  yayilim: benekli('#e67a2a', ['#f19a3f', '#d65f1f', '#f6b45a', '#c94f18'], 520, 2),
  karsilastirma: (c, r) => {
    benekli('#2a2420', ['#3a322c', '#1f1a17', '#4a3f36'], 420, 2)(c, r)
    kesikSinir(c)
    for (let i = 0; i < 16; i++) {
      c.fillStyle = r() < 0.5 ? '#ff5a28' : '#b8281a'
      c.beginPath()
      c.arc(r() * BOYUT, r() * BOYUT, 1.8, 0, Math.PI * 2)
      c.fill()
    }
  },
  hata: (c) => {
    const yarim = BOYUT / 2
    c.fillStyle = '#d4472a'
    c.fillRect(0, 0, BOYUT, BOYUT)
    c.fillStyle = '#f0b43c'
    c.fillRect(yarim, 0, yarim, yarim)
    c.fillStyle = '#455c80'
    c.fillRect(0, yarim, yarim, yarim)
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
  duman: (c, r) => {
    c.fillStyle = '#4c4f4f'
    c.fillRect(0, 0, BOYUT, BOYUT)
    for (let i = 0; i < 9; i++) {
      const x = r() * BOYUT
      const y = r() * BOYUT
      const g = c.createRadialGradient(x, y, 1, x, y, 14)
      g.addColorStop(0, 'rgba(205,205,200,0.55)')
      g.addColorStop(1, 'rgba(205,205,200,0)')
      c.fillStyle = g
      c.fillRect(0, 0, BOYUT, BOYUT)
    }
  },
}

export function KatmanOnizleme({ kimlik, soluk }: { kimlik: OnizlemeKimligi; soluk: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current?.getContext('2d')
    if (!c) return
    c.setTransform(PIKSEL / BOYUT, 0, 0, PIKSEL / BOYUT, 0, 0)
    cizimler[kimlik](c, rastgeleUreteci(kimlik.length * 97 + 13))
  }, [kimlik])
  return (
    <canvas
      ref={ref}
      width={PIKSEL}
      height={PIKSEL}
      className={`size-8 shrink-0 rounded-[6px] shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition-opacity ${soluk ? 'opacity-45' : ''}`}
    />
  )
}
