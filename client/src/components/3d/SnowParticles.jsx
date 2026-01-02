import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Number of snowflakes (50-100 for performance per PRD)
const SNOWFLAKE_COUNT = 75

// Snow bounds
const BOUNDS = {
  x: 15,
  y: 12,
  z: 15
}

/**
 * Gentle snow particle effect
 * Visual only, no physics interaction
 */
export default function SnowParticles() {
  const pointsRef = useRef()

  // Generate initial snowflake positions
  const particles = useMemo(() => {
    const positions = new Float32Array(SNOWFLAKE_COUNT * 3)
    const velocities = new Float32Array(SNOWFLAKE_COUNT * 3)
    const sizes = new Float32Array(SNOWFLAKE_COUNT)

    for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
      // Random position within bounds
      positions[i * 3] = (Math.random() - 0.5) * BOUNDS.x * 2
      positions[i * 3 + 1] = Math.random() * BOUNDS.y
      positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2

      // Random velocities (mostly downward with slight drift)
      velocities[i * 3] = (Math.random() - 0.5) * 0.02 // x drift
      velocities[i * 3 + 1] = -0.02 - Math.random() * 0.02 // y fall speed
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02 // z drift

      // Random sizes
      sizes[i] = 0.03 + Math.random() * 0.05
    }

    return { positions, velocities, sizes }
  }, [])

  // Animate snowflakes
  useFrame((state, delta) => {
    if (!pointsRef.current) return

    const positions = pointsRef.current.geometry.attributes.position.array
    const velocities = particles.velocities

    for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
      // Apply velocity
      positions[i * 3] += velocities[i * 3]
      positions[i * 3 + 1] += velocities[i * 3 + 1]
      positions[i * 3 + 2] += velocities[i * 3 + 2]

      // Add slight wavering motion
      positions[i * 3] += Math.sin(state.clock.elapsedTime + i) * 0.001
      positions[i * 3 + 2] += Math.cos(state.clock.elapsedTime * 0.7 + i) * 0.001

      // Reset when below ground
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = BOUNDS.y
        positions[i * 3] = (Math.random() - 0.5) * BOUNDS.x * 2
        positions[i * 3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={SNOWFLAKE_COUNT}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={SNOWFLAKE_COUNT}
          array={particles.sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.05}
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
