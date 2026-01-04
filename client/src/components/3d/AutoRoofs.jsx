import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { getRoofPolygons } from '../../utils/roofGeneration'

const WALL_HEIGHT = 1.5
const ROOF_THICKNESS = 0.1
const ROOF_OVERHANG = 0.15
const PITCHED_ROOF_HEIGHT = 0.8 // Height of the ridge above wall top
const ROOF_COLOR = '#8B4513'
const ROOF_EMISSIVE = '#2a1507'

/**
 * Single roof polygon component
 */
function RoofPolygon({ vertices, roofStyle }) {
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

    if (roofStyle === 'pitched') {
      // Create pitched roof with triangular faces meeting at center ridge
      const geo = new THREE.BufferGeometry()
      const positions = []
      const normals = []

      const ridgeY = WALL_HEIGHT + PITCHED_ROOF_HEIGHT
      const baseY = WALL_HEIGHT

      // Create triangular faces from each edge to the center peak
      for (let i = 0; i < expandedVertices.length; i++) {
        const curr = expandedVertices[i]
        const next = expandedVertices[(i + 1) % expandedVertices.length]

        // Triangle: curr -> next -> center peak
        const v0 = [curr[0], baseY, curr[1]]
        const v1 = [next[0], baseY, next[1]]
        const v2 = [centerX, ridgeY, centerZ]

        // Calculate face normal
        const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]]
        const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]]
        const normal = [
          edge1[1] * edge2[2] - edge1[2] * edge2[1],
          edge1[2] * edge2[0] - edge1[0] * edge2[2],
          edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ]
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2)
        normal[0] /= len
        normal[1] /= len
        normal[2] /= len

        // Add triangle vertices
        positions.push(...v0, ...v1, ...v2)
        normals.push(...normal, ...normal, ...normal)
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))

      return geo
    } else {
      // Flat roof - original implementation
      const shape = new THREE.Shape()
      shape.moveTo(expandedVertices[0][0], expandedVertices[0][1])
      for (let i = 1; i < expandedVertices.length; i++) {
        shape.lineTo(expandedVertices[i][0], expandedVertices[i][1])
      }
      shape.closePath()

      const extrudeSettings = {
        depth: ROOF_THICKNESS,
        bevelEnabled: false
      }

      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)

      // Rotate to horizontal and position at wall top
      geo.rotateX(-Math.PI / 2)
      geo.translate(0, WALL_HEIGHT, 0)

      return geo
    }
  }, [vertices, roofStyle])

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
  const roofStyle = useGameStore((state) => state.roofStyle)

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
          key={`roof-${index}-${roof.vertices.length}-${roofStyle}`}
          vertices={roof.vertices}
          roofStyle={roofStyle}
        />
      ))}
    </group>
  )
}
