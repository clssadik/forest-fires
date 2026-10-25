import { sahneY } from '../model/arazi'
import { baraj } from '../veri/ornekSenaryo'

/** Deniz (güneyde) ve baraj gölü yüzeyleri. */
export function Su() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 60]}>
        <planeGeometry args={[400, 120]} />
        <meshStandardMaterial color="#6f93a6" roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} rotation-z={baraj.aci} position={[baraj.x, sahneY(baraj.suSeviyesiM), baraj.z]}
        scale={[baraj.yaricapX * 1.15, baraj.yaricapZ * 1.3, 1]}
      >
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#5f8aa3" roughness={0.3} metalness={0.05} />
      </mesh>
    </>
  )
}
