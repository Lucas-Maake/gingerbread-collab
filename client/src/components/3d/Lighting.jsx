import { useGameStore } from '../../context/gameStore'

// Day lighting colors (warm kitchen)
const DAY_AMBIENT = { intensity: 0.4, color: '#FFF5E6' }
const DAY_MAIN = { intensity: 1.2, color: '#FFE4B5' }
const DAY_FILL = { intensity: 0.4, color: '#FFF8DC' }
const DAY_BACK = { intensity: 0.3, color: '#E6E6FA' }
const DAY_DIRECTIONAL = { intensity: 0.5, color: '#FFFFFF' }

// Night lighting colors (table stays bright, background handled by shader)
const NIGHT_AMBIENT = { intensity: 0.35, color: '#FFF0E0' }
const NIGHT_MAIN = { intensity: 1.3, color: '#FFcc88' } // Warm candlelight feel
const NIGHT_FILL = { intensity: 0.4, color: '#FFddaa' }
const NIGHT_BACK = { intensity: 0.2, color: '#8888bb' }
const NIGHT_DIRECTIONAL = { intensity: 0.4, color: '#FFeecc' }

/**
 * Scene lighting setup
 * Supports day/night modes for different atmospheres
 */
export default function Lighting() {
  const timeOfDay = useGameStore((state) => state.timeOfDay)
  const isNight = timeOfDay === 'night'

  const ambient = isNight ? NIGHT_AMBIENT : DAY_AMBIENT
  const main = isNight ? NIGHT_MAIN : DAY_MAIN
  const fill = isNight ? NIGHT_FILL : DAY_FILL
  const back = isNight ? NIGHT_BACK : DAY_BACK
  const directional = isNight ? NIGHT_DIRECTIONAL : DAY_DIRECTIONAL

  return (
    <>
      {/* Ambient light - overall illumination */}
      <ambientLight intensity={ambient.intensity} color={ambient.color} />

      {/* Main overhead light - warm kitchen/fireplace light */}
      <pointLight
        position={[0, 8, 0]}
        intensity={main.intensity}
        color={main.color}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />

      {/* Secondary fill light from side */}
      <pointLight
        position={[5, 5, 5]}
        intensity={fill.intensity}
        color={fill.color}
      />

      {/* Back light for depth */}
      <pointLight
        position={[-5, 3, -5]}
        intensity={back.intensity}
        color={back.color}
      />

      {/* Directional light for shadows */}
      <directionalLight
        position={[5, 10, 5]}
        intensity={directional.intensity}
        color={directional.color}
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
