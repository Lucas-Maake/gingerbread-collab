import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'

// Smoke particle settings
const PARTICLE_COUNT = 40
const PARTICLE_LIFETIME = 5.0 // seconds
const RISE_SPEED = 0.1
const SPREAD = 0.15
const MAX_SIZE = 0.45
const MIN_SIZE = 0.15

/**
 * Creates a soft, circular gradient texture for smoke particles
 */
function createSmokeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')

  // Create radial gradient for soft, fuzzy appearance
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  gradient.addColorStop(0.2, 'rgba(250, 248, 245, 0.9)')
  gradient.addColorStop(0.5, 'rgba(245, 242, 238, 0.6)')
  gradient.addColorStop(0.8, 'rgba(240, 235, 230, 0.3)')
  gradient.addColorStop(1, 'rgba(235, 230, 225, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

// Shared smoke texture (recreate on hot reload by not caching in dev)
let sharedSmokeTexture = null
function getSmokeTexture() {
  // Always recreate for now to pick up changes
  sharedSmokeTexture = createSmokeTexture()
  return sharedSmokeTexture
}

/**
 * Single smoke emitter for one chimney
 */
function SmokeEmitter({ position }) {
  const particlesRef = useRef()
  const particleData = useRef([])

  // Initialize particle data
  useMemo(() => {
    particleData.current = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particleData.current.push({
        life: Math.random() * PARTICLE_LIFETIME, // Stagger initial particles
        maxLife: PARTICLE_LIFETIME,
        offsetX: (Math.random() - 0.5) * SPREAD,
        offsetZ: (Math.random() - 0.5) * SPREAD,
        speed: RISE_SPEED * (0.8 + Math.random() * 0.4),
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.5 + Math.random() * 0.5
      })
    }
  }, [])

  // Create geometry with positions and sizes
  const { geometry, sizes } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const sizesArray = new Float32Array(PARTICLE_COUNT)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1))

    return { geometry: geo, sizes: sizesArray }
  }, [])

  const smokeTexture = useMemo(() => getSmokeTexture(), [])

  // Animate particles each frame
  useFrame((state, delta) => {
    if (!particlesRef.current) return

    const positions = particlesRef.current.geometry.attributes.position.array
    const sizes = particlesRef.current.geometry.attributes.size.array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particleData.current[i]
      p.life += delta

      // Reset particle when it dies
      if (p.life >= p.maxLife) {
        p.life = 0
        p.offsetX = (Math.random() - 0.5) * SPREAD
        p.offsetZ = (Math.random() - 0.5) * SPREAD
        p.speed = RISE_SPEED * (0.8 + Math.random() * 0.4)
      }

      const lifeRatio = p.life / p.maxLife
      const height = p.life * p.speed

      // Wobble effect for organic movement
      const wobble = Math.sin(p.life * p.wobbleSpeed + p.wobblePhase) * 0.02

      // Position: start at chimney top, rise up with slight wobble
      positions[i * 3] = p.offsetX + wobble
      positions[i * 3 + 1] = height + 0.3 // Start slightly above chimney
      positions[i * 3 + 2] = p.offsetZ + wobble * 0.5

      // Size: grow then shrink
      const sizeProgress = lifeRatio < 0.3
        ? lifeRatio / 0.3 // Grow phase
        : 1 - ((lifeRatio - 0.3) / 0.7) // Shrink phase
      sizes[i] = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * sizeProgress * (1 - lifeRatio * 0.5)
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
    particlesRef.current.geometry.attributes.size.needsUpdate = true
  })

  return (
    <group position={position}>
      <points ref={particlesRef} geometry={geometry}>
        <pointsMaterial
          map={smokeTexture}
          transparent
          opacity={1.0}
          depthWrite={false}
          blending={THREE.NormalBlending}
          vertexColors={false}
          color="#e8e4e0"
          sizeAttenuation
          size={0.25}
        />
      </points>
    </group>
  )
}

/**
 * ChimneySmoke - Renders cozy steam particles above all chimneys
 */
export default function ChimneySmoke() {
  const pieces = useGameStore((state) => state.pieces)

  // Find all chimney pieces and their positions
  const chimneyPositions = useMemo(() => {
    const positions = []
    for (const [id, piece] of pieces.entries()) {
      if (piece.type === 'CHIMNEY' && piece.pos) {
        // Position smoke at top of chimney
        // Chimney height is 0.5, so add that plus a bit more
        positions.push({
          id,
          position: [piece.pos[0], piece.pos[1] + 0.25, piece.pos[2]]
        })
      }
    }
    return positions
  }, [pieces])

  if (chimneyPositions.length === 0) return null

  return (
    <group name="chimney-smoke">
      {chimneyPositions.map(({ id, position }) => (
        <SmokeEmitter key={id} position={position} />
      ))}
    </group>
  )
}
