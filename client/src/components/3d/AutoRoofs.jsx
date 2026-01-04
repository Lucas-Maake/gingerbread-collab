import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { getRoofPolygons } from '../../utils/roofGeneration'

const WALL_HEIGHT = 1.5
const ROOF_THICKNESS = 0.1
const ROOF_OVERHANG = 0.15
const ROOF_COLOR = '#8B4513'
const ROOF_EMISSIVE = '#2a1507'

/**
 * Single roof polygon component
 */
function RoofPolygon({ vertices }) {
  const geometry = useMemo(() => {
    if (vertices.length < 3) return null

    // Calculate centroid for expansion
    const centerX = vertices.reduce((sum, [x]) => sum + x, 0) / vertices.length
    const centerZ = vertices.reduce((sum, [, z]) => sum + z, 0) / vertices.length

    // Expand vertices for overhang
    const expandedVertices = vertices.map(([x, z]) => {
      const dx = x - centerX
      const dz = z - centerZ
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 0.01) return [x, z]
      const scale = (dist + ROOF_OVERHANG) / dist
      return [centerX + dx * scale, centerZ + dz * scale]
    })

    // Create shape
    const shape = new THREE.Shape()
    shape.moveTo(expandedVertices[0][0], expandedVertices[0][1])
    for (let i = 1; i < expandedVertices.length; i++) {
      shape.lineTo(expandedVertices[i][0], expandedVertices[i][1])
    }
    shape.closePath()

    // Extrude
    const extrudeSettings = {
      depth: ROOF_THICKNESS,
      bevelEnabled: false
    }

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)

    // Rotate to horizontal and position at wall top
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, WALL_HEIGHT, 0)

    return geo
  }, [vertices])

  if (!geometry) return null

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={ROOF_COLOR}
        emissive={ROOF_EMISSIVE}
        emissiveIntensity={0.1}
        roughness={0.8}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * Auto-generated roofs that cover enclosed wall areas
 * Roofs are computed client-side from wall data
 */
export default function AutoRoofs() {
  const walls = useGameStore((state) => state.walls)

  // Compute roof polygons from walls
  // This is memoized and will only recompute when walls change
  const roofPolygons = useMemo(() => {
    return getRoofPolygons(walls)
  }, [walls])

  if (roofPolygons.length === 0) return null

  return (
    <group name="auto-roofs">
      {roofPolygons.map((roof, index) => (
        <RoofPolygon
          key={`roof-${index}-${roof.vertices.length}`}
          vertices={roof.vertices}
        />
      ))}
    </group>
  )
}
