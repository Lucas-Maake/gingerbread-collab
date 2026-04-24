import { roomManager } from '../rooms/RoomManager.js'
import { PieceState, WallState, IcingState } from '../rooms/RoomState.js'
import { RateLimiter, BroadcastThrottler } from '../utils/TokenBucket.js'
import { RATE_LIMITS } from '../constants/config.js'
import {
  SERVER_EVENTS,
  SOCKET_EVENTS,
  validateCreateFenceLinePayload,
  validateCreateIcingStrokePayload,
  validateCreateWallSegmentPayload,
  validateCursorUpdatePayload,
  validateIcingIdPayload,
  validateJoinRoomPayload,
  validatePieceIdPayload,
  validateReleasePiecePayload,
  validateSendChatMessagePayload,
  validateSpawnPiecePayload,
  validateTransformUpdatePayload,
  validateWallIdPayload
} from '../../../shared/socketContracts.js'

// Rate limiter instance
const rateLimiter = new RateLimiter()

// Broadcast throttler for transform updates
const broadcastThrottler = new BroadcastThrottler(RATE_LIMITS.MAX_BROADCAST_HZ)

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
  socket.on(SOCKET_EVENTS.JOIN_ROOM, async (data, callback) => {
    const payload = validateJoinRoomPayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { roomId, userName, previousUserId } = payload.value

    if (!previousUserId && isRateLimited('join', callback)) {
      return
    }

    const result = roomManager.joinRoom(roomId, socketId, userName, previousUserId)

    if (result.error) {
      return callback({ error: result.error })
    }

    try {
      // Ensure room membership is active before acknowledging join
      await socket.join(roomId)
    } catch (error) {
      console.error('Failed to join socket.io room:', roomId, error)
      return callback({ error: 'JOIN_FAILED' })
    }

    // Notify others in room (only if this is a new user, not a reconnect)
    if (!result.isReconnect) {
      socket.to(roomId).emit(SERVER_EVENTS.USER_JOINED, {
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
  socket.on(SOCKET_EVENTS.LEAVE_ROOM, (callback) => {
    handleDisconnect()
    if (callback) callback({ success: true })
  })

  // ==================== CURSOR EVENTS ====================

  /**
   * Update cursor position
   * @param {Object} data - { x: number, y: number, z: number }
   */
  socket.on(SOCKET_EVENTS.CURSOR_UPDATE, (data) => {
    // Rate limit check
    if (!rateLimiter.allowCursorUpdate(socketId)) {
      return // Drop update silently
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) return

    const user = room.getUserBySocket(socketId)
    if (!user) return

    const payload = validateCursorUpdatePayload(data)
    if (payload.error) return

    const { x, y, z } = payload.value
    user.updateCursor(x, y, z)

    // Broadcast to others in room
    socket.to(room.roomId).emit(SERVER_EVENTS.CURSOR_MOVED, {
      userId: user.userId,
      cursor: user.cursor
    })
  })

  // ==================== PIECE EVENTS ====================

  /**
   * Spawn a new piece
   * @param {Object} data - { type: string }
   */
  socket.on(SOCKET_EVENTS.SPAWN_PIECE, (data, callback) => {
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

    const payload = validateSpawnPiecePayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { type } = payload.value

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
    io.to(room.roomId).emit(SERVER_EVENTS.PIECE_SPAWNED, {
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
  socket.on(SOCKET_EVENTS.GRAB_PIECE, (data, callback) => {
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

    const payload = validatePieceIdPayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { pieceId } = payload.value
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
    io.to(room.roomId).emit(SERVER_EVENTS.PIECE_GRABBED, {
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
  socket.on(SOCKET_EVENTS.RELEASE_PIECE, (data, callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const payload = validateReleasePiecePayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { pieceId, pos, yaw, attachedTo, snapNormal } = payload.value
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
    io.to(room.roomId).emit(SERVER_EVENTS.PIECE_RELEASED, {
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
  socket.on(SOCKET_EVENTS.TRANSFORM_UPDATE, (data) => {
    // Rate limit check
    if (!rateLimiter.allowTransformUpdate(socketId)) {
      return // Drop update silently
    }

    const room = roomManager.getRoomForSocket(socketId)
    if (!room) return

    const user = room.getUserBySocket(socketId)
    if (!user) return

    const payload = validateTransformUpdatePayload(data)
    if (payload.error) return

    const { pieceId, pos, yaw } = payload.value

    const result = room.updatePieceTransform(pieceId, user.userId, pos, yaw)
    if (result.error) return

    // Throttle broadcasts
    if (!broadcastThrottler.canBroadcast(pieceId)) {
      return
    }

    // Broadcast to others in room
    socket.to(room.roomId).emit(SERVER_EVENTS.PIECE_MOVED, {
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
  socket.on(SOCKET_EVENTS.DELETE_PIECE, (data, callback) => {
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

    const payload = validatePieceIdPayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { pieceId } = payload.value
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
    io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
      pieceId,
      deletedBy: user.userId
    })

    // Broadcast cascade deletions for pieces attached to the deleted parent piece
    if (result.deletedAttachedPieces && result.deletedAttachedPieces.length > 0) {
      for (const attachedPieceId of result.deletedAttachedPieces) {
        io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
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
  socket.on(SOCKET_EVENTS.UNDO, (callback) => {
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
          io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
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

        io.to(room.roomId).emit(SERVER_EVENTS.PIECE_SPAWNED, {
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

          io.to(room.roomId).emit(SERVER_EVENTS.PIECE_MOVED, {
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
              io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
                pieceId,
                deletedBy: user.userId,
                reason: 'WALL_DELETED'
              })
            }
          }
          if (undoResult.deletedIcing && undoResult.deletedIcing.length > 0) {
            for (const icingId of undoResult.deletedIcing) {
              io.to(room.roomId).emit(SERVER_EVENTS.ICING_STROKE_DELETED, {
                icingId,
                deletedBy: user.userId,
                reason: 'WALL_DELETED'
              })
            }
          }
          io.to(room.roomId).emit(SERVER_EVENTS.WALL_SEGMENT_DELETED, {
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
              io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
                pieceId,
                deletedBy: user.userId,
                reason: 'UNDO'
              })

              if (deleteResult.deletedAttachedPieces && deleteResult.deletedAttachedPieces.length > 0) {
                for (const attachedPieceId of deleteResult.deletedAttachedPieces) {
                  io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
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

        io.to(room.roomId).emit(SERVER_EVENTS.WALL_SEGMENT_CREATED, {
          wall: newWall.toJSON(),
          createdBy: user.userId,
          reason: 'UNDO'
        })
        break

      case 'CREATE_ICING':
        // Undo icing creation = delete the icing
        undoResult = room.deleteIcing(action.icingId, user.userId)
        if (!undoResult.error) {
          io.to(room.roomId).emit(SERVER_EVENTS.ICING_STROKE_DELETED, {
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

        io.to(room.roomId).emit(SERVER_EVENTS.ICING_STROKE_CREATED, {
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
  socket.on(SOCKET_EVENTS.CREATE_FENCE_LINE, (data, callback) => {
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

    const payload = validateCreateFenceLinePayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { start, end, spacing } = payload.value

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
      io.to(room.roomId).emit(SERVER_EVENTS.PIECE_SPAWNED, {
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
  socket.on(SOCKET_EVENTS.CREATE_WALL_SEGMENT, (data, callback) => {
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

    const payload = validateCreateWallSegmentPayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { start, end, height } = payload.value

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
    io.to(room.roomId).emit(SERVER_EVENTS.WALL_SEGMENT_CREATED, {
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
  socket.on(SOCKET_EVENTS.DELETE_WALL_SEGMENT, (data, callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const payload = validateWallIdPayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { wallId } = payload.value
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
        io.to(room.roomId).emit(SERVER_EVENTS.PIECE_DELETED, {
          pieceId,
          deletedBy: user.userId,
          reason: 'WALL_DELETED'
        })
      }
    }

    // Broadcast cascade-deleted icing
    if (result.deletedIcing && result.deletedIcing.length > 0) {
      for (const icingId of result.deletedIcing) {
        io.to(room.roomId).emit(SERVER_EVENTS.ICING_STROKE_DELETED, {
          icingId,
          deletedBy: user.userId,
          reason: 'WALL_DELETED'
        })
      }
    }

    // Broadcast wall deletion
    io.to(room.roomId).emit(SERVER_EVENTS.WALL_SEGMENT_DELETED, {
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
  socket.on(SOCKET_EVENTS.CREATE_ICING_STROKE, (data, callback) => {
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

    const payload = validateCreateIcingStrokePayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { points, radius, surfaceType, surfaceId } = payload.value

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
    io.to(room.roomId).emit(SERVER_EVENTS.ICING_STROKE_CREATED, {
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
  socket.on(SOCKET_EVENTS.DELETE_ICING_STROKE, (data, callback) => {
    const room = roomManager.getRoomForSocket(socketId)
    if (!room) {
      return callback({ error: 'NOT_IN_ROOM' })
    }

    const user = room.getUserBySocket(socketId)
    if (!user) {
      return callback({ error: 'USER_NOT_FOUND' })
    }

    const payload = validateIcingIdPayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { icingId } = payload.value
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
    io.to(room.roomId).emit(SERVER_EVENTS.ICING_STROKE_DELETED, {
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
      socket.to(result.roomId).emit(SERVER_EVENTS.USER_LEFT, {
        userId: result.user.userId,
        userName: result.user.name,
        hostUserId: result.hostUserId
      })

      if (result.hostChanged) {
        io.to(result.roomId).emit(SERVER_EVENTS.HOST_CHANGED, {
          hostUserId: result.hostUserId
        })
      }

      // Release any held pieces is already done in leaveRoom
      // But we need to broadcast the releases
      for (const piece of result.room.pieces.values()) {
        if (piece.heldBy === null && piece.updatedAt > Date.now() - 1000) {
          // Recently released piece - broadcast
          io.to(result.roomId).emit(SERVER_EVENTS.PIECE_RELEASED, {
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
  socket.on(SOCKET_EVENTS.REQUEST_SNAPSHOT, (callback) => {
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
  socket.on(SOCKET_EVENTS.PING, (callback) => {
    callback({ timestamp: Date.now() })
  })

  // ==================== CHAT EVENTS ====================

  /**
   * Send a chat message
   * @param {Object} data - { message: string }
   */
  socket.on(SOCKET_EVENTS.SEND_CHAT_MESSAGE, (data, callback) => {
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

    const payload = validateSendChatMessagePayload(data)
    if (payload.error) {
      return callback({ error: payload.error })
    }

    const { message } = payload.value

    // Create chat message
    const chatMessage = room.addChatMessage(user.userId, user.name, user.color, message)

    // Broadcast to all in room (including sender)
    io.to(room.roomId).emit(SERVER_EVENTS.CHAT_MESSAGE, chatMessage)

    roomManager.markRoomDirty()

    callback({ success: true, message: chatMessage })
  })

  /**
   * Get chat history
   */
  socket.on(SOCKET_EVENTS.GET_CHAT_HISTORY, (callback) => {
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
  socket.on(SOCKET_EVENTS.RESET_ROOM, (callback) => {
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

    io.to(room.roomId).emit(SERVER_EVENTS.ROOM_RESET, {
      snapshot: room.getSnapshot(),
      resetBy: user.userId
    })

    roomManager.markRoomDirty()

    callback({ success: true })
  })
}
