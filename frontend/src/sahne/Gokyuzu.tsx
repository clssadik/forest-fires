import { BackSide, Color } from 'three'

/** Hafif aydınlık ufuk → siyah tepe geçişli gökyüzü kubbesi. */
const UST = new Color('#000000')
const UFUK = new Color('#141414')

export function Gokyuzu() {
  return (
    <mesh scale={600} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={{ uUst: { value: UST }, uUfuk: { value: UFUK } }}
        vertexShader={/* glsl */ `
          varying vec3 vYon;
          void main() {
            vYon = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`}
        fragmentShader={/* glsl */ `
          uniform vec3 uUst;
          uniform vec3 uUfuk;
          varying vec3 vYon;
          void main() {
            float k = smoothstep(-0.02, 0.45, vYon.y);
            gl_FragColor = vec4(mix(uUfuk, uUst, k), 1.0);
            #include <colorspace_fragment>
          }`}
      />
    </mesh>
  )
}
