import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Maximum snowflakes (we allocate this many, but may show fewer)
const MAX_SNOWFLAKE_COUNT = 500

// Snow bounds
const BOUNDS = {
  x: 15,
  y: 12,
  z: 15
}

// Get initial snow count from localStorage
function getInitialSnowCount() {
  const saved = localStorage.getItem('snowLevel')
  const levels = { OFF: 0, LIGHT: 100, MEDIUM: 250, HEAVY: 500 }
  return levels[saved] ?? 250
}

/**
 * Gentle snow particle effect
 * Visual only, no physics interaction
 */
export default function SnowParticles() {
  const pointsRef = useRef()
  const [activeCount, setActiveCount] = useState(getInitialSnowCount)

  // Listen for intensity changes
  useEffect(() => {
    const handleIntensityChange = (e) => {
      setActiveCount(e.detail.count)
    }

    window.addEventListener('snowIntensityChange', handleIntensityChange)
    return () => window.removeEventListener('snowIntensityChange', handleIntensityChange)
  }, [])

  // Generate initial snowflake positions (allocate max, show activeCount)
  const particles = useMemo(() => {
    const positions = new Float32Array(MAX_SNOWFLAKE_COUNT * 3)
    const velocities = new Float32Array(MAX_SNOWFLAKE_COUNT * 3)
    const sizes = new Float32Array(MAX_SNOWFLAKE_COUNT)

    for (let i = 0; i < MAX_SNOWFLAKE_COUNT; i++) {
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
    if (!pointsRef.current || activeCount === 0) return

    const positions = pointsRef.current.geometry.attributes.position.array
    const velocities = particles.velocities

    for (let i = 0; i < activeCount; i++) {
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

  // Don't render if snow is off
  if (activeCount === 0) {
    return null
  }

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={activeCount}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={activeCount}
          array={particles.sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.08}
        transparent
        opacity={0.95}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}
