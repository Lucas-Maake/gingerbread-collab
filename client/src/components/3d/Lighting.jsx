/**
 * Scene lighting setup
 * Warm kitchen-like overhead lighting for cozy Christmas vibe
 */
export default function Lighting() {
  return (
    <>
      {/* Ambient light - soft overall illumination */}
      <ambientLight intensity={0.4} color="#FFF5E6" />

      {/* Main overhead light - warm kitchen light */}
      <pointLight
        position={[0, 8, 0]}
        intensity={1.2}
        color="#FFE4B5"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />

      {/* Secondary fill light from side */}
      <pointLight
        position={[5, 5, 5]}
        intensity={0.4}
        color="#FFF8DC"
      />

      {/* Back light for depth */}
      <pointLight
        position={[-5, 3, -5]}
        intensity={0.3}
        color="#E6E6FA"
      />

      {/* Directional light for shadows */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.5}
        color="#FFFFFF"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
    </>
  )
}
