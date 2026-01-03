import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Build surface dimensions (from PRD)
const WIDTH = 10
const DEPTH = 10
const THICKNESS = 0.2

// Soft brown color for table
const WOOD_COLOR = '#C9A07A'
const WOOD_DARK = '#A8845C'

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

      {/* Grid lines for visual reference */}
      <GridLines />
    </group>
  )
}

/**
 * Grid lines overlay for placement guidance
 */
function GridLines() {
  const gridRef = useRef()

  // Create grid lines
  const gridSize = 10
  const divisions = 40 // 0.25 cell size

  return (
    <gridHelper
      ref={gridRef}
      args={[gridSize, divisions, '#ffffff22', '#ffffff11']}
      position={[0, 0.01, 0]}
      rotation={[0, 0, 0]}
    />
  )
}
