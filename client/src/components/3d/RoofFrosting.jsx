import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { getRoofPolygons } from '../../utils/roofGeneration'

// Frosting settings
const FROSTING_COLOR = '#FFFEF8'
const DRIP_SPACING = 0.2
const ROOF_HEIGHT = 1.5
const ROOF_OVERHANG = 0.15

/**
 * Single icicle drip mesh
 */
function IcicleDrip({ position, length }) {
  return (
    <mesh position={position} castShadow>
      <coneGeometry args={[0.04, length, 8]} />
      <meshStandardMaterial
        color={FROSTING_COLOR}
        roughness={0.2}
        metalness={0}
      />
    </mesh>
  )
}

/**
 * Frosting strip along a single roof edge
 */
function FrostingEdge({ start, end, center }) {
  const { drips, tubePoints } = useMemo(() => {
    const [x1, z1] = start
    const [x2, z2] = end
    const [cx, cz] = center

    const dx = x2 - x1
    const dz = z2 - z1
    const edgeLength = Math.sqrt(dx * dx + dz * dz)

    if (edgeLength < 0.1) return { drips: [], tubePoints: [] }

    // Direction along edge
    const dirX = dx / edgeLength
    const dirZ = dz / edgeLength

    // Perpendicular direction (pointing outward from center)
    let perpX = -dirZ
    let perpZ = dirX

    // Make sure perpendicular points away from center
    const midX = (x1 + x2) / 2
    const midZ = (z1 + z2) / 2
    const toCenterX = cx - midX
    const toCenterZ = cz - midZ
    const dot = perpX * toCenterX + perpZ * toCenterZ
    if (dot > 0) {
      perpX = -perpX
      perpZ = -perpZ
    }

    // Generate drips along the edge
    const dripList = []
    const numDrips = Math.max(2, Math.floor(edgeLength / DRIP_SPACING))

    for (let i = 0; i <= numDrips; i++) {
      const t = i / numDrips
      const x = x1 + dx * t
      const z = z1 + dz * t

      // Position at outer edge
      const edgeX = x + perpX * ROOF_OVERHANG
      const edgeZ = z + perpZ * ROOF_OVERHANG

      // Random drip length
      const dripLength = 0.1 + Math.random() * 0.25

      dripList.push({
        position: [edgeX, ROOF_HEIGHT - dripLength / 2, edgeZ],
        length: dripLength,
        key: `drip-${i}`
      })
    }

    // Create tube path points for the frosting strip
    const points = []
    const segments = Math.max(2, Math.floor(edgeLength / 0.2))
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const x = x1 + dx * t + perpX * ROOF_OVERHANG
      const z = z1 + dz * t + perpZ * ROOF_OVERHANG
      points.push(new THREE.Vector3(x, ROOF_HEIGHT, z))
    }

    return { drips: dripList, tubePoints: points }
  }, [start, end, center])

  // Create tube geometry for the frosting strip
  const tubeGeometry = useMemo(() => {
    if (tubePoints.length < 2) return null

    const curve = new THREE.CatmullRomCurve3(tubePoints)
    return new THREE.TubeGeometry(curve, tubePoints.length * 2, 0.05, 8, false)
  }, [tubePoints])

  if (!tubeGeometry) return null

  return (
    <group>
      {/* Frosting tube along edge */}
      <mesh geometry={tubeGeometry} castShadow>
        <meshStandardMaterial
          color={FROSTING_COLOR}
          roughness={0.2}
          metalness={0}
        />
      </mesh>

      {/* Icicle drips */}
      {drips.map(({ position, length, key }) => (
        <IcicleDrip key={key} position={position} length={length} />
      ))}
    </group>
  )
}

/**
 * RoofFrosting - Decorative frosting drips on roof edges
 * Creates that classic gingerbread house icing look
 */
export default function RoofFrosting() {
  const walls = useGameStore((state) => state.walls)
  const roofStyle = useGameStore((state) => state.roofStyle)
  const roofPitchAngle = useGameStore((state) => state.roofPitchAngle)

  // Get roof polygons
  const roofPolygons = useMemo(() => {
    return getRoofPolygons(walls)
  }, [walls])

  // Generate edges from polygons with their centers
  const edges = useMemo(() => {
    const allEdges = []

    roofPolygons.forEach((roof, roofIndex) => {
      const { vertices } = roof

      // Calculate center of this roof polygon
      let centerX = 0, centerZ = 0
      for (const [x, z] of vertices) {
        centerX += x
        centerZ += z
      }
      centerX /= vertices.length
      centerZ /= vertices.length
      const center = [centerX, centerZ]

      for (let i = 0; i < vertices.length; i++) {
        const start = vertices[i]
        const end = vertices[(i + 1) % vertices.length]
        allEdges.push({
          start,
          end,
          center,
          key: `roof-${roofIndex}-edge-${i}`
        })
      }
    })

    return allEdges
  }, [roofPolygons])

  if (edges.length === 0) return null

  return (
    <group name="roof-frosting">
      {edges.map(({ start, end, center, key }) => (
        <FrostingEdge
          key={key}
          start={start}
          end={end}
          center={center}
        />
      ))}
    </group>
  )
}
