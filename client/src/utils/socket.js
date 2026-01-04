import { io } from 'socket.io-client'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

// Socket instance (singleton)
let socket = null

// Connection state
let connectionState = 'disconnected' // disconnected, connecting, connected, error

// Event listeners map for cleanup
const eventListeners = new Map()

/**
 * Initialize socket connection
 */
export function initSocket() {
  if (socket?.connected) {
    return socket
  }

  socket = io(SERVER_URL, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  })

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
    connectionState = 'connected'
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
    connectionState = 'disconnected'
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
    connectionState = 'error'
  })

  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts')
    connectionState = 'connected'
  })

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log('Socket reconnecting, attempt', attemptNumber)
    connectionState = 'connecting'
  })

  socket.on('reconnect_failed', () => {
    console.error('Socket reconnection failed')
    connectionState = 'error'
  })

  return socket
}

/**
 * Connect the socket
 */
export function connect() {
  if (!socket) {
    initSocket()
  }
  if (!socket.connected) {
    connectionState = 'connecting'
    socket.connect()
  }
  return socket
}

/**
 * Disconnect the socket
 */
export function disconnect() {
  if (socket) {
    socket.disconnect()
    connectionState = 'disconnected'
  }
}

/**
 * Get current socket instance
 */
export function getSocket() {
  return socket
}

/**
 * Get connection state
 */
export function getConnectionState() {
  return connectionState
}

/**
 * Check if connected
 */
export function isConnected() {
  return socket?.connected ?? false
}

// ==================== ROOM OPERATIONS ====================

/**
 * Get stored user ID for reconnection
 */
function getStoredUserId(roomId) {
  try {
    const key = `gingerbread_userId_${roomId}`
    return sessionStorage.getItem(key)
  } catch (e) {
    return null
  }
}

/**
 * Store user ID for reconnection
 */
function storeUserId(roomId, visitorId) {
  try {
    const key = `gingerbread_userId_${roomId}`
    sessionStorage.setItem(key, visitorId)
  } catch (e) {
    // sessionStorage not available
  }
}

/**
 * Join a room
 */
export function joinRoom(roomId, userName) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    // Try to retrieve previous userId for reconnection
    const previousUserId = getStoredUserId(roomId)

    socket.emit('join_room', { roomId, userName, previousUserId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        // Store userId for future reconnection
        if (response.userId) {
          storeUserId(roomId, response.userId)
        }
        resolve(response)
      }
    })
  })
}

/**
 * Leave current room
 */
export function leaveRoom() {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ success: true })
      return
    }

    socket.emit('leave_room', (response) => {
      resolve(response)
    })
  })
}

/**
 * Request fresh snapshot
 */
export function requestSnapshot() {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('request_snapshot', (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// ==================== PIECE OPERATIONS ====================

/**
 * Spawn a new piece
 */
export function spawnPiece(type) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('spawn_piece', { type }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Grab a piece (request lock)
 */
export function grabPiece(pieceId) {
  return new Promise((resolve, reject) => {
    console.log('socket.grabPiece called, connected:', socket?.connected)
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    console.log('Emitting grab_piece event for:', pieceId)
    socket.emit('grab_piece', { pieceId }, (response) => {
      console.log('grab_piece response received:', response)
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Release a piece
 */
export function releasePiece(pieceId, pos, yaw) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('release_piece', { pieceId, pos, yaw }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// Client-side rate limiting and deadband filter for transform updates
const transformState = {
  lastPos: [0, 0, 0],
  lastYaw: 0,
  lastUpdateTime: 0
}

// Constants from PRD
const TRANSFORM_UPDATE_INTERVAL_ACTIVE = 50 // 20 Hz max when tab is active
const TRANSFORM_UPDATE_INTERVAL_BACKGROUND = 200 // 5 Hz when tab is backgrounded
const MIN_POSITION_DELTA = 0.005 // World units
const MIN_ROTATION_DELTA = 0.5 * (Math.PI / 180) // 0.5 degrees in radians

// Tab visibility state
let isTabVisible = true
let currentTransformInterval = TRANSFORM_UPDATE_INTERVAL_ACTIVE

// Set up visibility change listener
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    isTabVisible = document.visibilityState === 'visible'
    currentTransformInterval = isTabVisible
      ? TRANSFORM_UPDATE_INTERVAL_ACTIVE
      : TRANSFORM_UPDATE_INTERVAL_BACKGROUND
    console.log(`Tab visibility changed: ${isTabVisible ? 'visible' : 'hidden'}, update interval: ${currentTransformInterval}ms`)
  })
}

/**
 * Send transform update (fire and forget, rate limited on server)
 * Implements client-side rate limiting (20Hz active, 5Hz backgrounded) and deadband filter
 */
export function sendTransformUpdate(pieceId, pos, yaw) {
  if (!socket?.connected) return

  const now = Date.now()

  // Rate limit: max 20 Hz when active, 5 Hz when backgrounded
  if (now - transformState.lastUpdateTime < currentTransformInterval) {
    return
  }

  // Deadband filter: don't send if change is too small
  const dx = Math.abs(pos[0] - transformState.lastPos[0])
  const dy = Math.abs(pos[1] - transformState.lastPos[1])
  const dz = Math.abs(pos[2] - transformState.lastPos[2])
  const positionDelta = Math.max(dx, dy, dz)
  const yawDelta = Math.abs(yaw - transformState.lastYaw)

  if (positionDelta < MIN_POSITION_DELTA && yawDelta < MIN_ROTATION_DELTA) {
    return
  }

  // Update state and send
  transformState.lastPos = [...pos]
  transformState.lastYaw = yaw
  transformState.lastUpdateTime = now

  socket.emit('transform_update', { pieceId, pos, yaw })
}

/**
 * Delete a piece
 */
export function deletePiece(pieceId) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('delete_piece', { pieceId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// ==================== CURSOR OPERATIONS ====================

// Cursor update rate limiting
const cursorState = {
  lastUpdateTime: 0
}
const CURSOR_UPDATE_INTERVAL_ACTIVE = 66 // ~15 Hz when tab is active
const CURSOR_UPDATE_INTERVAL_BACKGROUND = 200 // 5 Hz when tab is backgrounded

/**
 * Send cursor update (fire and forget, rate limited on client and server)
 */
export function sendCursorUpdate(x, y, z) {
  if (!socket?.connected) return

  const now = Date.now()
  const interval = isTabVisible ? CURSOR_UPDATE_INTERVAL_ACTIVE : CURSOR_UPDATE_INTERVAL_BACKGROUND

  // Rate limit cursor updates
  if (now - cursorState.lastUpdateTime < interval) {
    return
  }

  cursorState.lastUpdateTime = now
  socket.emit('cursor_update', { x, y, z })
}

// ==================== UNDO ====================

/**
 * Undo last action
 */
export function undo() {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('undo', (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// ==================== WALL OPERATIONS ====================

/**
 * Create a wall segment
 */
export function createWallSegment(start, end, height = 1.5) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('create_wall_segment', { start, end, height }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Delete a wall segment
 */
export function deleteWallSegment(wallId) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('delete_wall_segment', { wallId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// ==================== ICING OPERATIONS ====================

/**
 * Create an icing stroke
 */
export function createIcingStroke(points, radius = 0.05, surfaceType = 'ground', surfaceId = null) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('create_icing_stroke', { points, radius, surfaceType, surfaceId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

/**
 * Delete an icing stroke
 */
export function deleteIcingStroke(icingId) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    socket.emit('delete_icing_stroke', { icingId }, (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// ==================== UTILITY ====================

/**
 * Measure latency
 */
export function ping() {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Not connected'))
      return
    }

    const startTime = Date.now()
    socket.emit('ping', (response) => {
      const latency = Date.now() - startTime
      resolve({ latency, serverTime: response.timestamp })
    })
  })
}

/**
 * Subscribe to socket events
 */
export function on(event, callback) {
  if (!socket) {
    initSocket()
  }

  socket.on(event, callback)

  // Track for cleanup
  if (!eventListeners.has(event)) {
    eventListeners.set(event, [])
  }
  eventListeners.get(event).push(callback)
}

/**
 * Unsubscribe from socket events
 */
export function off(event, callback) {
  if (!socket) return

  if (callback) {
    socket.off(event, callback)
    const listeners = eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  } else {
    socket.off(event)
    eventListeners.delete(event)
  }
}

/**
 * Clean up all event listeners
 */
export function cleanup() {
  if (!socket) return

  for (const [event, callbacks] of eventListeners.entries()) {
    for (const callback of callbacks) {
      socket.off(event, callback)
    }
  }
  eventListeners.clear()
}

// Export socket for direct access if needed
export { socket }
