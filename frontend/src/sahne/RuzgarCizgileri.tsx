import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, Color, InstancedMesh, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { useZaman } from '../durum/zaman'
import { rastgeleUreteci } from '../model/gurultu'
import type { OlayVerisi } from '../olay/veri'
import { yanginUniformlari } from './yanginMalzemesi'

/**
 * Rüzgâr vektörleri katmanı: arazinin üzerinde rüzgâr yönünde akan beyaz
 * çizgiler. Yön ve hız global zamanda tutuşma noktasındaki saatlik rüzgârdan gelir
 * (hava verisi ~25 km çözünürlüklü; bölge içinde değişim küçük).
 */

const ADET = 900

interface Cizgi {
  x: number
  z: number
  omur: number
  yas: number
}

export function RuzgarCizgileri({ veri, opaklik }: { veri: OlayVerisi; opaklik: number }) {
  const bolge = useMemo(
    () => ({ x0: -veri.genislikKm / 2, x1: veri.genislikKm / 2, z0: -veri.yukseklikKm / 2, z1: veri.yukseklikKm / 2 }),
    [veri],
  )
  const ref = useRef<InstancedMesh>(null)
  const r = useMemo(() => rastgeleUreteci(5), [])
  const geometri = useMemo(() => {
    const g = new PlaneGeometry(1.4, 0.035, 8, 1)
    g.rotateX(-Math.PI / 2)
    // Kuyruk karanlık (eklemeli karışımda saydam), baş beyaz.
    const p = g.attributes.position
    const renk = new Float32Array(p.count * 3)
    for (let i = 0; i < p.count; i++) {
      const k = Math.pow((p.getX(i) + 0.7) / 1.4, 1.6)
      renk.set([k, k, k], i * 3)
    }
    g.setAttribute('color', new BufferAttribute(renk, 3))
    return g
  }, [])

  // Parçacık durumu her karede değişir; React durumu değil, ref'te tutulur.
  const cizgiler = useRef<Cizgi[] | null>(null)

  const yardimci = useMemo(
    () => ({ m: new Matrix4(), q: new Quaternion(), v: new Vector3(), s: new Vector3(1, 1, 1), c: new Color(), y: new Vector3(0, 1, 0) }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < ADET; i++) mesh.setColorAt(i, yardimci.c.setRGB(0, 0, 0))
  }, [yardimci])

  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh || !mesh.visible) return
    const h = veri.hava(useZaman.getState().t)
    // Rüzgârın estiği yön = geldiği yön + 180°
    const yon = ((h.ruzgarYonu + 180) * Math.PI) / 180
    const dx = Math.sin(yon)
    const dz = -Math.cos(yon)
    const hiz = 0.5 + h.ruzgarKmSa * 0.06 // km/s (sahne), görsel ölçek
    const { m, q, v, s, c, y } = yardimci
    q.setFromAxisAngle(y, Math.atan2(-dz, dx))
    const adim = Math.min(dt, 0.05)
    cizgiler.current ??= Array.from({ length: ADET }, () => ({
      x: bolge.x0 + r() * (bolge.x1 - bolge.x0),
      z: bolge.z0 + r() * (bolge.z1 - bolge.z0),
      omur: 1.6 + r() * 2.2,
      yas: r() * 3,
    }))
    for (let i = 0; i < ADET; i++) {
      const p = cizgiler.current[i]
      p.yas += adim
      if (p.yas > p.omur) {
        p.x = bolge.x0 + r() * (bolge.x1 - bolge.x0)
        p.z = bolge.z0 + r() * (bolge.z1 - bolge.z0)
        p.yas = 0
        p.omur = 1.6 + r() * 2.2
      }
      p.x += dx * hiz * adim
      p.z += dz * hiz * adim
      const parlaklik = Math.sin((p.yas / p.omur) * Math.PI) * opaklik
      v.set(p.x, veri.araziY(p.x, p.z) * yanginUniformlari.uKabartma.value + 0.3, p.z)
      m.compose(v, q, s)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.setScalar(parlaklik))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[geometri, undefined, ADET]} visible={opaklik > 0} frustumCulled={false}>
      <meshBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
    </instancedMesh>
  )
}
