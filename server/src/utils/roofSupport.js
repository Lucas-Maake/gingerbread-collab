const EPSILON = 0.15
const ROOF_OVERHANG = 0.15
const EDGE_EPSILON = 1e-6

function getPosKey(x, z) {
  return `${x.toFixed(2)},${z.toFixed(2)}`
}

function buildGraph(walls) {
  const graph = new Map()

  const addEdge = (from, to) => {
    if (!graph.has(from)) graph.set(from, new Set())
    if (!graph.has(to)) graph.set(to, new Set())
    graph.get(from).add(to)
    graph.get(to).add(from)
  }

  const allPoints = []
  for (const wall of walls) {
    allPoints.push({ x: wall.start[0], z: wall.start[1], wall, isStart: true })
    allPoints.push({ x: wall.end[0], z: wall.end[1], wall, isStart: false })
  }

  const clusters = []
  const assigned = new Set()

  for (let i = 0; i < allPoints.length; i++) {
    if (assigned.has(i)) continue

    const clusterPoints = [allPoints[i]]
    assigned.add(i)

    for (let j = i + 1; j < allPoints.length; j++) {
      if (assigned.has(j)) continue

      const dx = allPoints[i].x - allPoints[j].x
      const dz = allPoints[i].z - allPoints[j].z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < EPSILON) {
        clusterPoints.push(allPoints[j])
        assigned.add(j)
      }
    }

    const avgX = clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length
    const avgZ = clusterPoints.reduce((sum, p) => sum + p.z, 0) / clusterPoints.length
    const key = getPosKey(avgX, avgZ)
    clusters.push({ key, x: avgX, z: avgZ, points: clusterPoints })
  }

  for (const wall of walls) {
    const startCluster = clusters.find(c => c.points.some(p => p.wall === wall && p.isStart))
    const endCluster = clusters.find(c => c.points.some(p => p.wall === wall && !p.isStart))

    if (startCluster && endCluster && startCluster.key !== endCluster.key) {
      addEdge(startCluster.key, endCluster.key)
    }
  }

  const clusterPositions = new Map()
  for (const cluster of clusters) {
    clusterPositions.set(cluster.key, { x: cluster.x, z: cluster.z })
  }

  return { adjacency: graph, clusters: clusterPositions }
}

function findAllCycles(graph) {
  const cycles = []
  const visited = new Set()
  const path = []

  function dfs(node, start, parent) {
    if (path.length > 2 && node === start) {
      cycles.push([...path])
      return
    }

    if (path.length > 20) return
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

  for (const [node] of graph.entries()) {
    visited.clear()
    path.length = 0
    dfs(node, node, null)
  }

  return cycles
}

function filterMinimalCycles(cycles) {
  const unique = []
  const seen = new Set()

  for (const cycle of cycles) {
    if (cycle.length < 3) continue

    const sorted = [...cycle].sort()
    const key = sorted.join('|')
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(cycle)
    }
  }

  return unique
}

function getCentroid(vertices) {
  const sumX = vertices.reduce((sum, [x]) => sum + x, 0)
  const sumZ = vertices.reduce((sum, [, z]) => sum + z, 0)
  return [sumX / vertices.length, sumZ / vertices.length]
}

function expandPolygon(vertices, overhang = ROOF_OVERHANG) {
  if (vertices.length < 3) return vertices
  const [centerX, centerZ] = getCentroid(vertices)

  return vertices.map(([x, z]) => {
    const dx = x - centerX
    const dz = z - centerZ
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < EDGE_EPSILON) return [x, z]
    const scale = (dist + overhang) / dist
    return [centerX + dx * scale, centerZ + dz * scale]
  })
}

function pointOnSegment(px, pz, ax, az, bx, bz) {
  const cross = (px - ax) * (bz - az) - (pz - az) * (bx - ax)
  if (Math.abs(cross) > EDGE_EPSILON) return false

  const dot = (px - ax) * (bx - ax) + (pz - az) * (bz - az)
  if (dot < -EDGE_EPSILON) return false

  const lengthSq = (bx - ax) * (bx - ax) + (bz - az) * (bz - az)
  if (dot - lengthSq > EDGE_EPSILON) return false

  return true
}

function isPointInPolygon(px, pz, polygon) {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]
    const [xj, zj] = polygon[j]

    if (pointOnSegment(px, pz, xi, zi, xj, zj)) {
      return true
    }

    const intersects = ((zi > pz) !== (zj > pz)) &&
      (px < ((xj - xi) * (pz - zi)) / ((zj - zi) || EDGE_EPSILON) + xi)

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

export function getRoofPolygons(wallsOrMap) {
  const walls = Array.isArray(wallsOrMap) ? wallsOrMap : Array.from(wallsOrMap.values())
  if (walls.length < 3) return []

  const graph = buildGraph(walls)
  const cycles = filterMinimalCycles(findAllCycles(graph.adjacency))

  return cycles.map(cycle => {
    return cycle
      .map(key => {
        const pos = graph.clusters.get(key)
        return pos ? [pos.x, pos.z] : null
      })
      .filter(Boolean)
  }).filter(vertices => vertices.length >= 3)
}

export function isPointInAnyRoofPolygon(point, roofPolygons) {
  const [x, z] = point
  for (const polygon of roofPolygons) {
    const expanded = expandPolygon(polygon)
    if (isPointInPolygon(x, z, expanded)) {
      return true
    }
  }
  return false
}

