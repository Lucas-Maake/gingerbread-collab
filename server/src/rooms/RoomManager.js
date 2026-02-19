import { RoomState } from './RoomState.js'
import { ROOM_CONFIG } from '../constants/config.js'

/**
 * RoomManager - Manages all active rooms and their lifecycle
 */
export class RoomManager {
  constructor() {
    this.rooms = new Map() // Map<roomId, RoomState>
    this.socketToRoom = new Map() // Map<socketId, roomId>
    this.recentlyDisconnected = new Map() // Map<`${roomId}:${visitorId}`, { user, disconnectTime }>
    this.cleanupInterval = null
    this.snapshotStore = null
    this.isPersistenceDirty = false
    this.persistenceFlushInFlight = null

    // Start cleanup timer
    this.startCleanupTimer()
  }

  setSnapshotStore(snapshotStore) {
    this.snapshotStore = snapshotStore
  }

  markRoomDirty() {
    this.isPersistenceDirty = true
  }

  async hydrateFromSnapshotStore() {
    if (!this.snapshotStore) {
      return 0
    }

    const snapshots = await this.snapshotStore.loadSnapshots()
    let restoredCount = 0

    for (const snapshot of snapshots.values()) {
      const room = RoomState.fromSnapshot(snapshot)
      if (!room) continue
      this.rooms.set(room.roomId, room)
      restoredCount += 1
    }

    if (restoredCount > 0) {
      console.log(`Hydrated ${restoredCount} room snapshots from persistence`)
    }

    this.isPersistenceDirty = false
    return restoredCount
  }

  async persistRooms(force = false) {
    if (!this.snapshotStore) {
      return
    }

    if (!force && !this.isPersistenceDirty) {
      return
    }

    if (this.persistenceFlushInFlight) {
      return this.persistenceFlushInFlight
    }

    this.persistenceFlushInFlight = this.snapshotStore
      .saveSnapshots(this.rooms)
      .then(() => {
        this.isPersistenceDirty = false
      })
      .catch((error) => {
        console.error('Failed to persist room snapshots:', error)
      })
      .finally(() => {
        this.persistenceFlushInFlight = null
      })

    return this.persistenceFlushInFlight
  }

  /**
   * Generate a unique room code
   */
  generateRoomCode() {
    // Exclude ambiguous characters: 0/O, 1/I/L
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let code

    do {
      code = ''
      for (let i = 0; i < ROOM_CONFIG.ROOM_CODE_LENGTH; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
    } while (this.rooms.has(code))

    return code
  }

  /**
   * Create a new room
   */
  createRoom(roomId = null) {
    const id = (roomId || this.generateRoomCode()).toUpperCase()

    if (this.rooms.has(id)) {
      return { error: 'ROOM_EXISTS', roomId: id }
    }

    const room = new RoomState(id)
    this.rooms.set(id, room)
    this.markRoomDirty()

    console.log(`Room created: ${id}`)
    return { room }
  }

  /**
   * Get or create a room
   */
  getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId)

    if (!room) {
      const result = this.createRoom(roomId)
      if (result.error) {
        return result
      }
      room = result.room
    }

    return { room }
  }

  /**
   * Join a user to a room
   * @param {string} roomId - Room ID
   * @param {string} socketId - Socket ID
   * @param {string} userName - Optional user name
   * @param {string} previousUserId - Optional previous user ID for reconnection
   */
  joinRoom(roomId, socketId, userName = null, previousUserId = null) {
    const room = this.rooms.get(roomId)
    if (!room) {
      return { error: 'ROOM_NOT_FOUND' }
    }

    let userResult
    let isReconnect = false

    // Check if this is a reconnection attempt
    if (previousUserId) {
      const reconnectKey = `${roomId}:${previousUserId}`
      const disconnectedUser = this.recentlyDisconnected.get(reconnectKey)

      if (disconnectedUser) {
        const timeSinceDisconnect = Date.now() - disconnectedUser.disconnectTime

        // Allow reconnection within grace period (5 minutes)
        if (timeSinceDisconnect < ROOM_CONFIG.RECONNECT_GRACE_PERIOD_MS) {
          // Reconnect the user
          userResult = room.reconnectUser(socketId, disconnectedUser.user)
          if (!userResult.error) {
            isReconnect = true
            this.recentlyDisconnected.delete(reconnectKey)
            console.log(`User ${userResult.user.name} reconnected to room ${roomId} (${room.userCount} users)`)
          }
        } else {
          // Grace period expired, remove from recently disconnected
          this.recentlyDisconnected.delete(reconnectKey)
        }
      }
    }

    // If not a reconnection, add as new user
    if (!userResult || userResult.error) {
      userResult = room.addUser(socketId, userName)
      if (userResult.error) {
        return userResult
      }
      console.log(`User ${userResult.user.name} joined room ${roomId} (${room.userCount} users)`)
    }

    this.socketToRoom.set(socketId, roomId)
    this.markRoomDirty()

    return {
      room,
      user: userResult.user,
      snapshot: room.getSnapshot(),
      isReconnect
    }
  }

  /**
   * Remove a user from their room
   */
  leaveRoom(socketId) {
    const roomId = this.socketToRoom.get(socketId)
    if (!roomId) return null

    const room = this.rooms.get(roomId)
    if (!room) {
      this.socketToRoom.delete(socketId)
      return null
    }

    const leaveResult = room.removeUser(socketId)
    const user = leaveResult ? leaveResult.user : null
    this.socketToRoom.delete(socketId)

    if (user) {
      console.log(`User ${user.name} left room ${roomId} (${room.userCount} users remaining)`)

      // Store user for potential reconnection (within grace period)
      const reconnectKey = `${roomId}:${user.userId}`
      this.recentlyDisconnected.set(reconnectKey, {
        user,
        disconnectTime: Date.now()
      })
      this.markRoomDirty()
    }

    return {
      room,
      user,
      roomId,
      hostChanged: leaveResult ? leaveResult.hostChanged : false,
      hostUserId: leaveResult ? leaveResult.hostUserId : null
    }
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId)
  }

  /**
   * Get room for a socket
   */
  getRoomForSocket(socketId) {
    const roomId = this.socketToRoom.get(socketId)
    return roomId ? this.rooms.get(roomId) : null
  }

  /**
   * Get user for a socket
   */
  getUserForSocket(socketId) {
    const room = this.getRoomForSocket(socketId)
    return room ? room.getUserBySocket(socketId) : null
  }

  /**
   * Delete a room
   */
  deleteRoom(roomId) {
    const room = this.rooms.get(roomId)
    if (!room) return false

    // Remove all socket mappings for this room
    for (const [socketId, rid] of this.socketToRoom.entries()) {
      if (rid === roomId) {
        this.socketToRoom.delete(socketId)
      }
    }

    this.rooms.delete(roomId)
    this.markRoomDirty()
    console.log(`Room deleted: ${roomId}`)
    return true
  }

  /**
   * Cleanup empty and idle rooms, and expired reconnection entries
   */
  cleanup() {
    const now = Date.now()

    for (const [roomId, room] of this.rooms.entries()) {
      // Delete empty rooms after timeout
      if (room.userCount === 0) {
        const emptyDuration = now - room.lastActivityAt
        if (emptyDuration > ROOM_CONFIG.EMPTY_ROOM_TIMEOUT_MS) {
          this.deleteRoom(roomId)
          continue
        }
      }

      // Mark idle users
      for (const user of room.users.values()) {
        const idleDuration = now - user.lastSeenAt
        if (idleDuration > 5 * 60 * 1000) { // 5 minutes
          user.isActive = false
        }
      }
    }

    // Clean up expired reconnection entries
    for (const [key, entry] of this.recentlyDisconnected.entries()) {
      const timeSinceDisconnect = now - entry.disconnectTime
      if (timeSinceDisconnect > ROOM_CONFIG.RECONNECT_GRACE_PERIOD_MS) {
        this.recentlyDisconnected.delete(key)
      }
    }

    void this.persistRooms()
  }

  /**
   * Start periodic cleanup
   */
  startCleanupTimer() {
    // Cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 30000)
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  async shutdown() {
    this.stopCleanupTimer()
    await this.persistRooms(true)
  }

  /**
   * Get statistics
   */
  getStats() {
    let totalUsers = 0
    let totalPieces = 0

    for (const room of this.rooms.values()) {
      totalUsers += room.userCount
      totalPieces += room.pieceCount
    }

    return {
      roomCount: this.rooms.size,
      totalUsers,
      totalPieces
    }
  }
}

// Singleton instance
export const roomManager = new RoomManager()
