/**
 * Piece snapping utilities
 * Allows windows and doors to snap to wall surfaces
 */

// Pieces that can snap to walls
const SNAPPABLE_PIECES = ['DOOR', 'WINDOW_SMALL', 'WINDOW_LARGE']

// Pieces that can be snapped TO
const SNAP_TARGETS = ['WALL_FRONT', 'WALL_BACK', 'WALL_LEFT', 'WALL_RIGHT']

// Snap distance threshold (how close before snapping)
const SNAP_DISTANCE = 0.5

// Piece dimensions (must match Pieces.jsx)
const PIECE_SIZES = {
  WALL_FRONT: { width: 2, height: 1.5, depth: 0.15, axis: 'z' },
  WALL_BACK: { width: 2, height: 1.5, depth: 0.15, axis: 'z' },
  WALL_LEFT: { width: 0.15, height: 1.5, depth: 2, axis: 'x' },
  WALL_RIGHT: { width: 0.15, height: 1.5, depth: 2, axis: 'x' },
  DOOR: { width: 0.5, height: 0.9, depth: 0.08 },
  WINDOW_SMALL: { width: 0.35, height: 0.35, depth: 0.08 },
  WINDOW_LARGE: { width: 0.55, height: 0.55, depth: 0.08 },
}

/**
 * Check if a piece type can snap to walls
 */
export function isSnappable(pieceType) {
  return SNAPPABLE_PIECES.includes(pieceType)
}

/**
 * Check if a piece type can be snapped to
 */
export function isSnapTarget(pieceType) {
  return SNAP_TARGETS.includes(pieceType)
}

/**
 * Calculate snap position for a piece relative to walls
 * @param {string} pieceType - Type of piece being dragged
 * @param {Array} piecePos - Current [x, y, z] position of piece
 * @param {number} pieceYaw - Current rotation of piece
 * @param {Map} allPieces - Map of all pieces in the room
 * @param {string} excludePieceId - ID of piece being dragged (to exclude from targets)
 * @returns {Object} { snapped: boolean, position: [x, y, z], yaw: number, targetId: string|null }
 */
export function calculateSnapPosition(pieceType, piecePos, pieceYaw, allPieces, excludePieceId) {
  if (!isSnappable(pieceType)) {
    return { snapped: false, position: piecePos, yaw: pieceYaw, targetId: null }
  }

  const pieceSize = PIECE_SIZES[pieceType]
  if (!pieceSize) {
    return { snapped: false, position: piecePos, yaw: pieceYaw, targetId: null }
  }

  let closestSnap = null
  let closestDistance = SNAP_DISTANCE

  // Check each potential snap target (wall)
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
    const snapResult = calculateWallSnap(
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
        targetId: id
      }
    }
  }

  if (closestSnap) {
    return closestSnap
  }

  return { snapped: false, position: piecePos, yaw: pieceYaw, targetId: null }
}

/**
 * Calculate snap position for a piece on a specific wall
 * The piece rotation is ALWAYS set to face perpendicular to the wall surface
 */
function calculateWallSnap(pieceType, piecePos, wallType, wallPos, wallYaw, wallSize, pieceSize) {
  // Wall thickness
  const wallThickness = wallSize.axis === 'z' ? wallSize.depth : wallSize.width

  // Piece offset from wall surface - position piece flush against wall
  const surfaceOffset = (wallThickness / 2) + (pieceSize.depth / 2) + 0.005

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
      // side > 0 means piece is on +Z side, should face +Z (yaw = 0)
      // side < 0 means piece is on -Z side, should face -Z (yaw = PI)
      const snapYaw = side > 0 ? 0 : Math.PI

      return {
        position: [snapX, snapY, snapZ],
        yaw: snapYaw,
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
      // side > 0 means piece is on +X side, should face +X (yaw = PI/2)
      // side < 0 means piece is on -X side, should face -X (yaw = -PI/2)
      const snapYaw = side > 0 ? Math.PI / 2 : -Math.PI / 2

      return {
        position: [snapX, snapY, snapZ],
        yaw: snapYaw,
        distance: distToWallCenter
      }
    }
  }

  return null
}
