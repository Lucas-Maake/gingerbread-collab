import * as THREE from 'three'

const EPSILON = 0.15 // Tolerance for endpoint matching
const WALL_HEIGHT = 1.5
const ROOF_THICKNESS = 0.1
const ROOF_OVERHANG = 0.1

/**
 * Find all enclosed polygons formed by connected walls
 * Returns array of polygons, each polygon is an array of [x, z] vertices in order
 */
export function findEnclosedPolygons(walls) {
  if (walls.length < 3) return []

  // Build adjacency graph from wall endpoints
  const graph = buildGraph(walls)

  // Find all simple cycles (enclosed areas)
  const cycles = findAllCycles(graph)

  // Filter to minimal cycles (no overlapping)
  const minimalCycles = filterMinimalCycles(cycles)

  return minimalCycles
}

/**
 * Build adjacency graph from walls
 * Each node is a position key, edges connect wall endpoints
 */
function buildGraph(walls) {
  const graph = new Map() // Map<posKey, Set<posKey>>

  const getPosKey = (x, z) => `${x.toFixed(2)},${z.toFixed(2)}`

  const addEdge = (from, to) => {
    if (!graph.has(from)) graph.set(from, new Set())
    if (!graph.has(to)) graph.set(to, new Set())
    graph.get(from).add(to)
    graph.get(to).add(from)
  }

  // Normalize endpoints - walls might not perfectly connect, so cluster nearby points
  const allPoints = []
  walls.forEach(wall => {
    allPoints.push({ x: wall.start[0], z: wall.start[1], wall, isStart: true })
    allPoints.push({ x: wall.end[0], z: wall.end[1], wall, isStart: false })
  })

  // Cluster nearby points
  const clusters = []
  const assigned = new Set()

  for (let i = 0; i < allPoints.length; i++) {
    if (assigned.has(i)) continue

    const cluster = [allPoints[i]]
    assigned.add(i)

    for (let j = i + 1; j < allPoints.length; j++) {
      if (assigned.has(j)) continue

      const dx = allPoints[i].x - allPoints[j].x
      const dz = allPoints[i].z - allPoints[j].z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < EPSILON) {
        cluster.push(allPoints[j])
        assigned.add(j)
      }
    }

    // Average position for cluster
    const avgX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length
    const avgZ = cluster.reduce((sum, p) => sum + p.z, 0) / cluster.length
    const key = getPosKey(avgX, avgZ)

    clusters.push({ key, x: avgX, z: avgZ, points: cluster })
  }

  // Build edges
  walls.forEach(wall => {
    const startCluster = clusters.find(c =>
      c.points.some(p => p.wall === wall && p.isStart)
    )
    const endCluster = clusters.find(c =>
      c.points.some(p => p.wall === wall && !p.isStart)
    )

    if (startCluster && endCluster && startCluster.key !== endCluster.key) {
      addEdge(startCluster.key, endCluster.key)
    }
  })

  // Store cluster positions for later
  graph.clusters = new Map(clusters.map(c => [c.key, { x: c.x, z: c.z }]))

  return graph
}

/**
 * Find all simple cycles in the graph using DFS
 */
function findAllCycles(graph) {
  const cycles = []
  const visited = new Set()
  const path = []

  function dfs(node, start, parent) {
    if (path.length > 2 && node === start) {
      // Found a cycle
      cycles.push([...path])
      return
    }

    if (path.length > 20) return // Limit cycle length
    if (visited.has(node) && node !== start) return

    visited.add(node)
    path.push(node)

    const neighbors = graph.get(node) || new Set()
    for (const neighbor of neighbors) {
      if (neighbor === parent) continue
      dfs(neighbor, start, node)
    }

    path.pop()
    visited.delete(node)
  }

  // Start DFS from each node
  for (const [node] of graph) {
    if (node === 'clusters') continue
    visited.clear()
    path.length = 0
    dfs(node, node, null)
  }

  return cycles
}

/**
 * Filter to keep only minimal (non-overlapping) cycles
 */
function filterMinimalCycles(cycles) {
  // Remove duplicates (same cycle starting from different points)
  const unique = []
  const seen = new Set()

  for (const cycle of cycles) {
    if (cycle.length < 3) continue

    // Normalize: sort vertices to create canonical form
    const sorted = [...cycle].sort()
    const key = sorted.join('|')

    if (!seen.has(key)) {
      seen.add(key)
      unique.push(cycle)
    }
  }

  return unique
}

/**
 * Generate roof geometry for a polygon
 * Returns a THREE.BufferGeometry for a flat roof covering the polygon
 */
export function generateRoofGeometry(polygon, graph) {
  if (polygon.length < 3) return null

  // Get actual positions from cluster keys
  const positions = polygon.map(key => {
    const pos = graph.clusters.get(key)
    return pos ? [pos.x, pos.z] : null
  }).filter(p => p !== null)

  if (positions.length < 3) return null

  // Create a THREE.Shape from the polygon vertices
  const shape = new THREE.Shape()

  // Add overhang by expanding the polygon slightly
  const center = getCentroid(positions)
  const expandedPositions = positions.map(([x, z]) => {
    const dx = x - center[0]
    const dz = z - center[1]
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 0.01) return [x, z]
    const scale = (dist + ROOF_OVERHANG) / dist
    return [center[0] + dx * scale, center[1] + dz * scale]
  })

  // Move to first point
  shape.moveTo(expandedPositions[0][0], expandedPositions[0][1])

  // Draw lines to remaining points
  for (let i = 1; i < expandedPositions.length; i++) {
    shape.lineTo(expandedPositions[i][0], expandedPositions[i][1])
  }

  // Close the shape
  shape.closePath()

  // Extrude the shape to create a 3D roof
  const extrudeSettings = {
    depth: ROOF_THICKNESS,
    bevelEnabled: false
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

  // Rotate to be horizontal (extrude goes in Z, we want Y)
  geometry.rotateX(-Math.PI / 2)

  // Position at top of walls
  geometry.translate(0, WALL_HEIGHT, 0)

  return geometry
}

/**
 * Get centroid of a polygon
 */
function getCentroid(positions) {
  const sumX = positions.reduce((sum, [x]) => sum + x, 0)
  const sumZ = positions.reduce((sum, [, z]) => sum + z, 0)
  return [sumX / positions.length, sumZ / positions.length]
}

/**
 * Get roof data for rendering (simpler approach for initial implementation)
 * Returns array of { vertices: [[x,z]...], center: [x,z] }
 */
export function getRoofPolygons(walls) {
  const wallsArray = Array.isArray(walls) ? walls : Array.from(walls.values())

  if (wallsArray.length < 3) return []

  const polygons = findEnclosedPolygons(wallsArray)
  const graph = buildGraph(wallsArray)

  return polygons.map(polygon => {
    const vertices = polygon.map(key => {
      const pos = graph.clusters.get(key)
      return pos ? [pos.x, pos.z] : null
    }).filter(p => p !== null)

    if (vertices.length < 3) return null

    return {
      vertices,
      center: getCentroid(vertices)
    }
  }).filter(p => p !== null)
}
