import { useEffect, useRef } from 'react'
import type { GorunumModu, HaritaAnahtari } from '../../durum/katmanlar'
import { rastgeleUreteci } from '../../model/gurultu'
import { HATA_RENKLERI, ORTU_RENKLERI, RAMPALAR } from '../../sahne/tematikRenkler'

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

const rampa =
  (renkler: string[]): Ciz =>
  (c) => {
    const g = c.createLinearGradient(0, BOYUT, BOYUT, 0)
    renkler.forEach((r, i) => g.addColorStop(i / (renkler.length - 1), r))
    c.fillStyle = g
    c.fillRect(0, 0, BOYUT, BOYUT)
  }

export type OnizlemeKimligi = GorunumModu | HaritaAnahtari

const cizimler: Record<OnizlemeKimligi, Ciz> = {
  yayilim: benekli('#e67a2a', ['#f19a3f', '#d65f1f', '#f6b45a', '#c94f18'], 520, 2),
  varis: rampa(RAMPALAR.varis),
  guven: rampa(RAMPALAR.guven),
  zamanFarki: rampa(RAMPALAR.zamanFarki),
  siddet: rampa(RAMPALAR.siddet),
  ortu: (c) => {
    const renkler = Object.values(ORTU_RENKLERI)
    renkler.forEach((renk, i) => {
      c.fillStyle = renk
      c.fillRect((i * BOYUT) / renkler.length, 0, BOYUT / renkler.length + 1, BOYUT)
    })
  },
  hata: (c) => {
    const yarim = BOYUT / 2
    c.fillStyle = HATA_RENKLERI.dogru
    c.fillRect(0, 0, BOYUT, BOYUT)
    c.fillStyle = HATA_RENKLERI.fazla
    c.fillRect(yarim, 0, yarim, yarim)
    c.fillStyle = HATA_RENKLERI.kacirilan
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
