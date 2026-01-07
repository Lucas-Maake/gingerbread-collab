/**
 * Piece snapping utilities
 * Allows windows, doors, and decorative pieces to snap to wall and roof surfaces
 */

import * as THREE from 'three'

// Pieces that can snap to walls (windows/doors)
const WINDOW_DOOR_PIECES = ['DOOR', 'WINDOW_SMALL', 'WINDOW_LARGE']

// Decorative pieces that can snap to walls
const WALL_DECORATIVE_PIECES = [
  'GUMDROP',
  'PEPPERMINT',
  'COOKIE_STAR',
  'COOKIE_HEART',
  'SNOWFLAKE',
  'CANDY_BUTTON',
  'FROSTING_DOLLOP',
  'PRESENT'
]

// Pieces that only snap to roofs
const ROOF_ONLY_PIECES = ['CHIMNEY']

// All decorative snappable pieces
const DECORATIVE_SNAPPABLE_PIECES = [...WALL_DECORATIVE_PIECES, ...ROOF_ONLY_PIECES]

// All snappable pieces
const SNAPPABLE_PIECES = [...WINDOW_DOOR_PIECES, ...DECORATIVE_SNAPPABLE_PIECES]

// Pre-built pieces that can be snapped TO
const SNAP_TARGET_PIECES = ['WALL_FRONT', 'WALL_BACK', 'WALL_LEFT', 'WALL_RIGHT']

// Snap distance threshold (how close before snapping)
const SNAP_DISTANCE = 0.6
const ROOF_SNAP_DISTANCE = 0.8 // Slightly larger for roof detection

// Piece dimensions (must match PIECE_CONFIGS in Pieces.jsx)
const PIECE_SIZES = {
  WALL_FRONT: { width: 2, height: 1.5, depth: 0.15, axis: 'z' },
  WALL_BACK: { width: 2, height: 1.5, depth: 0.15, axis: 'z' },
  WALL_LEFT: { width: 0.15, height: 1.5, depth: 2, axis: 'x' },
  WALL_RIGHT: { width: 0.15, height: 1.5, depth: 2, axis: 'x' },
  DOOR: { width: 0.5, height: 0.9, depth: 0.08 },
  WINDOW_SMALL: { width: 0.35, height: 0.35, depth: 0.08 },
  WINDOW_LARGE: { width: 0.55, height: 0.55, depth: 0.08 },
  // Decorative pieces
  GUMDROP: { width: 0.24, height: 0.2, depth: 0.24 },
  PEPPERMINT: { width: 0.3, height: 0.05, depth: 0.3 },
  COOKIE_STAR: { width: 0.35, height: 0.06, depth: 0.35 },
  COOKIE_HEART: { width: 0.35, height: 0.06, depth: 0.3 },
  SNOWFLAKE: { width: 0.36, height: 0.04, depth: 0.36 },
  CANDY_BUTTON: { width: 0.16, height: 0.08, depth: 0.16 },
  FROSTING_DOLLOP: { width: 0.2, height: 0.15, depth: 0.2 },
  PRESENT: { width: 0.22, height: 0.22, depth: 0.22 },
  CHIMNEY: { width: 0.3, height: 0.5, depth: 0.3 },
}

/**
 * Check if a piece type can snap to walls/roofs
 */
export function isSnappable(pieceType) {
  return SNAPPABLE_PIECES.includes(pieceType)
}

/**
 * Check if a piece is a decorative snappable (not window/door)
 */
export function isDecorativeSnappable(pieceType) {
  return DECORATIVE_SNAPPABLE_PIECES.includes(pieceType)
}

/**
 * Check if a piece only snaps to roofs (not walls)
 */
export function isRoofOnlyPiece(pieceType) {
  return ROOF_ONLY_PIECES.includes(pieceType)
}

/**
 * Check if a piece can snap to walls
 */
export function canSnapToWalls(pieceType) {
  return WINDOW_DOOR_PIECES.includes(pieceType) || WALL_DECORATIVE_PIECES.includes(pieceType)
}

/**
 * Check if a piece is a window or door
 */
export function isWindowOrDoor(pieceType) {
  return WINDOW_DOOR_PIECES.includes(pieceType)
}

/**
 * Check if a piece type can be snapped to
 */
export function isSnapTarget(pieceType) {
  return SNAP_TARGET_PIECES.includes(pieceType)
}

/**
 * Calculate snap position for a piece relative to walls and roofs
 * @param {string} pieceType - Type of piece being dragged
 * @param {Array} piecePos - Current [x, y, z] position of piece
 * @param {number} pieceYaw - Current rotation of piece
 * @param {Map} allPieces - Map of all pieces in the room
 * @param {Map} allWalls - Map of all drawn wall segments
 * @param {string} excludePieceId - ID of piece being dragged (to exclude from targets)
 * @param {Object} scene - Three.js scene for roof raycasting (optional)
 * @returns {Object} { snapped: boolean, position: [x, y, z], yaw: number, pitch: number, targetId: string|null, surfaceType: string|null }
 */
export function calculateSnapPosition(pieceType, piecePos, pieceYaw, allPieces, excludePieceId, allWalls = new Map(), scene = null) {
  if (!isSnappable(pieceType)) {
    return { snapped: false, position: piecePos, yaw: pieceYaw, pitch: 0, normal: null, targetId: null, surfaceType: null }
  }

  const pieceSize = PIECE_SIZES[pieceType]
  if (!pieceSize) {
    return { snapped: false, position: piecePos, yaw: pieceYaw, pitch: 0, normal: null, targetId: null, surfaceType: null }
  }

  let closestSnap = null
  let closestDistance = SNAP_DISTANCE
  const isDecorative = isDecorativeSnappable(pieceType)
  const isRoofOnly = isRoofOnlyPiece(pieceType)

  // Skip wall checks for roof-only pieces (like chimney)
  if (!isRoofOnly) {
    // Check each pre-built wall piece
    for (const [id, piece] of allPieces.entries()) {
      if (id === excludePieceId) continue
      if (!isSnapTarget(piece.type)) continue
      if (piece.heldBy !== null) continue // Don't snap to held pieces

      const wallSize = PIECE_SIZES[piece.type]
      if (!wallSize) continue

      const wallPos = piece.pos
      const wallYaw = piece.yaw || 0

      // Calculate distance to wall center (XZ plane)
      const dx = piecePos[0] - wallPos[0]
      const dz = piecePos[2] - wallPos[2]
      const horizontalDist = Math.sqrt(dx * dx + dz * dz)

      // Skip if too far away
      if (horizontalDist > SNAP_DISTANCE + Math.max(wallSize.width, wallSize.depth)) {
        continue
      }

      // Determine wall orientation and calculate snap position
      const snapResult = calculateWallPieceSnap(
        pieceType,
        piecePos,
        piece.type,
        wallPos,
        wallYaw,
        wallSize,
        pieceSize
      )

      if (snapResult && snapResult.distance < closestDistance) {
        closestDistance = snapResult.distance
        closestSnap = {
          snapped: true,
          position: snapResult.position,
          yaw: snapResult.yaw,
          pitch: 0,
          normal: snapResult.normal || null,
          targetId: id,
          surfaceType: 'wall'
        }
      }
    }

    // Check each drawn wall segment
    for (const [wallId, wall] of allWalls.entries()) {
      const snapResult = calculateDrawnWallSnap(
        pieceType,
        piecePos,
        wall,
        pieceSize
      )

      if (snapResult && snapResult.distance < closestDistance) {
        closestDistance = snapResult.distance
        closestSnap = {
          snapped: true,
          position: snapResult.position,
          yaw: snapResult.yaw,
          pitch: 0,
          normal: snapResult.normal || null,
          targetId: wallId,
          surfaceType: 'wall'
        }
      }
    }
  } // End of wall checks (skipped for roof-only pieces)

  // Check roof surfaces for decorative pieces (if scene provided)
  if (isDecorative && scene) {
    const roofSnap = calculateRoofSnap(pieceType, piecePos, pieceSize, scene)
    if (roofSnap && roofSnap.distance < closestDistance) {
      closestDistance = roofSnap.distance
      closestSnap = {
        snapped: true,
        position: roofSnap.position,
        yaw: roofSnap.yaw,
        pitch: 0,
        normal: roofSnap.normal || [0, 1, 0],
        targetId: 'roof',
        surfaceType: 'roof'
      }
    }
  }

  if (closestSnap) {
    return closestSnap
  }

  return { snapped: false, position: piecePos, yaw: pieceYaw, pitch: 0, normal: null, targetId: null, surfaceType: null }
}

/**
 * Calculate snap position for a piece on a pre-built wall piece
 */
function calculateWallPieceSnap(pieceType, piecePos, wallType, wallPos, wallYaw, wallSize, pieceSize) {
  // Wall thickness
  const wallThickness = wallSize.axis === 'z' ? wallSize.depth : wallSize.width

  // For decorative pieces that lay flat, use height (the thin dimension) for offset
  // For doors/windows that stand upright, use depth
  const isDecorative = isDecorativeSnappable(pieceType)
  const pieceOffsetDim = isDecorative ? pieceSize.height : pieceSize.depth

  // Piece offset from wall surface - position piece flush against wall
  const surfaceOffset = (wallThickness / 2) + (pieceOffsetDim / 2) + 0.005

  // Calculate based on wall type
  if (wallType === 'WALL_FRONT' || wallType === 'WALL_BACK') {
    // Wall extends along X axis, thin in Z
    const dx = piecePos[0] - wallPos[0]
    const dz = piecePos[2] - wallPos[2]

    // Check if within wall width bounds (with some margin)
    if (Math.abs(dx) > wallSize.width / 2 + SNAP_DISTANCE) {
      return null
    }

    // Distance to the wall plane (not surface)
    const distToWallCenter = Math.abs(dz)

    // Check if close enough to snap
    if (distToWallCenter < wallThickness / 2 + SNAP_DISTANCE) {
      // Determine which side to snap to based on approach direction
      const side = dz >= 0 ? 1 : -1

      // Snap to wall surface
      const snapZ = wallPos[2] + (side * surfaceOffset)

      // Clamp X to wall bounds
      const halfWidth = wallSize.width / 2 - pieceSize.width / 2 - 0.02
      const snapX = Math.max(wallPos[0] - halfWidth, Math.min(wallPos[0] + halfWidth, piecePos[0]))

      // Determine Y position (doors at bottom, windows can be anywhere on wall)
      let snapY
      if (pieceType === 'DOOR') {
        snapY = pieceSize.height / 2 // Door sits on ground
      } else {
        // Windows - keep current Y but clamp to wall bounds
        const minY = pieceSize.height / 2 + 0.05
        const maxY = wallSize.height - pieceSize.height / 2 - 0.05
        snapY = Math.max(minY, Math.min(maxY, piecePos[1] || wallSize.height / 2))
      }

      // Rotation: piece faces outward from the wall (perpendicular)
      const snapYaw = side > 0 ? 0 : Math.PI
      // Normal direction for decorative piece orientation
      const normal = [0, 0, side]

      return {
        position: [snapX, snapY, snapZ],
        yaw: snapYaw,
        normal: normal,
        distance: distToWallCenter
      }
    }
  } else if (wallType === 'WALL_LEFT' || wallType === 'WALL_RIGHT') {
    // Wall extends along Z axis, thin in X
    const dx = piecePos[0] - wallPos[0]
    const dz = piecePos[2] - wallPos[2]

    // Check if within wall depth bounds (with some margin)
    if (Math.abs(dz) > wallSize.depth / 2 + SNAP_DISTANCE) {
      return null
    }

    // Distance to the wall plane
    const distToWallCenter = Math.abs(dx)

    // Check if close enough to snap
    if (distToWallCenter < wallThickness / 2 + SNAP_DISTANCE) {
      // Determine which side to snap to
      const side = dx >= 0 ? 1 : -1

      // Snap to wall surface
      const snapX = wallPos[0] + (side * surfaceOffset)

      // Clamp Z to wall bounds
      const halfDepth = wallSize.depth / 2 - pieceSize.width / 2 - 0.02
      const snapZ = Math.max(wallPos[2] - halfDepth, Math.min(wallPos[2] + halfDepth, piecePos[2]))

      // Determine Y position
      let snapY
      if (pieceType === 'DOOR') {
        snapY = pieceSize.height / 2
      } else {
        const minY = pieceSize.height / 2 + 0.05
        const maxY = wallSize.height - pieceSize.height / 2 - 0.05
        snapY = Math.max(minY, Math.min(maxY, piecePos[1] || wallSize.height / 2))
      }

      // Rotation: piece faces outward from the wall (perpendicular)
      const snapYaw = side > 0 ? Math.PI / 2 : -Math.PI / 2
      // Normal direction for decorative piece orientation
      const normal = [side, 0, 0]

      return {
        position: [snapX, snapY, snapZ],
        yaw: snapYaw,
        normal: normal,
        distance: distToWallCenter
      }
    }
  }

  return null
}

/**
 * Calculate snap position for a piece on a drawn wall segment
 * Drawn walls have start/end points and can be at any angle
 */
function calculateDrawnWallSnap(pieceType, piecePos, wall, pieceSize) {
  const [startX, startZ] = wall.start
  const [endX, endZ] = wall.end
  const wallHeight = wall.height || 1.5
  const wallThickness = wall.thickness || 0.15

  // Calculate wall vector and length
  const wallDx = endX - startX
  const wallDz = endZ - startZ
  const wallLength = Math.sqrt(wallDx * wallDx + wallDz * wallDz)

  // Skip very short walls
  if (wallLength < 0.2) return null

  // Normalize wall direction
  const wallDirX = wallDx / wallLength
  const wallDirZ = wallDz / wallLength

  // Wall center
  const wallCenterX = (startX + endX) / 2
  const wallCenterZ = (startZ + endZ) / 2

  // Vector from wall center to piece
  const toPieceX = piecePos[0] - wallCenterX
  const toPieceZ = piecePos[2] - wallCenterZ

  // Project piece position onto wall line (parametric t)
  // t = 0 at start, t = 1 at end
  const toStartX = piecePos[0] - startX
  const toStartZ = piecePos[2] - startZ
  let t = (toStartX * wallDirX + toStartZ * wallDirZ) / wallLength

  // Clamp t to wall bounds with margin for piece width
  const pieceHalfWidth = pieceSize.width / 2
  const marginT = pieceHalfWidth / wallLength
  t = Math.max(marginT, Math.min(1 - marginT, t))

  // Closest point on wall line
  const closestX = startX + t * wallDx
  const closestZ = startZ + t * wallDz

  // Perpendicular distance from piece to wall line
  // Cross product gives signed distance
  const perpDist = (piecePos[0] - closestX) * (-wallDirZ) + (piecePos[2] - closestZ) * wallDirX

  // Absolute distance to wall center line
  const distToLine = Math.abs(perpDist)

  // Check if close enough
  if (distToLine > SNAP_DISTANCE + wallThickness / 2) {
    return null
  }

  // Determine which side to snap to
  const side = perpDist >= 0 ? 1 : -1

  // For decorative pieces that lay flat, use height (the thin dimension) for offset
  // For doors/windows that stand upright, use depth
  const isDecorative = isDecorativeSnappable(pieceType)
  const pieceOffsetDim = isDecorative ? pieceSize.height : pieceSize.depth

  // Offset from wall surface
  const surfaceOffset = (wallThickness / 2) + (pieceOffsetDim / 2) + 0.005

  // Normal vector (perpendicular to wall)
  const normalX = -wallDirZ * side
  const normalZ = wallDirX * side

  // Snap position on wall surface
  const snapX = closestX + normalX * surfaceOffset
  const snapZ = closestZ + normalZ * surfaceOffset

  // Determine Y position
  let snapY
  if (pieceType === 'DOOR') {
    snapY = pieceSize.height / 2 // Door sits on ground
  } else {
    // Windows - keep current Y but clamp to wall bounds
    const minY = pieceSize.height / 2 + 0.05
    const maxY = wallHeight - pieceSize.height / 2 - 0.05
    snapY = Math.max(minY, Math.min(maxY, piecePos[1] || wallHeight / 2))
  }

  // Calculate yaw to face outward (perpendicular to wall)
  // atan2 gives angle of normal vector
  const snapYaw = Math.atan2(normalX, normalZ)

  return {
    position: [snapX, snapY, snapZ],
    yaw: snapYaw,
    normal: [normalX, 0, normalZ],
    distance: distToLine
  }
}

/**
 * Calculate snap position for a piece on roof surfaces
 * Uses raycasting to detect roof meshes, with smart nearest-point detection for roof-only pieces
 */
function calculateRoofSnap(pieceType, piecePos, pieceSize, scene) {
  // Get roof meshes from scene
  const roofMeshes = []
  scene.traverse((child) => {
    if (child.isMesh && child.parent?.name === 'auto-roofs') {
      roofMeshes.push(child)
    }
  })

  if (roofMeshes.length === 0) return null

  const isRoofOnly = isRoofOnlyPiece(pieceType)
  let bestHit = null
  let bestDistance = Infinity

  // For roof-only pieces (like chimney), cast rays in a grid pattern to find nearby roofs
  // This allows snapping even when not directly under the roof
  if (isRoofOnly) {
    const searchRadius = 3.0 // Search within 3 units
    const gridStep = 0.5 // Check every 0.5 units
    const raycaster = new THREE.Raycaster()

    for (let dx = -searchRadius; dx <= searchRadius; dx += gridStep) {
      for (let dz = -searchRadius; dz <= searchRadius; dz += gridStep) {
        const testX = piecePos[0] + dx
        const testZ = piecePos[2] + dz
        const rayOrigin = new THREE.Vector3(testX, 10, testZ)
        const rayDirection = new THREE.Vector3(0, -1, 0)
        raycaster.set(rayOrigin, rayDirection)

        const intersects = raycaster.intersectObjects(roofMeshes, false)
        if (intersects.length > 0) {
          const hit = intersects[0]
          // Calculate distance from piece position to this hit point
          const dist = Math.sqrt(
            Math.pow(piecePos[0] - hit.point.x, 2) +
            Math.pow(piecePos[2] - hit.point.z, 2)
          )
          if (dist < bestDistance) {
            bestDistance = dist
            bestHit = hit
          }
        }
      }
    }
  } else {
    // For other decorative pieces, just cast straight down
    const raycaster = new THREE.Raycaster()
    const rayOrigin = new THREE.Vector3(piecePos[0], 10, piecePos[2])
    const rayDirection = new THREE.Vector3(0, -1, 0)
    raycaster.set(rayOrigin, rayDirection)

    const intersects = raycaster.intersectObjects(roofMeshes, false)
    if (intersects.length > 0) {
      bestHit = intersects[0]
      bestDistance = 0 // Directly under, so distance is 0
    }
  }

  if (!bestHit) return null

  const point = bestHit.point

  // Get surface normal in world space
  let normal = bestHit.face?.normal?.clone() || new THREE.Vector3(0, 1, 0)
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(bestHit.object.matrixWorld)
  normal.applyMatrix3(normalMatrix).normalize()

  // Flip normal if pointing downward (face winding issue)
  if (normal.y < 0) {
    normal.negate()
  }

  // Only snap if the surface is somewhat horizontal (roof surfaces, not vertical walls)
  if (normal.y < 0.3) {
    return null
  }

  // For roof-only pieces, use a more generous snap distance
  const maxSnapDist = isRoofOnly ? 3.0 : ROOF_SNAP_DISTANCE
  if (bestDistance > maxSnapDist) return null

  // Offset piece to sit on top of roof surface
  const surfaceOffset = pieceSize.height / 2 + 0.02
  const snapPos = [
    point.x,
    point.y + surfaceOffset,
    point.z
  ]

  // Keep piece upright on roof
  const snapYaw = 0

  return {
    position: snapPos,
    yaw: snapYaw,
    normal: [normal.x, normal.y, normal.z],
    distance: bestDistance
  }
}
