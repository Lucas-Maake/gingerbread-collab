import { create } from 'zustand'
import * as socket from '../utils/socket.js'
import { playGlobalSound, SoundType } from '../hooks/useSoundEffects.js'

/**
 * Main game state store using Zustand
 */
export const useGameStore = create((set, get) => ({
  // ==================== CONNECTION STATE ====================
  connectionState: 'disconnected', // disconnected, connecting, connected, error
  roomId: null,
  userId: null,

  // ==================== USER STATE ====================
  users: new Map(), // Map<userId, UserState>
  localUser: null,

  // ==================== PIECE STATE ====================
  pieces: new Map(), // Map<pieceId, PieceState>
  heldPieceId: null, // Currently held piece by local user
  pieceCount: 0,
  maxPieces: 50,

  // ==================== UI STATE ====================
  isLoading: false,
  error: null,
  notification: null,

  // ==================== ACTIONS ====================

  // Connection actions
  setConnectionState: (state) => set({ connectionState: state }),

  connect: () => {
    set({ connectionState: 'connecting' })
    socket.connect()
  },

  disconnect: () => {
    socket.disconnect()
    set({
      connectionState: 'disconnected',
      roomId: null,
      userId: null,
      users: new Map(),
      pieces: new Map(),
      localUser: null,
      heldPieceId: null
    })
  },

  // Room actions
  joinRoom: async (roomId, userName) => {
    set({ isLoading: true, error: null })

    try {
      // Ensure connected
      if (!socket.isConnected()) {
        socket.connect()
        // Wait for connection
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)
          const checkConnection = setInterval(() => {
            if (socket.isConnected()) {
              clearInterval(checkConnection)
              clearTimeout(timeout)
              resolve()
            }
          }, 100)
        })
      }

      const response = await socket.joinRoom(roomId, userName)

      // Parse snapshot
      const { snapshot, userId } = response

      // Build users map
      const usersMap = new Map()
      for (const user of snapshot.users) {
        usersMap.set(user.userId, user)
      }

      // Build pieces map
      const piecesMap = new Map()
      for (const piece of snapshot.pieces) {
        piecesMap.set(piece.pieceId, piece)
      }

      set({
        roomId: snapshot.roomId,
        userId,
        users: usersMap,
        pieces: piecesMap,
        localUser: usersMap.get(userId),
        pieceCount: snapshot.pieceCount,
        maxPieces: snapshot.maxPieces,
        connectionState: 'connected',
        isLoading: false
      })

      return response
    } catch (error) {
      set({
        error: error.message,
        isLoading: false
      })
      throw error
    }
  },

  leaveRoom: async () => {
    await socket.leaveRoom()
    set({
      roomId: null,
      userId: null,
      users: new Map(),
      pieces: new Map(),
      localUser: null,
      heldPieceId: null,
      pieceCount: 0
    })
  },

  // Piece actions
  spawnPiece: async (type) => {
    const state = get()
    if (state.pieceCount >= state.maxPieces) {
      set({ error: 'Room piece limit reached' })
      return null
    }

    try {
      const response = await socket.spawnPiece(type)
      // Piece will be added via socket event
      // Auto-grab: piece is immediately held by spawner (per PRD)
      if (response.piece) {
        set({ heldPieceId: response.piece.pieceId })
        playGlobalSound(SoundType.SPAWN)
      }
      return response.piece
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },

  grabPiece: async (pieceId) => {
    console.log('gameStore.grabPiece called with:', pieceId)
    try {
      const response = await socket.grabPiece(pieceId)
      console.log('grabPiece response:', response)
      set({ heldPieceId: pieceId })
      playGlobalSound(SoundType.GRAB)
      return response.piece
    } catch (error) {
      console.error('grabPiece error:', error.message)
      // Show feedback for lock denied
      if (error.message === 'LOCK_DENIED') {
        set({ notification: { type: 'warning', message: 'Piece held by another user' } })
      }
      return null
    }
  },

  releasePiece: async (pos, yaw) => {
    const state = get()
    if (!state.heldPieceId) return

    try {
      const response = await socket.releasePiece(state.heldPieceId, pos, yaw)
      set({ heldPieceId: null })
      // Play snap sound if piece was snapped, otherwise release sound
      if (response.adjusted) {
        playGlobalSound(SoundType.SNAP)
      } else {
        playGlobalSound(SoundType.RELEASE)
      }
    } catch (error) {
      set({ error: error.message })
    }
  },

  updatePieceTransform: (pieceId, pos, yaw) => {
    // Update local state optimistically
    const pieces = new Map(get().pieces)
    const piece = pieces.get(pieceId)
    if (piece) {
      piece.pos = pos
      piece.yaw = yaw
      pieces.set(pieceId, { ...piece })
      set({ pieces })
    }

    // Send to server (rate limited)
    socket.sendTransformUpdate(pieceId, pos, yaw)
  },

  deletePiece: async (pieceId) => {
    try {
      await socket.deletePiece(pieceId)
      // Piece will be removed via socket event
      playGlobalSound(SoundType.DELETE)
    } catch (error) {
      set({ error: error.message })
    }
  },

  // Cursor action
  updateCursor: (x, y, z) => {
    socket.sendCursorUpdate(x, y, z)
  },

  // Undo action
  undo: async () => {
    try {
      await socket.undo()
    } catch (error) {
      if (error.message === 'NOTHING_TO_UNDO') {
        set({ notification: { type: 'info', message: 'Nothing to undo' } })
      } else {
        set({ error: error.message })
      }
    }
  },

  // ==================== SOCKET EVENT HANDLERS ====================

  // Handle user joined
  handleUserJoined: (data) => {
    const users = new Map(get().users)
    users.set(data.user.userId, data.user)
    set({ users })
  },

  // Handle user left
  handleUserLeft: (data) => {
    const users = new Map(get().users)
    users.delete(data.userId)
    set({ users })
  },

  // Handle cursor moved
  handleCursorMoved: (data) => {
    const users = new Map(get().users)
    const user = users.get(data.userId)
    if (user) {
      user.cursor = data.cursor
      users.set(data.userId, { ...user })
      set({ users })
    }
  },

  // Handle piece spawned
  handlePieceSpawned: (data) => {
    const pieces = new Map(get().pieces)
    pieces.set(data.piece.pieceId, data.piece)
    set({
      pieces,
      pieceCount: get().pieceCount + 1
    })
  },

  // Handle piece grabbed
  handlePieceGrabbed: (data) => {
    const pieces = new Map(get().pieces)
    const piece = pieces.get(data.pieceId)
    if (piece) {
      piece.heldBy = data.heldBy
      pieces.set(data.pieceId, { ...piece })
      set({ pieces })
    }
  },

  // Handle piece released
  handlePieceReleased: (data) => {
    const pieces = new Map(get().pieces)
    pieces.set(data.piece.pieceId, data.piece)
    set({ pieces })

    // Clear local hold if it was our piece
    if (get().heldPieceId === data.piece.pieceId) {
      set({ heldPieceId: null })
    }
  },

  // Handle piece moved
  handlePieceMoved: (data) => {
    const pieces = new Map(get().pieces)
    const piece = pieces.get(data.pieceId)
    if (piece) {
      piece.pos = data.pos
      piece.yaw = data.yaw
      piece.version = data.version
      pieces.set(data.pieceId, { ...piece })
      set({ pieces })
    }
  },

  // Handle piece deleted
  handlePieceDeleted: (data) => {
    const pieces = new Map(get().pieces)
    pieces.delete(data.pieceId)
    set({
      pieces,
      pieceCount: Math.max(0, get().pieceCount - 1)
    })

    // Clear local hold if it was our piece
    if (get().heldPieceId === data.pieceId) {
      set({ heldPieceId: null })
    }
  },

  // Clear error/notification
  clearError: () => set({ error: null }),
  clearNotification: () => set({ notification: null }),

  // Set notification
  showNotification: (type, message) => set({ notification: { type, message } })
}))

/**
 * Initialize socket event listeners
 * Call this once when app starts
 */
export function initSocketListeners() {
  const store = useGameStore.getState()

  socket.on('connect', () => {
    useGameStore.setState({ connectionState: 'connected' })
  })

  socket.on('disconnect', () => {
    useGameStore.setState({ connectionState: 'disconnected' })
  })

  socket.on('connect_error', () => {
    useGameStore.setState({ connectionState: 'error' })
  })

  socket.on('user_joined', store.handleUserJoined)
  socket.on('user_left', store.handleUserLeft)
  socket.on('cursor_moved', store.handleCursorMoved)
  socket.on('piece_spawned', store.handlePieceSpawned)
  socket.on('piece_grabbed', store.handlePieceGrabbed)
  socket.on('piece_released', store.handlePieceReleased)
  socket.on('piece_moved', store.handlePieceMoved)
  socket.on('piece_deleted', store.handlePieceDeleted)
}

/**
 * Cleanup socket listeners
 */
export function cleanupSocketListeners() {
  socket.cleanup()
}
