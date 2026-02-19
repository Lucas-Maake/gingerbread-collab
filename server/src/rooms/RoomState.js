import { nanoid } from 'nanoid'
import { ROOM_CONFIG, USER_COLORS, BUILD_SURFACE } from '../constants/config.js'
import { getRoofPolygons, isPointInAnyRoofPolygon } from '../utils/roofSupport.js'

const DEFAULT_FENCE_SPACING = 0.5
const VALID_SURFACE_TYPES = new Set(['ground', 'wall', 'roof'])
const MAX_WALL_HEIGHT = 5
const MAX_ICING_RADIUS = 1

function sanitizeFenceSpacing(spacing) {
  if (!Number.isFinite(spacing) || spacing <= 0) {
    return DEFAULT_FENCE_SPACING
  }
  return spacing
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function isFiniteVector2(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
}

function isFiniteVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
}

function getFenceLineNodes(start, end, spacing) {
  const grid = sanitizeFenceSpacing(spacing)

  const halfWidth = BUILD_SURFACE.WIDTH / 2
  const halfDepth = BUILD_SURFACE.DEPTH / 2

  const clampX = (value) => clamp(value, -halfWidth, halfWidth)
  const clampZ = (value) => clamp(value, -halfDepth, halfDepth)

  const startX = Math.round(clampX(start[0]) / grid)
  const startZ = Math.round(clampZ(start[1]) / grid)
  const endX = Math.round(clampX(end[0]) / grid)
  const endZ = Math.round(clampZ(end[1]) / grid)

  let x = startX
  let z = startZ

  const dx = Math.abs(endX - startX)
  const dz = Math.abs(endZ - startZ)
  const stepX = startX < endX ? 1 : -1
  const stepZ = startZ < endZ ? 1 : -1
  let error = dx - dz

  const nodes = []

  while (true) {
    nodes.push([x * grid, z * grid])

    if (x === endX && z === endZ) {
      break
    }

    const doubledError = error * 2
    if (doubledError > -dz) {
      error -= dz
      x += stepX
    }
    if (doubledError < dx) {
      error += dx
      z += stepZ
    }
  }

  return nodes
}

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
    this.attachedTo = null // wallId this piece is snapped to (for windows/doors)
    this.snapNormal = null // Surface normal when snapped [x, y, z] - for correct orientation
    this.version = 1
    this.updatedAt = Date.now()
    this.lastValidPos = [...position]
    this.lastValidYaw = this.yaw
  }

  static fromJSON(data) {
    const piece = new PieceState(data.type, data.spawnedBy, data.pos)
    piece.pieceId = data.pieceId
    piece.yaw = Number.isFinite(data.yaw) ? data.yaw : piece.yaw
    piece.heldBy = data.heldBy ?? null
    piece.attachedTo = data.attachedTo ?? null
    piece.snapNormal = data.snapNormal ?? null
    piece.version = Number.isFinite(data.version) ? data.version : 1
    piece.lastValidPos = Array.isArray(data.pos) ? [...data.pos] : [...piece.pos]
    piece.lastValidYaw = piece.yaw
    piece.updatedAt = Date.now()
    return piece
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

  setAttachedTo(wallId) {
    this.attachedTo = wallId
    this.version++
  }

  setSnapNormal(normal) {
    this.snapNormal = normal
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
      attachedTo: this.attachedTo,
      snapNormal: this.snapNormal,
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

  static fromJSON(data) {
    const wall = new WallState(data.start, data.end, data.height, data.createdBy)
    wall.wallId = data.wallId
    wall.thickness = Number.isFinite(data.thickness) ? data.thickness : wall.thickness
    wall.version = Number.isFinite(data.version) ? data.version : 1
    wall.createdAt = Number.isFinite(data.createdAt) ? data.createdAt : Date.now()
    return wall
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

  static fromJSON(data) {
    const icing = new IcingState(data.points, data.radius, data.surfaceType, data.surfaceId, data.createdBy)
    icing.icingId = data.icingId
    icing.version = Number.isFinite(data.version) ? data.version : 1
    icing.createdAt = Number.isFinite(data.createdAt) ? data.createdAt : Date.now()
    return icing
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
    this.hostUserId = null
    this.users = new Map() // Map<visibleId, UserState>
    this.socketToUser = new Map() // Map<socketId, visibleId>
    this.pieces = new Map() // Map<pieceId, PieceState>
    this.walls = new Map() // Map<wallId, WallState>
    this.icing = new Map() // Map<icingId, IcingState>
    this.occupancy = new Map() // Map<cellKey, pieceId>
    this.chatMessages = [] // Array of chat messages (max 100)
    this.createdAt = Date.now()
    this.lastActivityAt = Date.now()
    this.availableColors = [...USER_COLORS]
  }

  static fromSnapshot(snapshot) {
    const roomId = (snapshot?.roomId || '').toUpperCase()
    if (!roomId) {
      return null
    }

    const room = new RoomState(roomId)

    room.hostUserId = null
    room.users.clear()
    room.socketToUser.clear()
    room.availableColors = [...USER_COLORS]

    if (Array.isArray(snapshot?.pieces)) {
      for (const pieceData of snapshot.pieces) {
        if (!pieceData?.pieceId || !pieceData?.type || !Array.isArray(pieceData?.pos)) {
          continue
        }

        const piece = PieceState.fromJSON(pieceData)
        piece.heldBy = null // locks cannot survive process restarts
        room.pieces.set(piece.pieceId, piece)
        room.setOccupancy(piece)
      }
    }

    if (Array.isArray(snapshot?.walls)) {
      for (const wallData of snapshot.walls) {
        if (!wallData?.wallId || !Array.isArray(wallData?.start) || !Array.isArray(wallData?.end)) {
          continue
        }

        const wall = WallState.fromJSON(wallData)
        room.walls.set(wall.wallId, wall)
      }
    }

    if (Array.isArray(snapshot?.icing)) {
      for (const icingData of snapshot.icing) {
        if (!icingData?.icingId || !Array.isArray(icingData?.points)) {
          continue
        }

        const icing = IcingState.fromJSON(icingData)
        room.icing.set(icing.icingId, icing)
      }
    }

    room.chatMessages = Array.isArray(snapshot?.chatMessages)
      ? snapshot.chatMessages.slice(-100)
      : []
    room.lastActivityAt = Date.now()

    return room
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

    if (!this.hostUserId) {
      this.hostUserId = user.userId
    }

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

    let hostChanged = false
    if (this.hostUserId === user.userId) {
      const nextHost = this.users.values().next().value || null
      this.hostUserId = nextHost ? nextHost.userId : null
      hostChanged = true
    }

    return { user, hostChanged, hostUserId: this.hostUserId }
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

    if (!this.hostUserId) {
      this.hostUserId = previousUser.userId
    }

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

    // Cascade-delete pieces snapped to this piece (legacy wall-piece support)
    const deletedAttachedPieces = []
    for (const [attachedPieceId, attachedPiece] of this.pieces.entries()) {
      if (attachedPiece.attachedTo === pieceId) {
        this.clearOccupancy(attachedPiece)
        this.pieces.delete(attachedPieceId)
        deletedAttachedPieces.push(attachedPieceId)
      }
    }

    this.lastActivityAt = Date.now()

    return { success: true, piece, deletedAttachedPieces }
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

  releasePiece(pieceId, userId, finalPos, finalYaw, attachedTo = null, snapNormal = null) {
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
      piece.setAttachedTo(null)
      piece.setSnapNormal(null)
      return { piece, adjusted: true, reason: 'OUT_OF_BOUNDS' }
    }

    // Check occupancy and find valid position
    const result = this.findValidPosition(finalPos, piece.pieceId)

    if (result.valid) {
      piece.updateTransform(result.pos, finalYaw)
      piece.release()
      piece.setAttachedTo(attachedTo) // Track which wall this piece is attached to
      piece.setSnapNormal(snapNormal) // Store the surface normal for orientation
      this.setOccupancy(piece)
      this.lastActivityAt = Date.now()
      return { piece, adjusted: result.adjusted }
    } else {
      // No valid position found - revert
      piece.revertToLastValid()
      piece.release()
      piece.setAttachedTo(null)
      piece.setSnapNormal(null)
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
  createFenceLine(start, end, spacing, userId) {
    if (!Array.isArray(start) || start.length !== 2 ||
      !Array.isArray(end) || end.length !== 2) {
      return { error: 'INVALID_FENCE_DATA' }
    }

    if (!start.every(Number.isFinite) || !end.every(Number.isFinite)) {
      return { error: 'INVALID_FENCE_DATA' }
    }

    const nodes = getFenceLineNodes(start, end, spacing)
    if (nodes.length === 0) {
      return { pieces: [] }
    }

    const nodesToCreate = []

    for (const [x, z] of nodes) {
      const cellKey = this.getCellKey(x, z)
      const occupantId = this.occupancy.get(cellKey)
      if (!occupantId) {
        nodesToCreate.push([x, z])
        continue
      }

      const occupant = this.pieces.get(occupantId)
      const canReuseExistingFencePost = occupant &&
        occupant.type === 'FENCE_POST' &&
        occupant.heldBy === null

      if (!canReuseExistingFencePost) {
        return { error: 'CELL_OCCUPIED' }
      }
    }

    if (this.pieceCount + nodesToCreate.length > ROOM_CONFIG.MAX_PIECES_PER_ROOM) {
      return { error: 'PIECE_LIMIT_REACHED' }
    }

    const pieces = []

    for (const [x, z] of nodesToCreate) {
      const piece = new PieceState('FENCE_POST', userId, [x, 0, z])
      piece.yaw = 0
      this.pieces.set(piece.pieceId, piece)
      this.setOccupancy(piece)
      pieces.push(piece)
    }

    this.lastActivityAt = Date.now()
    return { pieces }
  }

  createWall(start, end, height, userId) {
    if (!isFiniteVector2(start) || !isFiniteVector2(end) ||
      !Number.isFinite(height) || height <= 0 || height > MAX_WALL_HEIGHT) {
      return { error: 'INVALID_WALL_DATA' }
    }

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

    // Remove wall first so roof support checks reflect post-delete geometry.
    this.walls.delete(wallId)
    const roofPolygons = getRoofPolygons(this.walls)

    // Find and delete all pieces attached to this wall or now-invalid roof surfaces
    const deletedPieces = []
    const deletedRoofPieces = []
    for (const [pieceId, piece] of this.pieces.entries()) {
      const attachedToDeletedWall = piece.attachedTo === wallId
      const roofNoLongerSupported = piece.attachedTo === 'roof' &&
        !isPointInAnyRoofPolygon([piece.pos[0], piece.pos[2]], roofPolygons)

      if (attachedToDeletedWall || roofNoLongerSupported) {
        this.clearOccupancy(piece)
        this.pieces.delete(pieceId)
        deletedPieces.push(pieceId)
        if (roofNoLongerSupported) {
          deletedRoofPieces.push(pieceId)
        }
      }
    }

    // Find and delete all icing attached to this wall or now-invalid roof surfaces
    const deletedIcing = []
    const deletedRoofIcing = []
    for (const [icingId, icing] of this.icing.entries()) {
      const attachedToDeletedWall = icing.surfaceId === wallId
      const roofNoLongerSupported = icing.surfaceType === 'roof' &&
        Array.isArray(icing.points) &&
        icing.points.length > 0 &&
        !icing.points.some(point => isPointInAnyRoofPolygon([point[0], point[2]], roofPolygons))

      if (attachedToDeletedWall || roofNoLongerSupported) {
        this.icing.delete(icingId)
        deletedIcing.push(icingId)
        if (roofNoLongerSupported) {
          deletedRoofIcing.push(icingId)
        }
      }
    }

    this.lastActivityAt = Date.now()
    return { success: true, wall, deletedPieces, deletedIcing, deletedRoofPieces, deletedRoofIcing }
  }

  getWall(wallId) {
    return this.walls.get(wallId)
  }

  // Icing management
  createIcing(points, radius, surfaceType, surfaceId, userId) {
    const hasInvalidPoint = !Array.isArray(points) ||
      points.length < 2 ||
      !points.every(isFiniteVector3)

    const hasInvalidRadius = !Number.isFinite(radius) || radius <= 0 || radius > MAX_ICING_RADIUS
    const hasInvalidSurfaceType = !VALID_SURFACE_TYPES.has(surfaceType)
    const hasInvalidSurfaceId = !(surfaceId === null || typeof surfaceId === 'string')

    if (hasInvalidPoint || hasInvalidRadius || hasInvalidSurfaceType || hasInvalidSurfaceId) {
      return { error: 'INVALID_ICING_DATA' }
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

  // Reset room state (pieces, walls, icing, occupancy, undo stacks)
  resetRoom() {
    this.pieces.clear()
    this.walls.clear()
    this.icing.clear()
    this.occupancy.clear()

    for (const user of this.users.values()) {
      user.undoStack = []
    }

    this.lastActivityAt = Date.now()
  }

  // Chat management
  addChatMessage(userId, userName, userColor, message) {
    const chatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      userName,
      userColor,
      message,
      timestamp: Date.now()
    }

    this.chatMessages.push(chatMessage)

    // Keep only last 100 messages
    if (this.chatMessages.length > 100) {
      this.chatMessages.shift()
    }

    this.lastActivityAt = Date.now()
    return chatMessage
  }

  getChatHistory() {
    return this.chatMessages
  }

  // Snapshot for new clients
  getSnapshot() {
    return {
      roomId: this.roomId,
      hostUserId: this.hostUserId,
      users: Array.from(this.users.values()).map(u => u.toJSON()),
      pieces: Array.from(this.pieces.values()).map(p => p.toJSON()),
      walls: Array.from(this.walls.values()).map(w => w.toJSON()),
      icing: Array.from(this.icing.values()).map(i => i.toJSON()),
      chatMessages: this.chatMessages,
      pieceCount: this.pieceCount,
      maxPieces: ROOM_CONFIG.MAX_PIECES_PER_ROOM
    }
  }

  toJSON() {
    return this.getSnapshot()
  }
}
