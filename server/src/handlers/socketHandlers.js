import { roomManager } from '../rooms/RoomManager.js'
import { PieceState, WallState, IcingState } from '../rooms/RoomState.js'
import { RateLimiter, BroadcastThrottler } from '../utils/TokenBucket.js'
import { RATE_LIMITS, PIECE_TYPES } from '../constants/config.js'

// Rate limiter instance
const rateLimiter = new RateLimiter()

// Broadcast throttler for transform updates
const broadcastThrottler = new BroadcastThrottler(RATE_LIMITS.MAX_BROADCAST_HZ)
const VALID_SURFACE_TYPES = new Set(['ground', 'wall', 'roof'])
const MAX_WALL_HEIGHT = 5
const MAX_ICING_RADIUS = 1

function isFiniteVector2(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
}

function isFiniteVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
}

/**
 * Register all socket event handlers
 */
export function registerSocketHandlers(io, socket) {
  const socketId = socket.id

  // Initialize rate limiters for this connection
  rateLimiter.addConnection(socketId, {
    cursor: RATE_LIMITS.CURSOR_UPDATES,
    transform: RATE_LIMITS.TRANSFORM_UPDATES,
    join: RATE_LIMITS.JOIN_ATTEMPTS,
    spawnPiece: RATE_LIMITS.SPAWN_PIECE,
    deletePiece: RATE_LIMITS.DELETE_PIECE,
    createWall: RATE_LIMITS.CREATE_WALL,
    createFenceLine: RATE_LIMITS.CREATE_FENCE_LINE,
    createIcing: RATE_LIMITS.CREATE_ICING,
    sendChat: RATE_LIMITS.SEND_CHAT,
    resetRoom: RATE_LIMITS.RESET_ROOM,
    undo: RATE_LIMITS.UNDO
  })

  const isRateLimited = (eventKey, callback = null) => {
    if (rateLimiter.allow(socketId, eventKey)) {
      return false
    }

    if (typeof callback === 'function') {
      callback({ error: 'RATE_LIMITED' })
    }
    return true
  }

  // ==================== ROOM EVENTS ====================

  /**
   * Join a room
   * @param {Object} data - { roomId: string, userName?: string, previousUserId?: string }
   */
  socket.on('join_room', async (data, callback) => {
    const { roomId, userName, previousUserId } = data

    if (!previousUserId && isRateLimited('join', callback)) {
      return
    }

    if (!roomId || typeof roomId !== 'string' || roomId.length !== 6) {
      return callback({ error: 'INVALID_ROOM_CODE' })
    }

    const normalizedRoomId = roomId.toUpperCase()
    const result = roomManager.joinRoom(normalizedRoomId, socketId, userName, previousUserId)

    if (result.error) {
      return callback({ error: result.error })
    }

    try {
      // Ensure room membership is active before acknowledging join
      await socket.join(normalizedRoomId)
    } catch (error) {
      console.error('Failed to join socket.io room:', normalizedRoomId, error)
      return callback({ error: 'JOIN_FAILED' })
    }

    // Notify others in room (only if this is a new user, not a reconnect)
    if (!result.isReconnect) {
      socket.to(normalizedRoomId).emit('user_joined', {
        user: result.user.toJSON()
      })
    }

    // Send snapshot to joining user
    callback({
      success: true,
      userId: result.user.userId,
      snapshot: result.snapshot,
      isReconnect: result.isReconnect,
      undoCount: result.user.undoStack.length
    })
  })

  /**
   * Leave current room
   */
  socket.on('leave_room', (callback) => {
    handleDisconnect()
    if (callback) callback({ success: true })
  })

  // ==================== CURSOR EVENTS ====================

  /**
   * Update cursor position
   * @param {Object} data - { x: number, y: number, z: number }
   */
  socket.on('cursor_update', (data) => {
    // Rate limit check
    if (!rateLimiter.allowCursorUpdate(socketId)) {
      return // Drop update silently
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) return

    const user = room.getUserBySocket(socketId)
    if (!user) return

    const { x, y, z } = data
    user.updateCursor(x, y, z)

    // Broadcast to others in room
    socket.to(room.roomId).emit('cursor_moved', {
      userId: user.userId,
      cursor: user.cursor
    })
  })

  // ==================== PIECE EVENTS ====================

  /**
   * Spawn a new piece
   * @param {Object} data - { type: string }
   */
  socket.on('spawn_piece', (data, callback) => {
    if (isRateLimited('spawnPiece', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { type } = data

    // Validate piece type
    if (!Object.values(PIECE_TYPES).includes(type)) {
      return callback({ error: 'INVALID_PIECE_TYPE' })
    }

    const result = room.spawnPiece(type, user.userId)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    user.addToUndoStack({
      action: 'SPAWN',
      pieceId: result.piece.pieceId,
      type: result.piece.type
    })

    // Broadcast to all in room (including sender)
    io.to(room.roomId).emit('piece_spawned', {
      piece: result.piece.toJSON(),
      spawnedBy: user.userId
    })

    roomManager.markRoomDirty()

    callback({ success: true, piece: result.piece.toJSON(), undoCount: user.undoStack.length })
  })

  /**
   * Grab a piece (request lock)
   * @param {Object} data - { pieceId: string }
   */
  socket.on('grab_piece', (data, callback) => {
    console.log('grab_piece event received:', data)
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      console.log('grab_piece error: NOT_IN_ROOM')
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      console.log('grab_piece error: USER_NOT_FOUND')
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { pieceId } = data
    console.log('Attempting to grab piece:', pieceId, 'for user:', user.userId)
    const result = room.grabPiece(pieceId, user.userId)
    console.log('grabPiece result:', result)

    if (result.error) {
      return callback({
        error: result.error,
        heldBy: result.heldBy
      })
    }

    // Broadcast lock to all in room
    io.to(room.roomId).emit('piece_grabbed', {
      pieceId,
      heldBy: user.userId,
      userName: user.name,
      color: user.color
    })

    callback({ success: true, piece: result.piece.toJSON() })
  })

  /**
   * Release a piece
   * @param {Object} data - { pieceId: string, pos: [x, y, z], yaw: number, attachedTo?: string, snapNormal?: [x, y, z] }
   */
  socket.on('release_piece', (data, callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { pieceId, pos, yaw, attachedTo, snapNormal } = data
    const piece = room.pieces.get(pieceId)

    // Store previous position for undo
    const prevPos = piece ? [...piece.pos] : null
    const prevYaw = piece ? piece.yaw : null

    const result = room.releasePiece(pieceId, user.userId, pos, yaw, attachedTo, snapNormal)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    if (prevPos) {
      user.addToUndoStack({
        action: 'MOVE',
        pieceId,
        prevPos,
        prevYaw,
        newPos: result.piece.pos,
        newYaw: result.piece.yaw
      })
    }

    // Force broadcast of final position
    broadcastThrottler.forceBroadcast(pieceId)

    // Broadcast release to all in room
    io.to(room.roomId).emit('piece_released', {
      piece: result.piece.toJSON(),
      adjusted: result.adjusted,
      reason: result.reason
    })

    roomManager.markRoomDirty()

    callback({
      success: true,
      piece: result.piece.toJSON(),
      adjusted: result.adjusted,
      undoCount: user.undoStack.length
    })
  })

  /**
   * Update piece transform while dragging
   * @param {Object} data - { pieceId: string, pos: [x, y, z], yaw: number }
   */
  socket.on('transform_update', (data) => {
    // Rate limit check
    if (!rateLimiter.allowTransformUpdate(socketId)) {
      return // Drop update silently
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) return

    const user = room.getUserBySocket(socketId)
    if (!user) return

    const { pieceId, pos, yaw } = data

    const result = room.updatePieceTransform(pieceId, user.userId, pos, yaw)
    if (result.error) return

    // Throttle broadcasts
    if (!broadcastThrottler.canBroadcast(pieceId)) {
      return
    }

    // Broadcast to others in room
    socket.to(room.roomId).emit('piece_moved', {
      pieceId,
      pos: result.piece.pos,
      yaw: result.piece.yaw,
      version: result.piece.version
    })
  })

  /**
   * Delete a piece
   * @param {Object} data - { pieceId: string }
   */
  socket.on('delete_piece', (data, callback) => {
    if (isRateLimited('deletePiece', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { pieceId } = data
    const piece = room.pieces.get(pieceId)

    // Store for undo
    const pieceData = piece ? piece.toJSON() : null

    const result = room.deletePiece(pieceId, user.userId)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    if (pieceData) {
      user.addToUndoStack({
        action: 'DELETE',
        pieceData
      })
    }

    // Broadcast deletion to all in room
    io.to(room.roomId).emit('piece_deleted', {
      pieceId,
      deletedBy: user.userId
    })

    // Broadcast cascade deletions for pieces attached to the deleted parent piece
    if (result.deletedAttachedPieces && result.deletedAttachedPieces.length > 0) {
      for (const attachedPieceId of result.deletedAttachedPieces) {
        io.to(room.roomId).emit('piece_deleted', {
          pieceId: attachedPieceId,
          deletedBy: user.userId,
          reason: 'ATTACHED_PARENT_DELETED'
        })
      }
    }

    roomManager.markRoomDirty()

    callback({ success: true, undoCount: user.undoStack.length })
  })

  // ==================== UNDO EVENTS ====================

  /**
   * Undo last action
   */
  socket.on('undo', (callback) => {
    if (isRateLimited('undo', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const action = user.popUndoStack()
    if (!action) {
      return callback({ error: 'NOTHING_TO_UNDO' })
    }

    let undoResult = null

    switch (action.action) {
      case 'SPAWN':
        // Undo spawn = delete the piece
        undoResult = room.deletePiece(action.pieceId, user.userId)
        if (!undoResult.error) {
          io.to(room.roomId).emit('piece_deleted', {
            pieceId: action.pieceId,
            deletedBy: user.userId,
            reason: 'UNDO'
          })
        }
        break

      case 'DELETE':
        // Undo delete = respawn the piece
        if (room.isPieceLimitReached()) {
          return callback({ error: 'PIECE_LIMIT_REACHED' })
        }
        // Recreate the piece
        const pieceData = action.pieceData
        const newPiece = new PieceState(pieceData.type, pieceData.spawnedBy, pieceData.pos)
        newPiece.yaw = pieceData.yaw
        room.pieces.set(newPiece.pieceId, newPiece)
        room.setOccupancy(newPiece)

        io.to(room.roomId).emit('piece_spawned', {
          piece: newPiece.toJSON(),
          spawnedBy: user.userId,
          reason: 'UNDO'
        })
        break

      case 'MOVE':
        // Undo move = restore previous position
        const piece = room.pieces.get(action.pieceId)
        if (piece && piece.heldBy === null) {
          room.clearOccupancy(piece)
          piece.updateTransform(action.prevPos, action.prevYaw)
          room.setOccupancy(piece)

          io.to(room.roomId).emit('piece_moved', {
            pieceId: action.pieceId,
            pos: action.prevPos,
            yaw: action.prevYaw,
            version: piece.version,
            reason: 'UNDO'
          })
        }
        break

      case 'CREATE_WALL':
        // Undo wall creation = delete the wall
        undoResult = room.deleteWall(action.wallId, user.userId)
        if (!undoResult.error) {
          if (undoResult.deletedPieces && undoResult.deletedPieces.length > 0) {
            for (const pieceId of undoResult.deletedPieces) {
              io.to(room.roomId).emit('piece_deleted', {
                pieceId,
                deletedBy: user.userId,
                reason: 'WALL_DELETED'
              })
            }
          }
          if (undoResult.deletedIcing && undoResult.deletedIcing.length > 0) {
            for (const icingId of undoResult.deletedIcing) {
              io.to(room.roomId).emit('icing_stroke_deleted', {
                icingId,
                deletedBy: user.userId,
                reason: 'WALL_DELETED'
              })
            }
          }
          io.to(room.roomId).emit('wall_segment_deleted', {
            wallId: action.wallId,
            deletedBy: user.userId,
            reason: 'UNDO',
            deletedPieces: undoResult.deletedPieces || [],
            deletedIcing: undoResult.deletedIcing || [],
            deletedRoofPieces: undoResult.deletedRoofPieces || [],
            deletedRoofIcing: undoResult.deletedRoofIcing || []
          })
        }
        break

      case 'CREATE_FENCE_LINE':
        if (Array.isArray(action.pieceIds) && action.pieceIds.length > 0) {
          for (const pieceId of action.pieceIds) {
            const deleteResult = room.deletePiece(pieceId, user.userId)
            if (!deleteResult.error) {
              io.to(room.roomId).emit('piece_deleted', {
                pieceId,
                deletedBy: user.userId,
                reason: 'UNDO'
              })

              if (deleteResult.deletedAttachedPieces && deleteResult.deletedAttachedPieces.length > 0) {
                for (const attachedPieceId of deleteResult.deletedAttachedPieces) {
                  io.to(room.roomId).emit('piece_deleted', {
                    pieceId: attachedPieceId,
                    deletedBy: user.userId,
                    reason: 'ATTACHED_PARENT_DELETED'
                  })
                }
              }
            }
          }
        }
        break

      case 'DELETE_WALL':
        // Undo wall deletion = recreate the wall
        const wallData = action.wallData
        const newWall = new WallState(wallData.start, wallData.end, wallData.height, wallData.createdBy)
        room.walls.set(newWall.wallId, newWall)

        io.to(room.roomId).emit('wall_segment_created', {
          wall: newWall.toJSON(),
          createdBy: user.userId,
          reason: 'UNDO'
        })
        break

      case 'CREATE_ICING':
        // Undo icing creation = delete the icing
        undoResult = room.deleteIcing(action.icingId, user.userId)
        if (!undoResult.error) {
          io.to(room.roomId).emit('icing_stroke_deleted', {
            icingId: action.icingId,
            deletedBy: user.userId,
            reason: 'UNDO'
          })
        }
        break

      case 'DELETE_ICING':
        // Undo icing deletion = recreate the icing
        const icingData = action.icingData
        const newIcing = new IcingState(
          icingData.points,
          icingData.radius,
          icingData.surfaceType,
          icingData.surfaceId,
          icingData.createdBy
        )
        room.icing.set(newIcing.icingId, newIcing)

        io.to(room.roomId).emit('icing_stroke_created', {
          icing: newIcing.toJSON(),
          createdBy: user.userId,
          reason: 'UNDO'
        })
        break

      default:
        return callback({ error: 'UNKNOWN_ACTION' })
    }

    callback({ success: true, action: action.action, undoCount: user.undoStack.length })
    roomManager.markRoomDirty()
  })

  // ==================== WALL EVENTS ====================

  /**
   * Create a fence line (spawns multiple fence posts)
   * @param {Object} data - { start: [x, z], end: [x, z], spacing?: number }
   */
  socket.on('create_fence_line', (data, callback) => {
    if (isRateLimited('createFenceLine', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { start, end, spacing = 0.5 } = data

    if (!isFiniteVector2(start) || !isFiniteVector2(end)) {
      return callback({ error: 'INVALID_FENCE_DATA' })
    }

    const result = room.createFenceLine(start, end, spacing, user.userId)
    if (result.error) {
      return callback({ error: result.error })
    }

    const pieces = result.pieces || []

    if (pieces.length > 0) {
      user.addToUndoStack({
        action: 'CREATE_FENCE_LINE',
        pieceIds: pieces.map(piece => piece.pieceId)
      })
    }

    for (const piece of pieces) {
      io.to(room.roomId).emit('piece_spawned', {
        piece: piece.toJSON(),
        spawnedBy: user.userId,
        reason: 'FENCE_LINE'
      })
    }

    callback({
      success: true,
      pieces: pieces.map(piece => piece.toJSON()),
      undoCount: user.undoStack.length
    })
    roomManager.markRoomDirty()
  })

  /**
   * Create a wall segment
   * @param {Object} data - { start: [x, z], end: [x, z], height?: number }
   */
  socket.on('create_wall_segment', (data, callback) => {
    if (isRateLimited('createWall', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { start, end, height = 1.5 } = data

    // Validate input
    if (!isFiniteVector2(start) || !isFiniteVector2(end) ||
      !Number.isFinite(height) || height <= 0 || height > MAX_WALL_HEIGHT) {
      return callback({ error: 'INVALID_WALL_DATA' })
    }

    const result = room.createWall(start, end, height, user.userId)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    user.addToUndoStack({
      action: 'CREATE_WALL',
      wallId: result.wall.wallId
    })

    // Broadcast to all in room
    io.to(room.roomId).emit('wall_segment_created', {
      wall: result.wall.toJSON(),
      createdBy: user.userId
    })

    roomManager.markRoomDirty()

    callback({ success: true, wall: result.wall.toJSON(), undoCount: user.undoStack.length })
  })

  /**
   * Delete a wall segment
   * @param {Object} data - { wallId: string }
   */
  socket.on('delete_wall_segment', (data, callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { wallId } = data
    const wall = room.getWall(wallId)

    // Store for undo
    const wallData = wall ? wall.toJSON() : null

    const result = room.deleteWall(wallId, user.userId)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    if (wallData) {
      user.addToUndoStack({
        action: 'DELETE_WALL',
        wallData
      })
    }

    // Broadcast cascade-deleted pieces
    if (result.deletedPieces && result.deletedPieces.length > 0) {
      for (const pieceId of result.deletedPieces) {
        io.to(room.roomId).emit('piece_deleted', {
          pieceId,
          deletedBy: user.userId,
          reason: 'WALL_DELETED'
        })
      }
    }

    // Broadcast cascade-deleted icing
    if (result.deletedIcing && result.deletedIcing.length > 0) {
      for (const icingId of result.deletedIcing) {
        io.to(room.roomId).emit('icing_stroke_deleted', {
          icingId,
          deletedBy: user.userId,
          reason: 'WALL_DELETED'
        })
      }
    }

    // Broadcast wall deletion
    io.to(room.roomId).emit('wall_segment_deleted', {
      wallId,
      deletedBy: user.userId,
      deletedPieces: result.deletedPieces || [],
      deletedIcing: result.deletedIcing || [],
      deletedRoofPieces: result.deletedRoofPieces || [],
      deletedRoofIcing: result.deletedRoofIcing || []
    })

    roomManager.markRoomDirty()

    callback({ success: true, undoCount: user.undoStack.length })
  })

  // ==================== ICING EVENTS ====================

  /**
   * Create an icing stroke
   * @param {Object} data - { points: [[x,y,z],...], radius?: number, surfaceType?: string, surfaceId?: string }
   */
  socket.on('create_icing_stroke', (data, callback) => {
    if (isRateLimited('createIcing', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { points, radius = 0.05, surfaceType = 'ground', surfaceId = null } = data

    // Validate input
    const hasInvalidPoint = !Array.isArray(points) ||
      points.length < 2 ||
      !points.every(isFiniteVector3)

    const hasInvalidRadius = !Number.isFinite(radius) || radius <= 0 || radius > MAX_ICING_RADIUS
    const hasInvalidSurfaceType = !VALID_SURFACE_TYPES.has(surfaceType)
    const hasInvalidSurfaceId = !(surfaceId === null || typeof surfaceId === 'string')

    if (hasInvalidPoint || hasInvalidRadius || hasInvalidSurfaceType || hasInvalidSurfaceId) {
      return callback({ error: 'INVALID_ICING_DATA' })
    }

    const result = room.createIcing(points, radius, surfaceType, surfaceId, user.userId)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    user.addToUndoStack({
      action: 'CREATE_ICING',
      icingId: result.icing.icingId
    })

    // Broadcast to all in room
    io.to(room.roomId).emit('icing_stroke_created', {
      icing: result.icing.toJSON(),
      createdBy: user.userId
    })

    roomManager.markRoomDirty()

    callback({ success: true, icing: result.icing.toJSON(), undoCount: user.undoStack.length })
  })

  /**
   * Delete an icing stroke
   * @param {Object} data - { icingId: string }
   */
  socket.on('delete_icing_stroke', (data, callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { icingId } = data
    const icing = room.getIcing(icingId)

    // Store for undo
    const icingData = icing ? icing.toJSON() : null

    const result = room.deleteIcing(icingId, user.userId)

    if (result.error) {
      return callback({ error: result.error })
    }

    // Add to undo stack
    if (icingData) {
      user.addToUndoStack({
        action: 'DELETE_ICING',
        icingData
      })
    }

    // Broadcast to all in room
    io.to(room.roomId).emit('icing_stroke_deleted', {
      icingId,
      deletedBy: user.userId
    })

    roomManager.markRoomDirty()

    callback({ success: true, undoCount: user.undoStack.length })
  })

  // ==================== DISCONNECT ====================

  function handleDisconnect() {
    const result = roomManager.leaveRoom(socketId)

    if (result && result.room && result.user) {
      // Notify others in room
      socket.to(result.roomId).emit('user_left', {
        userId: result.user.userId,
        userName: result.user.name,
        hostUserId: result.hostUserId
      })

      if (result.hostChanged) {
        io.to(result.roomId).emit('host_changed', {
          hostUserId: result.hostUserId
        })
      }

      // Release any held pieces is already done in leaveRoom
      // But we need to broadcast the releases
      for (const piece of result.room.pieces.values()) {
        if (piece.heldBy === null && piece.updatedAt > Date.now() - 1000) {
          // Recently released piece - broadcast
          io.to(result.roomId).emit('piece_released', {
            piece: piece.toJSON(),
            reason: 'USER_DISCONNECTED'
          })
        }
      }
    }

    // Clean up rate limiter
    rateLimiter.removeConnection(socketId)
  }

  socket.on('disconnect', handleDisconnect)

  // ==================== UTILITY EVENTS ====================

  /**
   * Request fresh snapshot (for reconnection)
   */
  socket.on('request_snapshot', (callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    callback({
      success: true,
      snapshot: room.getSnapshot()
    })
  })

  /**
   * Ping for latency measurement
   */
  socket.on('ping', (callback) => {
    callback({ timestamp: Date.now() })
  })

  // ==================== CHAT EVENTS ====================

  /**
   * Send a chat message
   * @param {Object} data - { message: string }
   */
  socket.on('send_chat_message', (data, callback) => {
    if (isRateLimited('sendChat', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const { message } = data

    // Validate message
    if (!message || typeof message !== 'string') {
      return callback({ error: 'INVALID_MESSAGE' })
    }

    // Trim and limit message length
    const trimmedMessage = message.trim().slice(0, 500)
    if (trimmedMessage.length === 0) {
      return callback({ error: 'EMPTY_MESSAGE' })
    }

    // Create chat message
    const chatMessage = room.addChatMessage(user.userId, user.name, user.color, trimmedMessage)

    // Broadcast to all in room (including sender)
    io.to(room.roomId).emit('chat_message', chatMessage)

    roomManager.markRoomDirty()

    callback({ success: true, message: chatMessage })
  })

  /**
   * Get chat history
   */
  socket.on('get_chat_history', (callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    callback({ success: true, messages: room.getChatHistory() })
  })

  // ==================== ROOM RESET ====================

  /**
   * Reset room (host only) - clears pieces, walls, and icing
   */
  socket.on('reset_room', (callback) => {
    if (isRateLimited('resetRoom', callback)) {
      return
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    if (room.hostUserId !== user.userId) {
      return callback({ error: 'NOT_HOST' })
    }

    room.resetRoom()
    broadcastThrottler.cleanup(new Set())

    io.to(room.roomId).emit('room_reset', {
      snapshot: room.getSnapshot(),
      resetBy: user.userId
    })

    roomManager.markRoomDirty()

    callback({ success: true })
  })
}
