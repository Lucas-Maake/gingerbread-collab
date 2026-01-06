import { useMemo } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../../context/gameStore'
import { getRoofPolygons } from '../../utils/roofGeneration'

const WALL_HEIGHT = 1.5
const ROOF_THICKNESS = 0.1
const ROOF_OVERHANG = 0.15
const ROOF_EMISSIVE = '#4a3020'

// Calculate pitched roof height based on angle and average roof span
function calculateRoofHeight(vertices, angleDegrees) {
  // Find the average distance from center to edges (approximate roof span / 2)
  const centerX = vertices.reduce((sum, [x]) => sum + x, 0) / vertices.length
  const centerZ = vertices.reduce((sum, [, z]) => sum + z, 0) / vertices.length

  let avgDist = 0
  for (const [x, z] of vertices) {
    avgDist += Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2)
  }
  avgDist /= vertices.length

  // Height = distance * tan(angle)
  const angleRadians = (angleDegrees * Math.PI) / 180
  return avgDist * Math.tan(angleRadians)
}

/**
 * Create a procedural gingerbread texture for roofs
 */
function createGingerbreadTexture(width = 256, height = 256) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Base gingerbread color (lighter, similar to table but slightly darker)
  const baseR = 176, baseG = 140, baseB = 98 // Slightly darker than walls

  ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`
  ctx.fillRect(0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4

      const patchNoise = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 15
      const medNoise = (Math.random() - 0.5) * 20

      const poreChance = Math.random()
      let poreEffect = 0
      if (poreChance > 0.97) {
        poreEffect = -25
      } else if (poreChance > 0.94) {
        poreEffect = 15
      }

      const bandNoise = Math.sin(y * 0.3) * 5
      const totalNoise = patchNoise + medNoise + poreEffect + bandNoise

      data[i] = Math.max(0, Math.min(255, baseR + totalNoise))
      data[i + 1] = Math.max(0, Math.min(255, baseG + totalNoise * 0.6))
      data[i + 2] = Math.max(0, Math.min(255, baseB + totalNoise * 0.3))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const edgeSpots = 5 + Math.floor(Math.random() * 5)
  for (let i = 0; i < edgeSpots; i++) {
    const spotX = Math.random() * width
    const spotY = Math.random() * height
    const spotRadius = 3 + Math.random() * 8

    const gradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotRadius)
    gradient.addColorStop(0, 'rgba(130, 95, 55, 0.25)')
    gradient.addColorStop(1, 'rgba(130, 95, 55, 0)')

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(spotX, spotY, spotRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)

  return texture
}

// Shared roof texture
let sharedRoofTexture = null
function getRoofTexture() {
  if (!sharedRoofTexture) {
    sharedRoofTexture = createGingerbreadTexture(512, 512)
  }
  return sharedRoofTexture
}

/**
 * Single roof polygon component
 */
function RoofPolygon({ vertices, roofStyle, pitchAngle }) {
  const texture = useMemo(() => getRoofTexture(), [])

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

      // Calculate roof height based on pitch angle
      const pitchedRoofHeight = calculateRoofHeight(expandedVertices, pitchAngle)
      const ridgeY = WALL_HEIGHT + pitchedRoofHeight
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
      // Use +π/2 so that shape Y (which holds worldZ) maps to +Z in world space
      geo.rotateX(Math.PI / 2)
      geo.translate(0, WALL_HEIGHT, 0)

      return geo
    }
  }, [vertices, roofStyle, pitchAngle])

  if (!geometry) return null

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        map={texture}
        emissive={ROOF_EMISSIVE}
        emissiveIntensity={0.1}
        roughness={0.85}
        metalness={0.05}
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
  const roofPitchAngle = useGameStore((state) => state.roofPitchAngle)

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
          key={`roof-${index}-${roof.vertices.length}-${roofStyle}-${roofPitchAngle}`}
          vertices={roof.vertices}
          roofStyle={roofStyle}
          pitchAngle={roofPitchAngle}
        />
      ))}
    </group>
  )
}
