import * as THREE from 'three'

const WALL_HEIGHT = 1.5
const WALL_THICKNESS = 0.15
const SNAP_OFFSET = 0.02 // How far to offset icing from surface

/**
 * Calculate wall mesh data for raycasting
 */
export function getWallMeshes(walls, scene) {
  const meshes = []

  scene.traverse((child) => {
    if (child.isMesh && child.userData.wallId) {
      meshes.push(child)
    }
  })

  return meshes
}

/**
 * Calculate roof mesh data for raycasting
 */
export function getRoofMeshes(scene) {
  const meshes = []

  scene.traverse((child) => {
    if (child.isMesh && child.parent?.name === 'auto-roofs') {
      meshes.push(child)
    }
  })

  return meshes
}

/**
 * Raycast from mouse position to find surface to draw on
 * Returns { point, normal, surfaceType, surfaceId } or null
 */
export function raycastToSurface(mousePos, camera, scene) {
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mousePos, camera)

  // Get all potential surfaces
  const wallMeshes = []
  const roofMeshes = []
  const groundMesh = []

  scene.traverse((child) => {
    if (!child.isMesh) return

    if (child.userData.wallId) {
      wallMeshes.push(child)
    } else if (child.parent?.name === 'auto-roofs') {
      roofMeshes.push(child)
    } else if (child.name === 'build-surface' || child.userData.isBuildSurface) {
      groundMesh.push(child)
    }
  })

  // Priority: walls > roofs > ground
  const allMeshes = [...wallMeshes, ...roofMeshes, ...groundMesh]
  const intersects = raycaster.intersectObjects(allMeshes, false)

  if (intersects.length === 0) {
    // Fall back to ground plane if no mesh hit
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersectPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(groundPlane, intersectPoint)

    if (intersectPoint) {
      return {
        point: [intersectPoint.x, 0.02, intersectPoint.z],
        normal: [0, 1, 0],
        surfaceType: 'ground',
        surfaceId: null
      }
    }
    return null
  }

  const hit = intersects[0]
  const point = hit.point.clone()
  const normal = hit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0)

  // Transform normal to world space
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
  normal.applyMatrix3(normalMatrix).normalize()

  // Offset point slightly away from surface
  point.add(normal.clone().multiplyScalar(SNAP_OFFSET))

  // Determine surface type
  let surfaceType = 'ground'
  let surfaceId = null

  if (hit.object.userData.wallId) {
    surfaceType = 'wall'
    surfaceId = hit.object.userData.wallId
  } else if (hit.object.parent?.name === 'auto-roofs') {
    surfaceType = 'roof'
    surfaceId = null // Roofs don't have individual IDs
  }

  return {
    point: [point.x, point.y, point.z],
    normal: [normal.x, normal.y, normal.z],
    surfaceType,
    surfaceId
  }
}

/**
 * Smooth a path of points using Catmull-Rom interpolation
 */
export function smoothPath(points, segments = 3) {
  if (points.length < 2) return points

  const smoothed = []

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    for (let t = 0; t < segments; t++) {
      const tt = t / segments
      const point = catmullRom(p0, p1, p2, p3, tt)
      smoothed.push(point)
    }
  }

  // Add the last point
  smoothed.push(points[points.length - 1])

  return smoothed
}

/**
 * Catmull-Rom spline interpolation
 */
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t
  const t3 = t2 * t

  const x = 0.5 * (
    (2 * p1[0]) +
    (-p0[0] + p2[0]) * t +
    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
  )

  const y = 0.5 * (
    (2 * p1[1]) +
    (-p0[1] + p2[1]) * t +
    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
  )

  const z = 0.5 * (
    (2 * p1[2]) +
    (-p0[2] + p2[2]) * t +
    (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 +
    (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3
  )

  return [x, y, z]
}

/**
 * Filter points to remove those too close together
 */
export function filterPoints(points, minDistance = 0.05) {
  if (points.length < 2) return points

  const filtered = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const last = filtered[filtered.length - 1]
    const current = points[i]

    const dx = current[0] - last[0]
    const dy = current[1] - last[1]
    const dz = current[2] - last[2]
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

    if (dist >= minDistance) {
      filtered.push(current)
    }
  }

  return filtered
}
