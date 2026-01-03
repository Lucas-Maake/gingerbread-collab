import { useRef, useMemo } from 'react'
import * as THREE from 'three'

// Build surface dimensions (from PRD)
const WIDTH = 10
const DEPTH = 10
const THICKNESS = 0.2

// Soft brown color for table
const WOOD_COLOR = '#C9A07A'
const WOOD_DARK = '#A8845C'

// Icing colors
const ICING_COLOR = '#FFFEF8'

/**
 * Build surface - the table/plate where pieces are placed
 */
export default function BuildSurface() {
  const meshRef = useRef()

  return (
    <group>
      {/* Main surface - raycast disabled so pieces can be clicked */}
      <mesh
        ref={meshRef}
        position={[0, -THICKNESS / 2, 0]}
        receiveShadow
        raycast={() => null}
      >
        <boxGeometry args={[WIDTH, THICKNESS, DEPTH]} />
        <meshStandardMaterial
          color={WOOD_COLOR}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Surface border/trim - raycast disabled */}
      <mesh position={[0, 0, 0]} raycast={() => null}>
        <boxGeometry args={[WIDTH + 0.2, 0.05, DEPTH + 0.2]} />
        <meshStandardMaterial
          color={WOOD_DARK}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Icing grid lines */}
      <IcingGrid />
    </group>
  )
}

/**
 * Icing-style grid lines - white, slightly raised, rounded appearance
 */
function IcingGrid() {
  const gridSize = 10
  const cellSize = 1 // 1 unit cells
  const lineWidth = 0.04
  const lineHeight = 0.02

  // Generate grid line meshes
  const lines = useMemo(() => {
    const result = []
    const halfSize = gridSize / 2
    const numLines = gridSize / cellSize + 1

    // Create lines along X axis (running in Z direction)
    for (let i = 0; i < numLines; i++) {
      const x = -halfSize + i * cellSize
      result.push({
        key: `x-${i}`,
        position: [x, lineHeight / 2 + 0.01, 0],
        size: [lineWidth, lineHeight, gridSize],
        isEdge: i === 0 || i === numLines - 1
      })
    }

    // Create lines along Z axis (running in X direction)
    for (let i = 0; i < numLines; i++) {
      const z = -halfSize + i * cellSize
      result.push({
        key: `z-${i}`,
        position: [0, lineHeight / 2 + 0.01, z],
        size: [gridSize, lineHeight, lineWidth],
        isEdge: i === 0 || i === numLines - 1
      })
    }

    return result
  }, [])

  return (
    <group>
      {lines.map((line) => (
        <mesh
          key={line.key}
          position={line.position}
          raycast={() => null}
        >
          <boxGeometry args={line.size} />
          <meshStandardMaterial
            color={ICING_COLOR}
            roughness={0.3}
            metalness={0}
            transparent
            opacity={line.isEdge ? 0.9 : 0.6}
          />
        </mesh>
      ))}
    </group>
  )
}
