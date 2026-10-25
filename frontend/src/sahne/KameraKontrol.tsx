import { MapControls, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { OrthographicCamera as OrtoKamera, PerspectiveCamera as PerspektifKamera, Vector3 } from 'three'
import { useHarita } from '../durum/harita'

/**
 * 3B: yörüngeli perspektif kamera. 2B: aynı sahneye tepeden ortografik bakış.
 * Her karede pusula yönü, yakınlaştırma ve ölçek harita durumuna yazılır
 * (yalnızca belirgin değişimde, gereksiz yeniden çizimi önlemek için).
 */

export const HEDEF = new Vector3(-1, 0.8, -5.5)
const BASLANGIC_3B = new Vector3(-19.5, 22.5, -24)
const FOV = 38
const VARSAYILAN_UZAKLIK = BASLANGIC_3B.distanceTo(HEDEF)
const VARSAYILAN_ORTO_ZOOM = 14

interface ControlsBenzeri {
  target: Vector3
  update: () => void
}

export function KameraKontrol() {
  const kip = useHarita((d) => d.kip)
  const son = useRef({ zoom: 0, yon: 0, pikselBasinaM: 0 })
  const yon = useRef(new Vector3())

  useFrame(({ camera, size, controls }) => {
    const kontrol = controls as unknown as ControlsBenzeri | null
    const hedef = kontrol?.target ?? HEDEF
    const d = useHarita.getState()

    // Menüden istenen yakınlaştırmayı uygula
    if (d.hedefZoom !== null) {
      if (camera instanceof PerspektifKamera) {
        yon.current.subVectors(camera.position, hedef).setLength(VARSAYILAN_UZAKLIK / d.hedefZoom)
        camera.position.copy(hedef).add(yon.current)
      } else if (camera instanceof OrtoKamera) {
        camera.zoom = VARSAYILAN_ORTO_ZOOM * d.hedefZoom
        camera.updateProjectionMatrix()
      }
      kontrol?.update()
      d.zoomTamamlandi()
    }

    let zoom = 1
    let pikselBasinaM = 1
    if (camera instanceof PerspektifKamera) {
      const uzaklik = camera.position.distanceTo(hedef)
      zoom = VARSAYILAN_UZAKLIK / uzaklik
      pikselBasinaM = (2 * uzaklik * Math.tan((camera.fov * Math.PI) / 360) * 1000) / size.height
    } else if (camera instanceof OrtoKamera) {
      zoom = camera.zoom / VARSAYILAN_ORTO_ZOOM
      pikselBasinaM = 1000 / camera.zoom
    }
    // Ekranın "yukarı" yönünün yatay izdüşümü: hem eğik 3B hem tepeden 2B için kararlı.
    yon.current.set(0, 1, 0).applyQuaternion(camera.quaternion)
    const pusula = ((Math.atan2(yon.current.x, -yon.current.z) * 180) / Math.PI + 360) % 360

    const s = son.current
    if (
      Math.abs(s.zoom - zoom) > 0.01 ||
      Math.abs(s.yon - pusula) > 0.5 ||
      Math.abs(s.pikselBasinaM - pikselBasinaM) / pikselBasinaM > 0.01
    ) {
      son.current = { zoom, yon: pusula, pikselBasinaM }
      d.kameraGuncelle(son.current)
    }
  })

  if (kip === '2B') {
    return (
      <>
        <OrthographicCamera
          makeDefault
          position={[HEDEF.x, 200, HEDEF.z + 0.001]}
          zoom={VARSAYILAN_ORTO_ZOOM}
          near={1}
          far={600}
        />
        <MapControls makeDefault target={[HEDEF.x, 0, HEDEF.z]} enableRotate={false} screenSpacePanning minZoom={4} maxZoom={400} />
      </>
    )
  }
  return (
    <>
      <PerspectiveCamera makeDefault position={BASLANGIC_3B.toArray()} fov={FOV} near={0.1} far={900} />
      <OrbitControls
        makeDefault
        target={HEDEF.toArray()}
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI * 0.46}
        minDistance={3}
        maxDistance={120}
      />
    </>
  )
}
