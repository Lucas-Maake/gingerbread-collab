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

// Soft brown color for table
const WOOD_COLOR = '#C9A07A'
const WOOD_DARK = '#A8845C'
const WOOD_LEGS = '#B8956A'

// Icing colors
const ICING_COLOR = '#FFFEF8'

/**
 * Build surface - the table where pieces are placed
 */
export default function BuildSurface() {
  const meshRef = useRef()

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
        position={[0, -THICKNESS / 2, 0]}
        receiveShadow
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[WIDTH, THICKNESS, DEPTH]} />
        <meshStandardMaterial
          color={WOOD_COLOR}
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
            color={WOOD_LEGS}
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
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Apron - back */}
      <mesh
        position={[0, -THICKNESS - APRON_HEIGHT / 2, DEPTH / 2 - APRON_INSET]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[WIDTH - LEG_WIDTH * 2, APRON_HEIGHT, APRON_THICKNESS]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Apron - left */}
      <mesh
        position={[-WIDTH / 2 + APRON_INSET, -THICKNESS - APRON_HEIGHT / 2, 0]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[APRON_THICKNESS, APRON_HEIGHT, DEPTH - LEG_WIDTH * 2]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} metalness={0.05} />
      </mesh>

      {/* Apron - right */}
      <mesh
        position={[WIDTH / 2 - APRON_INSET, -THICKNESS - APRON_HEIGHT / 2, 0]}
        castShadow
        raycast={() => null}
      >
        <boxGeometry args={[APRON_THICKNESS, APRON_HEIGHT, DEPTH - LEG_WIDTH * 2]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.8} metalness={0.05} />
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
