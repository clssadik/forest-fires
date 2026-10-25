import { OrbitControls, Sky } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

/** 3B sahne iskeleti. Gerçek arazi (DEM mesh) Adım 1'den sonra buraya gelecek. */
export function Sahne() {
  return (
    <Canvas camera={{ position: [6, 5, 8], fov: 45 }} shadows>
      <Sky sunPosition={[10, 6, 4]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 12, 6]} intensity={1.6} castShadow />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#cdb68f" />
      </mesh>
      <mesh position={[0, 1, 0]} castShadow>
        <coneGeometry args={[0.8, 2, 7]} />
        <meshStandardMaterial color="#4c6b3c" flatShading />
      </mesh>
      <OrbitControls makeDefault />
    </Canvas>
  )
}
