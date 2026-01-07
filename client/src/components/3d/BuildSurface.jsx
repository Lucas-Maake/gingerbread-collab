import { useRef, useMemo } from 'react'
import * as THREE from 'three'

// Build surface dimensions (from PRD)
const WIDTH = 10
const DEPTH = 10
const THICKNESS = 0.3

// Table dimensions
const LEG_WIDTH = 0.4
const LEG_HEIGHT = 3
const APRON_HEIGHT = 0.5
const APRON_THICKNESS = 0.15
const APRON_INSET = 0.3

// Wood colors (richer, darker tones)
const WOOD_COLOR = '#A07850'
const WOOD_DARK = '#8B6842'
const WOOD_LEGS = '#966B4A'


/**
 * Generate a procedural wood grain texture using canvas
 */
function createWoodTexture(width = 512, height = 512, baseColor = WOOD_COLOR, grainDarkness = 0.15) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Parse base color
  const base = new THREE.Color(baseColor)
  const r = Math.floor(base.r * 255)
  const g = Math.floor(base.g * 255)
  const b = Math.floor(base.b * 255)

  // Fill with base color
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, width, height)

  // Add wood grain lines
  const grainCount = 40 + Math.floor(Math.random() * 20)

  for (let i = 0; i < grainCount; i++) {
    const y = (i / grainCount) * height + (Math.random() - 0.5) * 10
    const thickness = 1 + Math.random() * 3
    const waviness = 0.5 + Math.random() * 1.5
    const frequency = 0.01 + Math.random() * 0.02
    const darkness = grainDarkness * (0.5 + Math.random() * 0.5)

    ctx.beginPath()
    ctx.strokeStyle = `rgba(${Math.floor(r * (1 - darkness))}, ${Math.floor(g * (1 - darkness))}, ${Math.floor(b * (1 - darkness))}, ${0.3 + Math.random() * 0.4})`
    ctx.lineWidth = thickness

    ctx.moveTo(0, y)
    for (let x = 0; x < width; x += 2) {
      const waveY = y + Math.sin(x * frequency) * waviness * 10 + Math.sin(x * frequency * 3) * waviness * 3
      ctx.lineTo(x, waveY)
    }
    ctx.stroke()
  }

  // Add some knots randomly
  const knotCount = Math.floor(Math.random() * 3)
  for (let i = 0; i < knotCount; i++) {
    const kx = Math.random() * width
    const ky = Math.random() * height
    const kradius = 5 + Math.random() * 15

    const gradient = ctx.createRadialGradient(kx, ky, 0, kx, ky, kradius)
    gradient.addColorStop(0, `rgba(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.4)}, ${Math.floor(b * 0.3)}, 0.6)`)
    gradient.addColorStop(0.5, `rgba(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.5)}, 0.3)`)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.ellipse(kx, ky, kradius, kradius * 0.7, Math.random() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // Add subtle noise for texture
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10
    data[i] = Math.max(0, Math.min(255, data[i] + noise))
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
  }
  ctx.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping

  return texture
}

/**
 * Build surface - the table where pieces are placed
 */
export default function BuildSurface() {
  const meshRef = useRef()

  // Create wood grain textures (memoized to avoid recreation)
  const textures = useMemo(() => {
    const tabletopTex = createWoodTexture(1024, 1024, WOOD_COLOR, 0.12)
    tabletopTex.repeat.set(2, 2)

    const legTex = createWoodTexture(256, 512, WOOD_LEGS, 0.18)
    legTex.repeat.set(1, 3)

    const apronTex = createWoodTexture(512, 128, WOOD_DARK, 0.2)
    apronTex.repeat.set(4, 1)

    return { tabletopTex, legTex, apronTex }
  }, [])

  // Leg positions (corners, slightly inset)
  const legPositions = useMemo(() => {
    const inset = LEG_WIDTH / 2 + 0.2
    return [
      [-WIDTH / 2 + inset, -LEG_HEIGHT / 2 - THICKNESS, -DEPTH / 2 + inset],
      [WIDTH / 2 - inset, -LEG_HEIGHT / 2 - THICKNESS, -DEPTH / 2 + inset],
      [-WIDTH / 2 + inset, -LEG_HEIGHT / 2 - THICKNESS, DEPTH / 2 - inset],
      [WIDTH / 2 - inset, -LEG_HEIGHT / 2 - THICKNESS, DEPTH / 2 - inset],
    ]
  }, [])

  return (
    <group>
      {/* Main tabletop surface */}
      <mesh
        ref={meshRef}
        name="build-surface"
        position={[0, -THICKNESS / 2, 0]}
        receiveShadow
        castShadow
        userData={{ isBuildSurface: true }}
      >
        <boxGeometry args={[WIDTH, THICKNESS, DEPTH]} />
        <meshStandardMaterial
          map={textures.tabletopTex}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>

      {/* Tabletop edge/trim */}
      <mesh position={[0, -THICKNESS + 0.025, 0]} raycast={() => null}>
        <boxGeometry args={[WIDTH + 0.1, 0.05, DEPTH + 0.1]} />
        <meshStandardMaterial
          color={WOOD_DARK}
          roughness={0.8}
          metalness={0}
        />
      </mesh>

      {/* Table legs */}
      {legPositions.map((pos, i) => (
        <mesh
          key={`leg-${i}`}
          position={pos}
          castShadow
          receiveShadow
          raycast={() => null}
        >
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_WIDTH]} />
          <meshStandardMaterial
            map={textures.legTex}
            roughness={0.75}
            metalness={0.05}
          />
        </mesh>
      ))}

      {/* Apron - front */}
      <mesh
        position={[0, -THICKNESS - APRON_HEIGHT / 2, -DEPTH / 2 + APRON_INSET]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[WIDTH - LEG_WIDTH * 2, APRON_HEIGHT, APRON_THICKNESS]} />
        <meshStandardMaterial map={textures.apronTex} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Apron - back */}
      <mesh
        position={[0, -THICKNESS - APRON_HEIGHT / 2, DEPTH / 2 - APRON_INSET]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[WIDTH - LEG_WIDTH * 2, APRON_HEIGHT, APRON_THICKNESS]} />
        <meshStandardMaterial map={textures.apronTex} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Apron - left */}
      <mesh
        position={[-WIDTH / 2 + APRON_INSET, -THICKNESS - APRON_HEIGHT / 2, 0]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[APRON_THICKNESS, APRON_HEIGHT, DEPTH - LEG_WIDTH * 2]} />
        <meshStandardMaterial map={textures.apronTex} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Apron - right */}
      <mesh
        position={[WIDTH / 2 - APRON_INSET, -THICKNESS - APRON_HEIGHT / 2, 0]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[APRON_THICKNESS, APRON_HEIGHT, DEPTH - LEG_WIDTH * 2]} />
        <meshStandardMaterial map={textures.apronTex} roughness={0.8} metalness={0.05} />
      </mesh>

    </group>
  )
}

