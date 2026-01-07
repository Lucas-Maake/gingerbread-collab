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
  snapInfo: null, // Current snap info for held piece { surfaceType, normal, targetId }
  pieceCount: 0,
  maxPieces: 50,

  // ==================== BUILD MODE STATE ====================
  buildMode: 'select', // 'select' | 'wall' | 'icing'
  gridSnapEnabled: true,
  gridSize: 0.5, // Grid snap increment in world units
  roofStyle: 'pitched', // 'flat' | 'pitched'
  roofPitchAngle: 45, // Pitched roof angle in degrees (15-75)

  // ==================== WALL STATE ====================
  walls: new Map(), // Map<wallId, WallState>
  wallDrawingStartPoint: null, // [x, z] or null when not drawing

  // ==================== ICING STATE ====================
  icing: new Map(), // Map<icingId, IcingState>
  icingDrawingPoints: [], // Current stroke being drawn
  isDrawingIcing: false,

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
      heldPieceId: null,
      snapInfo: null
    })
  },

  // Room actions
  joinRoom: async (roomId, userName) => {
    set({ isLoading: true, error: null })

    try {
      // Ensure connected
      if (!socket.isConnected()) {
        socket.connect()
        // Wait for connection with proper cleanup to avoid race conditions
        await new Promise((resolve, reject) => {
          let settled = false
          let checkConnection = null
          let timeout = null

          const cleanup = () => {
            if (checkConnection) clearInterval(checkConnection)
            if (timeout) clearTimeout(timeout)
          }

          timeout = setTimeout(() => {
            if (!settled) {
              settled = true
              cleanup()
              reject(new Error('Connection timeout'))
            }
          }, 10000)

          checkConnection = setInterval(() => {
            if (!settled && socket.isConnected()) {
              settled = true
              cleanup()
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

      // Build walls map
      const wallsMap = new Map()
      if (snapshot.walls) {
        for (const wall of snapshot.walls) {
          wallsMap.set(wall.wallId, wall)
        }
      }

      // Build icing map
      const icingMap = new Map()
      if (snapshot.icing) {
        for (const stroke of snapshot.icing) {
          icingMap.set(stroke.icingId, stroke)
        }
      }

      set({
        roomId: snapshot.roomId,
        userId,
        users: usersMap,
        pieces: piecesMap,
        walls: wallsMap,
        icing: icingMap,
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
      walls: new Map(),
      icing: new Map(),
      localUser: null,
      heldPieceId: null,
      pieceCount: 0,
      buildMode: 'select',
      wallDrawingStartPoint: null,
      icingDrawingPoints: [],
      isDrawingIcing: false
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

  releasePiece: async (pos, yaw, attachedTo = null) => {
    const state = get()
    if (!state.heldPieceId) return

    try {
      const response = await socket.releasePiece(state.heldPieceId, pos, yaw, attachedTo)
      set({ heldPieceId: null, snapInfo: null })
      // Play snap sound if piece was snapped, otherwise release sound
      if (response.adjusted || attachedTo) {
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

  // Set snap info for held piece (used for decorative piece orientation)
  setSnapInfo: (snapInfo) => set({ snapInfo }),

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
  showNotification: (type, message) => set({ notification: { type, message } }),

  // ==================== BUILD MODE ACTIONS ====================

  setBuildMode: (mode) => {
    const state = get()
    // Clear any in-progress drawing when switching modes
    if (state.wallDrawingStartPoint) {
      set({ wallDrawingStartPoint: null })
    }
    if (state.isDrawingIcing) {
      set({ isDrawingIcing: false, icingDrawingPoints: [] })
    }
    set({ buildMode: mode })
  },

  toggleGridSnap: () => set({ gridSnapEnabled: !get().gridSnapEnabled }),
  setGridSnapEnabled: (enabled) => set({ gridSnapEnabled: enabled }),
  toggleRoofStyle: () => set({ roofStyle: get().roofStyle === 'flat' ? 'pitched' : 'flat' }),
  setRoofStyle: (style) => set({ roofStyle: style }),
  setRoofPitchAngle: (angle) => set({ roofPitchAngle: Math.max(15, Math.min(75, angle)) }),

  // Wall drawing actions
  setWallDrawingStartPoint: (point) => set({ wallDrawingStartPoint: point }),
  clearWallDrawingStartPoint: () => set({ wallDrawingStartPoint: null }),

  // Icing drawing actions
  startIcingStroke: () => set({ isDrawingIcing: true, icingDrawingPoints: [] }),
  addIcingPoint: (point) => {
    const points = [...get().icingDrawingPoints, point]
    set({ icingDrawingPoints: points })
  },
  endIcingStroke: () => set({ isDrawingIcing: false }),
  clearIcingStroke: () => set({ icingDrawingPoints: [], isDrawingIcing: false }),

  // ==================== WALL ACTIONS ====================

  createWall: async (start, end, height = 1.5) => {
    try {
      const response = await socket.createWallSegment(start, end, height)
      // Wall will be added via socket event
      playGlobalSound(SoundType.SPAWN)
      return response.wall
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },

  deleteWall: async (wallId) => {
    try {
      await socket.deleteWallSegment(wallId)
      // Wall will be removed via socket event
      playGlobalSound(SoundType.DELETE)
    } catch (error) {
      set({ error: error.message })
    }
  },

  // Wall socket event handlers
  handleWallCreated: (data) => {
    const walls = new Map(get().walls)
    walls.set(data.wall.wallId, data.wall)
    set({ walls })
  },

  handleWallDeleted: (data) => {
    const walls = new Map(get().walls)
    walls.delete(data.wallId)
    set({ walls })
  },

  // ==================== ICING ACTIONS ====================

  createIcing: async (points, radius = 0.05, surfaceType = 'wall', surfaceId = null) => {
    if (points.length < 2) return null
    try {
      const response = await socket.createIcingStroke(points, radius, surfaceType, surfaceId)
      // Icing will be added via socket event
      playGlobalSound(SoundType.RELEASE)
      return response.icing
    } catch (error) {
      set({ error: error.message })
      return null
    }
  },

  deleteIcing: async (icingId) => {
    try {
      await socket.deleteIcingStroke(icingId)
      // Icing will be removed via socket event
      playGlobalSound(SoundType.DELETE)
    } catch (error) {
      set({ error: error.message })
    }
  },

  // Reset room - delete all pieces, walls, and icing
  resetRoom: async () => {
    const state = get()

    // Delete all pieces
    const pieceIds = Array.from(state.pieces.keys())
    for (const pieceId of pieceIds) {
      try {
        await socket.deletePiece(pieceId)
      } catch (error) {
        console.error('Failed to delete piece:', pieceId, error)
      }
    }

    // Delete all walls
    const wallIds = Array.from(state.walls.keys())
    for (const wallId of wallIds) {
      try {
        await socket.deleteWallSegment(wallId)
      } catch (error) {
        console.error('Failed to delete wall:', wallId, error)
      }
    }

    // Delete all icing
    const icingIds = Array.from(state.icing.keys())
    for (const icingId of icingIds) {
      try {
        await socket.deleteIcingStroke(icingId)
      } catch (error) {
        console.error('Failed to delete icing:', icingId, error)
      }
    }

    playGlobalSound(SoundType.DELETE)
  },

  // Icing socket event handlers
  handleIcingCreated: (data) => {
    const icing = new Map(get().icing)
    icing.set(data.icing.icingId, data.icing)
    set({ icing })
  },

  handleIcingDeleted: (data) => {
    const icing = new Map(get().icing)
    icing.delete(data.icingId)
    set({ icing })
  }
}))

// Track if listeners have been initialized to prevent duplicates
let listenersInitialized = false

/**
 * Initialize socket event listeners
 * Call this once when app starts - prevents duplicate registration
 */
export function initSocketListeners() {
  // Prevent duplicate listener registration
  if (listenersInitialized) {
    return
  }
  listenersInitialized = true

  // Use fresh store reference for each event to avoid stale closures
  socket.on('connect', () => {
    useGameStore.setState({ connectionState: 'connected' })
  })

  socket.on('disconnect', () => {
    useGameStore.setState({ connectionState: 'disconnected' })
  })

  socket.on('connect_error', () => {
    useGameStore.setState({ connectionState: 'error' })
  })

  // Use getState() in handlers to always get fresh store state
  socket.on('user_joined', (data) => useGameStore.getState().handleUserJoined(data))
  socket.on('user_left', (data) => useGameStore.getState().handleUserLeft(data))
  socket.on('cursor_moved', (data) => useGameStore.getState().handleCursorMoved(data))
  socket.on('piece_spawned', (data) => useGameStore.getState().handlePieceSpawned(data))
  socket.on('piece_grabbed', (data) => useGameStore.getState().handlePieceGrabbed(data))
  socket.on('piece_released', (data) => useGameStore.getState().handlePieceReleased(data))
  socket.on('piece_moved', (data) => useGameStore.getState().handlePieceMoved(data))
  socket.on('piece_deleted', (data) => useGameStore.getState().handlePieceDeleted(data))

  // Wall events
  socket.on('wall_segment_created', (data) => useGameStore.getState().handleWallCreated(data))
  socket.on('wall_segment_deleted', (data) => useGameStore.getState().handleWallDeleted(data))

  // Icing events
  socket.on('icing_stroke_created', (data) => useGameStore.getState().handleIcingCreated(data))
  socket.on('icing_stroke_deleted', (data) => useGameStore.getState().handleIcingDeleted(data))
}

/**
 * Cleanup socket listeners
 */
export function cleanupSocketListeners() {
  socket.cleanup()
  listenersInitialized = false
}
