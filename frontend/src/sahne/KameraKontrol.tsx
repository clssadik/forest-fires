import { MapControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { OrthographicCamera as OrtoKamera, PerspectiveCamera as PerspektifKamera, Spherical, Vector3 } from 'three'
import { useHarita } from '../durum/harita'
import { ARAZI_BOYUT_KM, ARAZI_MERKEZ_Z, araziY } from '../model/arazi'

/**
 * 3B: eğik perspektif kamera. 2B: aynı sahneye tepeden ortografik bakış.
 * Fare, Google Haritalar'daki gibi: sol tuşla sürükleme zeminde kaydırır, sağ tuş (ya da
 * ⇧ Shift / ⌘ / Ctrl + sol tuş; trackpad için kolay yol) 3B'de döndürüp eğer, tekerlek ve
 * iki parmak imlecin olduğu yere yakınlaşır. Döndürme düğmeleri ve pusula `donme` isteği verir.
 * Bakılan nokta arazinin dışına çıkamaz. "Tutuşmaya git" isteği yumuşak bir uçuşla uygulanır.
 * Her karede pusula yönü, yakınlaştırma ve ölçek harita durumuna yazılır
 * (yalnızca belirgin değişimde, gereksiz yeniden çizimi önlemek için).
 */

export const HEDEF = new Vector3(-1, 0.8, -5.5)
const BASLANGIC_3B = new Vector3(-19.5, 22.5, -24)
const FOV = 38
const VARSAYILAN_UZAKLIK = BASLANGIC_3B.distanceTo(HEDEF)
const VARSAYILAN_ORTO_ZOOM = 14
/** Bakılan noktanın arazi kenarına en fazla yaklaşabileceği yer (km, merkezden). */
const SINIR_KM = ARAZI_BOYUT_KM / 2 - 8
/** Odaklanınca yakınlaştırma (varsayılana oran) ve uçuş süresi. */
const ODAK_ZOOM = 1.8
const UCUS_MS = 1200
const DONUS_MS = 450
const EN_DIK = 0.12 // rad; tepeden bakışa en fazla bu kadar yaklaşılır
const EN_EGIK = Math.PI * 0.46 // MapControls'taki maxPolarAngle ile aynı

const yumusat = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Bakılan nokta çevresinde küresel koordinatta dönüş (konum doğrusal karışsa yarıçap kısalırdı). */
interface Donus {
  baslangic: number
  teta0: number
  teta1: number
  fi0: number
  fi1: number
}

interface Ucus {
  baslangic: number
  hedef0: Vector3
  hedef1: Vector3
  kamera0: Vector3
  kamera1: Vector3
  zoom0: number
  zoom1: number
}

interface ControlsBenzeri {
  target: Vector3
  update: () => void
}

export function KameraKontrol() {
  const kip = useHarita((d) => d.kip)
  const son = useRef({ zoom: 0, yon: 0, pikselBasinaM: 0 })
  const yon = useRef(new Vector3())
  const ucus = useRef<Ucus | null>(null)
  const kayma = useRef(new Vector3())
  const donus = useRef<Donus | null>(null)
  const kure = useRef(new Spherical())

  useFrame(({ camera, size, controls }) => {
    const kontrol = controls as unknown as ControlsBenzeri | null
    const hedef = kontrol?.target ?? HEDEF
    const d = useHarita.getState()

    // "Tutuşmaya git": bakış yönü korunur, bakılan nokta ve uzaklık yumuşakça değişir.
    if (d.odak && kontrol) {
      const hedef1 = new Vector3(d.odak.x, araziY(d.odak.x, d.odak.z), d.odak.z)
      const kamera1 = camera.position.clone().sub(hedef)
      if (camera instanceof PerspektifKamera) kamera1.setLength(VARSAYILAN_UZAKLIK / ODAK_ZOOM)
      kamera1.add(hedef1)
      const zoom0 = camera instanceof OrtoKamera ? camera.zoom : 1
      ucus.current = {
        baslangic: performance.now(),
        hedef0: hedef.clone(),
        hedef1,
        kamera0: camera.position.clone(),
        kamera1,
        zoom0,
        zoom1: camera instanceof OrtoKamera ? VARSAYILAN_ORTO_ZOOM * ODAK_ZOOM * 2 : 1,
      }
      d.odakTamamlandi()
    }
    if (d.donme && kontrol && camera instanceof PerspektifKamera) {
      const k0 = kure.current.setFromVector3(yon.current.subVectors(camera.position, hedef))
      // teta = 0: kamera hedefin güneyinde, kuzeye bakıyor. En kısa yönden dön.
      let teta1 = d.donme.kuzey ? 0 : k0.theta + (d.donme.yatay * Math.PI) / 180
      teta1 = k0.theta + Math.atan2(Math.sin(teta1 - k0.theta), Math.cos(teta1 - k0.theta))
      const fi1 = Math.min(Math.max(k0.phi + (d.donme.dikey * Math.PI) / 180, EN_DIK), EN_EGIK)
      donus.current = { baslangic: performance.now(), teta0: k0.theta, teta1, fi0: k0.phi, fi1 }
      d.donmeTamamlandi()
    } else if (d.donme) d.donmeTamamlandi()
    if (donus.current && kontrol) {
      const r = donus.current
      const e = yumusat(Math.min((performance.now() - r.baslangic) / DONUS_MS, 1))
      const k = kure.current.setFromVector3(yon.current.subVectors(camera.position, hedef))
      k.theta = r.teta0 + (r.teta1 - r.teta0) * e
      k.phi = r.fi0 + (r.fi1 - r.fi0) * e
      camera.position.setFromSpherical(k).add(hedef)
      kontrol.update()
      if (e >= 1) donus.current = null
    }
    if (ucus.current && kontrol) {
      const u = ucus.current
      const o = Math.min((performance.now() - u.baslangic) / UCUS_MS, 1)
      const e = yumusat(o)
      kontrol.target.lerpVectors(u.hedef0, u.hedef1, e)
      camera.position.lerpVectors(u.kamera0, u.kamera1, e)
      if (camera instanceof OrtoKamera) {
        camera.zoom = u.zoom0 + (u.zoom1 - u.zoom0) * e
        camera.updateProjectionMatrix()
      }
      kontrol.update()
      if (o >= 1) ucus.current = null
    } else if (kontrol) {
      // Arazi sınırı: bakılan nokta dışarı taşarsa kamera da aynı kadar geri alınır.
      const t = kontrol.target
      kayma.current.set(
        Math.min(Math.max(t.x, -SINIR_KM), SINIR_KM) - t.x,
        0,
        Math.min(Math.max(t.z, ARAZI_MERKEZ_Z - SINIR_KM), ARAZI_MERKEZ_Z + SINIR_KM) - t.z,
      )
      if (kayma.current.lengthSq() > 0) {
        t.add(kayma.current)
        camera.position.add(kayma.current)
      }
    }

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
        <MapControls
          makeDefault
          target={[HEDEF.x, 0, HEDEF.z]}
          enableRotate={false}
          screenSpacePanning
          zoomToCursor
          minZoom={4}
          maxZoom={400}
        />
      </>
    )
  }
  return (
    <>
      <PerspectiveCamera makeDefault position={BASLANGIC_3B.toArray()} fov={FOV} near={0.1} far={900} />
      {/* MapControls: sol tuş kaydırır, sağ tuş döndürür; kaydırma zemin düzleminde. */}
      <MapControls
        makeDefault
        target={HEDEF.toArray()}
        enableDamping
        dampingFactor={0.12}
        screenSpacePanning={false}
        zoomToCursor
        maxPolarAngle={Math.PI * 0.46}
        minDistance={3}
        maxDistance={120}
      />
    </>
  )
}
