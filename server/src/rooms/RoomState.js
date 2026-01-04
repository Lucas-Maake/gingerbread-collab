import { nanoid } from 'nanoid'
import { ROOM_CONFIG, USER_COLORS, BUILD_SURFACE } from '../constants/config.js'

/**
 * UserState - Represents a connected user in a room
 */
export class UserState {
  constructor(socketId, name = null) {
    this.userId = nanoid(8)
    this.socketId = socketId
    this.name = name || `Guest ${Math.floor(1000 + Math.random() * 9000)}`
    this.color = null // Assigned by room
    this.cursor = { x: 0, y: 0, z: 0, t: Date.now() }
    this.lastSeenAt = Date.now()
    this.isActive = true
    this.undoStack = [] // Last 10 actions
  }

  updateCursor(x, y, z) {
    this.cursor = { x, y, z, t: Date.now() }
    this.lastSeenAt = Date.now()
    this.isActive = true
  }

  addToUndoStack(action) {
    this.undoStack.push(action)
    if (this.undoStack.length > 10) {
      this.undoStack.shift()
    }
  }

  popUndoStack() {
    return this.undoStack.pop()
  }

  toJSON() {
    return {
      userId: this.userId,
      name: this.name,
      color: this.color,
      cursor: this.cursor,
      isActive: this.isActive
    }
  }
}

/**
 * PieceState - Represents a gingerbread piece in the room
 */
export class PieceState {
  constructor(type, spawnedBy, position = [0, 0, 0]) {
    this.pieceId = nanoid(10)
    this.type = type
    this.pos = position
    this.yaw = Math.random() * Math.PI * 2 // Random initial rotation
    this.heldBy = null
    this.spawnedBy = spawnedBy
    this.version = 1
    this.updatedAt = Date.now()
    this.lastValidPos = [...position]
    this.lastValidYaw = this.yaw
  }

  grab(userId) {
    if (this.heldBy !== null) {
      return false
    }
    this.heldBy = userId
    this.updatedAt = Date.now()
    this.version++
    return true
  }

  release() {
    this.heldBy = null
    this.lastValidPos = [...this.pos]
    this.lastValidYaw = this.yaw
    this.updatedAt = Date.now()
    this.version++
  }

  updateTransform(pos, yaw) {
    this.pos = pos
    this.yaw = yaw
    this.updatedAt = Date.now()
    this.version++
  }

  revertToLastValid() {
    this.pos = [...this.lastValidPos]
    this.yaw = this.lastValidYaw
    this.version++
  }

  toJSON() {
    return {
      pieceId: this.pieceId,
      type: this.type,
      pos: this.pos,
      yaw: this.yaw,
      heldBy: this.heldBy,
      spawnedBy: this.spawnedBy,
      version: this.version
    }
  }
}

/**
 * WallState - Represents a wall segment in the room
 */
export class WallState {
  constructor(start, end, height, createdBy) {
    this.wallId = nanoid(10)
    this.start = start // [x, z]
    this.end = end // [x, z]
    this.height = height
    this.thickness = 0.15
    this.createdBy = createdBy
    this.createdAt = Date.now()
    this.version = 1
  }

  toJSON() {
    return {
      wallId: this.wallId,
      start: this.start,
      end: this.end,
      height: this.height,
      thickness: this.thickness,
      createdBy: this.createdBy,
      version: this.version
    }
  }
}

/**
 * IcingState - Represents an icing stroke in the room
 */
export class IcingState {
  constructor(points, radius, surfaceType, surfaceId, createdBy) {
    this.icingId = nanoid(10)
    this.points = points // Array of [x, y, z]
    this.radius = radius
    this.surfaceType = surfaceType // 'wall' | 'roof' | 'ground'
    this.surfaceId = surfaceId
    this.createdBy = createdBy
    this.createdAt = Date.now()
    this.version = 1
  }

  toJSON() {
    return {
      icingId: this.icingId,
      points: this.points,
      radius: this.radius,
      surfaceType: this.surfaceType,
      surfaceId: this.surfaceId,
      createdBy: this.createdBy,
      version: this.version
    }
  }
}

/**
 * RoomState - Represents a collaborative room
 */
export class RoomState {
  constructor(roomId) {
    this.roomId = roomId
    this.users = new Map() // Map<visibleId, UserState>
    this.socketToUser = new Map() // Map<socketId, visibleId>
    this.pieces = new Map() // Map<pieceId, PieceState>
    this.walls = new Map() // Map<wallId, WallState>
    this.icing = new Map() // Map<icingId, IcingState>
    this.occupancy = new Map() // Map<cellKey, pieceId>
    this.createdAt = Date.now()
    this.lastActivityAt = Date.now()
    this.availableColors = [...USER_COLORS]
  }

  get userCount() {
    return this.users.size
  }

  get pieceCount() {
    return this.pieces.size
  }

  isFull() {
    return this.userCount >= ROOM_CONFIG.MAX_USERS_PER_ROOM
  }

  isPieceLimitReached() {
    return this.pieceCount >= ROOM_CONFIG.MAX_PIECES_PER_ROOM
  }

  // User management
  addUser(socketId, name = null) {
    if (this.isFull()) {
      return { error: 'ROOM_FULL' }
    }

    const user = new UserState(socketId, name)

    // Assign color
    if (this.availableColors.length > 0) {
      user.color = this.availableColors.shift()
    } else {
      user.color = USER_COLORS[this.userCount % USER_COLORS.length]
    }

    this.users.set(user.userId, user)
    this.socketToUser.set(socketId, user.userId)
    this.lastActivityAt = Date.now()

    return { user }
  }

  removeUser(socketId) {
    const visitorId = this.socketToUser.get(socketId)
    if (!visitorId) return null

    const user = this.users.get(visitorId)
    if (!user) return null

    // Release any locks held by this user
    for (const piece of this.pieces.values()) {
      if (piece.heldBy === visitorId) {
        piece.release()
      }
    }

    // Return color to pool
    if (user.color && !this.availableColors.includes(user.color)) {
      this.availableColors.push(user.color)
    }

    this.users.delete(visitorId)
    this.socketToUser.delete(socketId)
    this.lastActivityAt = Date.now()

    return user
  }

  getUserBySocket(socketId) {
    const visitorId = this.socketToUser.get(socketId)
    return visitorId ? this.users.get(visitorId) : null
  }

  getUserById(userId) {
    return this.users.get(userId)
  }

  /**
   * Reconnect a previously disconnected user
   * @param {string} socketId - New socket ID
   * @param {UserState} previousUser - Previous user state
   */
  reconnectUser(socketId, previousUser) {
    if (this.isFull()) {
      return { error: 'ROOM_FULL' }
    }

    // Update socket ID
    previousUser.socketId = socketId
    previousUser.lastSeenAt = Date.now()
    previousUser.isActive = true

    // Re-add to room
    this.users.set(previousUser.userId, previousUser)
    this.socketToUser.set(socketId, previousUser.userId)
    this.lastActivityAt = Date.now()

    return { user: previousUser }
  }

  // Piece management
  spawnPiece(type, userId) {
    if (this.isPieceLimitReached()) {
      return { error: 'PIECE_LIMIT_REACHED' }
    }

    // Spawn at center of build surface
    const pos = [0, 0, 0]
    const piece = new PieceState(type, userId, pos)

    // Auto-grab: piece is immediately held by the spawner (per PRD)
    piece.grab(userId)

    // Don't set occupancy while piece is held - it will be set on release
    // (occupancy is for finalized placements only)

    this.pieces.set(piece.pieceId, piece)
    this.lastActivityAt = Date.now()

    return { piece }
  }

  deletePiece(pieceId, userId) {
    const piece = this.pieces.get(pieceId)
    if (!piece) {
      return { error: 'PIECE_NOT_FOUND' }
    }

    // Only spawner can delete
    if (piece.spawnedBy !== userId) {
      return { error: 'NOT_OWNER' }
    }

    // Clear occupancy
    this.clearOccupancy(piece)

    this.pieces.delete(pieceId)
    this.lastActivityAt = Date.now()

    return { success: true, piece }
  }

  grabPiece(pieceId, userId) {
    const piece = this.pieces.get(pieceId)
    if (!piece) {
      return { error: 'PIECE_NOT_FOUND' }
    }

    if (piece.heldBy !== null) {
      const holder = this.users.get(piece.heldBy)
      return {
        error: 'LOCK_DENIED',
        heldBy: holder ? holder.name : 'Unknown'
      }
    }

    // Clear occupancy when picking up
    this.clearOccupancy(piece)

    if (!piece.grab(userId)) {
      return { error: 'LOCK_DENIED' }
    }

    this.lastActivityAt = Date.now()
    return { piece }
  }

  releasePiece(pieceId, userId, finalPos, finalYaw) {
    const piece = this.pieces.get(pieceId)
    if (!piece) {
      return { error: 'PIECE_NOT_FOUND' }
    }

    if (piece.heldBy !== userId) {
      return { error: 'NOT_HOLDING' }
    }

    // Validate bounds
    const [x, y, z] = finalPos
    const halfWidth = BUILD_SURFACE.WIDTH / 2
    const halfDepth = BUILD_SURFACE.DEPTH / 2

    if (x < -halfWidth || x > halfWidth || z < -halfDepth || z > halfDepth) {
      // Out of bounds - revert
      piece.revertToLastValid()
      piece.release()
      return { piece, adjusted: true, reason: 'OUT_OF_BOUNDS' }
    }

    // Check occupancy and find valid position
    const result = this.findValidPosition(finalPos, piece.pieceId)

    if (result.valid) {
      piece.updateTransform(result.pos, finalYaw)
      piece.release()
      this.setOccupancy(piece)
      this.lastActivityAt = Date.now()
      return { piece, adjusted: result.adjusted }
    } else {
      // No valid position found - revert
      piece.revertToLastValid()
      piece.release()
      this.setOccupancy(piece)
      return { piece, adjusted: true, reason: 'NO_VALID_POSITION' }
    }
  }

  updatePieceTransform(pieceId, userId, pos, yaw) {
    const piece = this.pieces.get(pieceId)
    if (!piece) {
      return { error: 'PIECE_NOT_FOUND' }
    }

    if (piece.heldBy !== userId) {
      return { error: 'NOT_HOLDING' }
    }

    piece.updateTransform(pos, yaw)
    this.lastActivityAt = Date.now()
    return { piece }
  }

  // Occupancy grid management
  getCellKey(x, z) {
    const cellX = Math.floor(x / BUILD_SURFACE.CELL_SIZE)
    const cellZ = Math.floor(z / BUILD_SURFACE.CELL_SIZE)
    return `${cellX}:${cellZ}`
  }

  setOccupancy(piece) {
    const [x, , z] = piece.pos
    const cellKey = this.getCellKey(x, z)
    this.occupancy.set(cellKey, piece.pieceId)
  }

  clearOccupancy(piece) {
    // Find and remove this piece from occupancy
    for (const [key, id] of this.occupancy.entries()) {
      if (id === piece.pieceId) {
        this.occupancy.delete(key)
        break
      }
    }
  }

  isOccupied(x, z, excludePieceId = null) {
    const cellKey = this.getCellKey(x, z)
    const occupant = this.occupancy.get(cellKey)
    return occupant !== undefined && occupant !== excludePieceId
  }

  findValidPosition(targetPos, excludePieceId) {
    const [x, y, z] = targetPos

    // Check target position first
    if (!this.isOccupied(x, z, excludePieceId)) {
      return { valid: true, pos: targetPos, adjusted: false }
    }

    // Search in expanding circles for free cell (max 1 world unit radius)
    const maxRadius = 1.0
    const step = BUILD_SURFACE.CELL_SIZE

    for (let r = step; r <= maxRadius; r += step) {
      // Check positions in a circle
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const testX = x + Math.cos(angle) * r
        const testZ = z + Math.sin(angle) * r

        // Check bounds
        const halfWidth = BUILD_SURFACE.WIDTH / 2
        const halfDepth = BUILD_SURFACE.DEPTH / 2
        if (testX < -halfWidth || testX > halfWidth ||
            testZ < -halfDepth || testZ > halfDepth) {
          continue
        }

        if (!this.isOccupied(testX, testZ, excludePieceId)) {
          return { valid: true, pos: [testX, y, testZ], adjusted: true }
        }
      }
    }

    return { valid: false }
  }

  // Wall management
  createWall(start, end, height, userId) {
    const wall = new WallState(start, end, height, userId)
    this.walls.set(wall.wallId, wall)
    this.lastActivityAt = Date.now()
    return { wall }
  }

  deleteWall(wallId, userId) {
    const wall = this.walls.get(wallId)
    if (!wall) {
      return { error: 'WALL_NOT_FOUND' }
    }

    // Only creator can delete
    if (wall.createdBy !== userId) {
      return { error: 'NOT_OWNER' }
    }

    this.walls.delete(wallId)
    this.lastActivityAt = Date.now()
    return { success: true, wall }
  }

  getWall(wallId) {
    return this.walls.get(wallId)
  }

  // Icing management
  createIcing(points, radius, surfaceType, surfaceId, userId) {
    if (points.length < 2) {
      return { error: 'INVALID_POINTS' }
    }

    const icing = new IcingState(points, radius, surfaceType, surfaceId, userId)
    this.icing.set(icing.icingId, icing)
    this.lastActivityAt = Date.now()
    return { icing }
  }

  deleteIcing(icingId, userId) {
    const icing = this.icing.get(icingId)
    if (!icing) {
      return { error: 'ICING_NOT_FOUND' }
    }

    // Only creator can delete
    if (icing.createdBy !== userId) {
      return { error: 'NOT_OWNER' }
    }

    this.icing.delete(icingId)
    this.lastActivityAt = Date.now()
    return { success: true, icing }
  }

  getIcing(icingId) {
    return this.icing.get(icingId)
  }

  // Snapshot for new clients
  getSnapshot() {
    return {
      roomId: this.roomId,
      users: Array.from(this.users.values()).map(u => u.toJSON()),
      pieces: Array.from(this.pieces.values()).map(p => p.toJSON()),
      walls: Array.from(this.walls.values()).map(w => w.toJSON()),
      icing: Array.from(this.icing.values()).map(i => i.toJSON()),
      pieceCount: this.pieceCount,
      maxPieces: ROOM_CONFIG.MAX_PIECES_PER_ROOM
    }
  }

  toJSON() {
    return this.getSnapshot()
  }
}
