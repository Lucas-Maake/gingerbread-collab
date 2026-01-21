import { create } from 'zustand'
import * as socket from '../utils/socket'
import { playGlobalSound, SoundType } from '../hooks/useSoundEffects'
import type {
    PieceState,
    PieceType,
    UserState,
    WallState,
    IcingState,
    ChatMessage,
    Position,
    Normal,
    RoomSnapshot,
    SnapInfo,
    SurfaceType
} from '../types'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'
export type BuildMode = 'select' | 'wall' | 'icing'
export type RoofStyle = 'flat' | 'pitched'
export type TimeOfDay = 'day' | 'night'

interface Notification {
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
}

interface GameState {
    // ==================== CONNECTION STATE ====================
    connectionState: ConnectionState
    roomId: string | null
    userId: string | null
    hostUserId: string | null

    // ==================== USER STATE ====================
    users: Map<string, UserState>
    localUser: UserState | null

    // ==================== PIECE STATE ====================
    pieces: Map<string, PieceState>
    heldPieceId: string | null
    snapInfo: SnapInfo | null
    pieceCount: number
    maxPieces: number

    // ==================== BUILD MODE STATE ====================
    buildMode: BuildMode
    gridSnapEnabled: boolean
    gridSize: number
    roofStyle: RoofStyle
    roofPitchAngle: number

    // ==================== WALL STATE ====================
    walls: Map<string, WallState>
    wallDrawingStartPoint: [number, number] | null

    // ==================== ICING STATE ====================
    icing: Map<string, IcingState>
    icingDrawingPoints: Position[]
    isDrawingIcing: boolean

    // ==================== UI STATE ====================
    isLoading: boolean
    error: string | null
    notification: Notification | null
    timeOfDay: TimeOfDay

    // ==================== CHAT STATE ====================
    chatMessages: ChatMessage[]
    isChatOpen: boolean
    unreadChatCount: number

    // ==================== UNDO STATE ====================
    undoCount: number

    // ==================== ACTIONS ====================

    // Connection actions
    setConnectionState: (state: ConnectionState) => void
    connect: () => void
    disconnect: () => void

    // Room actions
    joinRoom: (roomId: string, userName: string) => Promise<any>
    leaveRoom: () => Promise<void>

    // Piece actions
    spawnPiece: (type: PieceType) => Promise<PieceState | null>
    grabPiece: (pieceId: string) => Promise<PieceState | null>
    releasePiece: (pos: Position, yaw: number, attachedTo?: string | null, snapNormal?: Normal | null) => Promise<void>
    updatePieceTransform: (pieceId: string, pos: Position, yaw: number) => void
    setSnapInfo: (snapInfo: SnapInfo | null) => void
    deletePiece: (pieceId: string) => Promise<void>

    // Cursor action
    updateCursor: (x: number, y: number, z: number) => void

    // Undo action
    undo: () => Promise<void>

    // Socket Event Handlers
    handleUserJoined: (data: { user: UserState }) => void
    handleUserLeft: (data: { userId: string; hostUserId?: string }) => void
    handleCursorMoved: (data: { userId: string; cursor: Position }) => void
    handlePieceSpawned: (data: { piece: PieceState }) => void
    handlePieceGrabbed: (data: { pieceId: string; heldBy: string }) => void
    handlePieceReleased: (data: { piece: PieceState }) => void
    handlePieceMoved: (data: { pieceId: string; pos: Position; yaw: number; version: number }) => void
    handlePieceDeleted: (data: { pieceId: string }) => void
    handleHostChanged: (data: { hostUserId?: string }) => void
    handleRoomReset: (data: { snapshot?: RoomSnapshot }) => void

    // UI Actions
    clearError: () => void
    clearNotification: () => void
    showNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void
    toggleTimeOfDay: () => void
    setTimeOfDay: (time: TimeOfDay) => void

    // Build Mode Actions
    setBuildMode: (mode: BuildMode) => void
    toggleGridSnap: () => void
    setGridSnapEnabled: (enabled: boolean) => void
    toggleRoofStyle: () => void
    setRoofStyle: (style: RoofStyle) => void
    setRoofPitchAngle: (angle: number) => void

    // Wall Actions
    setWallDrawingStartPoint: (point: [number, number] | null) => void
    clearWallDrawingStartPoint: () => void
    createWall: (start: [number, number], end: [number, number], height?: number) => Promise<WallState | null>
    deleteWall: (wallId: string) => Promise<void>
    handleWallCreated: (data: { wall: WallState }) => void
    handleWallDeleted: (data: { wallId: string }) => void

    // Icing Actions
    startIcingStroke: () => void
    addIcingPoint: (point: Position) => void
    endIcingStroke: () => void
    clearIcingStroke: () => void
    createIcing: (points: Position[], radius?: number, surfaceType?: 'ground' | 'wall' | 'roof', surfaceId?: string | null) => Promise<IcingState | null>
    deleteIcing: (icingId: string) => Promise<void>
    handleIcingCreated: (data: { icing: IcingState }) => void
    handleIcingDeleted: (data: { icingId: string }) => void
    resetRoom: () => Promise<void>

    // Chat Actions
    sendChatMessage: (message: string) => Promise<void>
    toggleChat: () => void
    openChat: () => void
    closeChat: () => void
    handleChatMessage: (data: ChatMessage) => void
}

/**
 * Main game state store using Zustand
 */
export const useGameStore = create<GameState>((set, get) => ({
    // ==================== CONNECTION STATE ====================
    connectionState: 'disconnected',
    roomId: null,
    userId: null,
    hostUserId: null,

    // ==================== USER STATE ====================
    users: new Map(),
    localUser: null,

    // ==================== PIECE STATE ====================
    pieces: new Map(),
    heldPieceId: null,
    snapInfo: null,
    pieceCount: 0,
    maxPieces: 50,

    // ==================== BUILD MODE STATE ====================
    buildMode: 'select',
    gridSnapEnabled: true,
    gridSize: 0.5,
    roofStyle: 'pitched',
    roofPitchAngle: 45,

    // ==================== WALL STATE ====================
    walls: new Map(),
    wallDrawingStartPoint: null,

    // ==================== ICING STATE ====================
    icing: new Map(),
    icingDrawingPoints: [],
    isDrawingIcing: false,

    // ==================== UI STATE ====================
    isLoading: false,
    error: null,
    notification: null,
    timeOfDay: 'day',

    // ==================== CHAT STATE ====================
    chatMessages: [],
    isChatOpen: false,
    unreadChatCount: 0,

    // ==================== UNDO STATE ====================
    undoCount: 0,

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
            hostUserId: null,
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
                await new Promise<void>((resolve, reject) => {
                    let settled = false
                    let checkConnection: NodeJS.Timeout | null = null
                    let timeout: NodeJS.Timeout | null = null

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
            const { snapshot, userId, undoCount = 0 } = response

            if (!snapshot) throw new Error('No snapshot received')

            // Build users map
            const usersMap = new Map<string, UserState>()
            for (const user of snapshot.users) {
                usersMap.set(user.userId, user)
            }

            // Build pieces map
            const piecesMap = new Map<string, PieceState>()
            for (const piece of snapshot.pieces) {
                piecesMap.set(piece.pieceId, piece)
            }

            // Build walls map
            const wallsMap = new Map<string, WallState>()
            if (snapshot.walls) {
                for (const wall of snapshot.walls) {
                    wallsMap.set(wall.wallId, wall)
                }
            }

            // Build icing map
            const icingMap = new Map<string, IcingState>()
            if (snapshot.icing) {
                for (const stroke of snapshot.icing) {
                    icingMap.set(stroke.icingId, stroke)
                }
            }

            // Load chat history
            const chatMessages = snapshot.chatMessages || []

            set({
                roomId: snapshot.roomId,
                userId,
                hostUserId: snapshot.hostUserId || null,
                users: usersMap,
                pieces: piecesMap,
                walls: wallsMap,
                icing: icingMap,
                chatMessages,
                localUser: (userId && usersMap.get(userId)) || null,
                pieceCount: snapshot.pieceCount,
                maxPieces: snapshot.maxPieces,
                undoCount,
                connectionState: 'connected',
                isLoading: false
            })

            return response
        } catch (error: any) {
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
            hostUserId: null,
            users: new Map(),
            pieces: new Map(),
            walls: new Map(),
            icing: new Map(),
            chatMessages: [],
            isChatOpen: false,
            unreadChatCount: 0,
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
                const updates: Partial<GameState> = { heldPieceId: response.piece.pieceId }
                if (response.undoCount !== undefined) updates.undoCount = response.undoCount
                set(updates)
                playGlobalSound(SoundType.SPAWN)
                return response.piece
            }
            return null
        } catch (error: any) {
            set({ error: error.message })
            return null
        }
    },

    grabPiece: async (pieceId) => {
        console.log('gameStore.grabPiece called with:', pieceId)
        try {
            const response = await socket.grabPiece(pieceId)
            console.log('grabPiece response:', response)
            if (response.success) {
                set({ heldPieceId: pieceId })
                playGlobalSound(SoundType.GRAB)
                // We need to fetch the piece to return it, or rely on the caller to have it
                const piece = get().pieces.get(pieceId) || null
                return piece
            }
            return null
        } catch (error: any) {
            console.error('grabPiece error:', error.message)
            // Show feedback for lock denied
            if (error.message === 'LOCK_DENIED') {
                set({ notification: { type: 'warning', message: 'Piece held by another user' } })
            }
            return null
        }
    },

    releasePiece: async (pos, yaw, attachedTo = null, snapNormal = null) => {
        const state = get()
        if (!state.heldPieceId) return

        try {
            const response = await socket.releasePiece(state.heldPieceId, pos, yaw, attachedTo, snapNormal)
            const updates: Partial<GameState> = { heldPieceId: null, snapInfo: null }
            if (response.undoCount !== undefined) updates.undoCount = response.undoCount
            set(updates)
            // Play snap sound if piece was snapped, otherwise release sound
            if (response.adjusted || attachedTo) {
                playGlobalSound(SoundType.SNAP)
            } else {
                playGlobalSound(SoundType.RELEASE)
            }
        } catch (error: any) {
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
            const response = await socket.deletePiece(pieceId)
            // Piece will be removed via socket event
            if (response.undoCount !== undefined) {
                set({ undoCount: response.undoCount })
            }
            playGlobalSound(SoundType.DELETE)
        } catch (error: any) {
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
            const response = await socket.undo()
            if (response.undoCount !== undefined) {
                set({ undoCount: response.undoCount })
            }
        } catch (error: any) {
            if (error.message === 'NOTHING_TO_UNDO') {
                set({ notification: { type: 'info', message: 'Nothing to undo' }, undoCount: 0 })
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
        const updates: Partial<GameState> = { users }
        if (data.hostUserId !== undefined) {
            updates.hostUserId = data.hostUserId
        }
        set(updates)
    },

    // Handle cursor moved
    handleCursorMoved: (data) => {
        const users = new Map(get().users)
        const user = users.get(data.userId)
        if (user) {
            user.cursor = { x: data.cursor[0], y: data.cursor[1], z: data.cursor[2], t: Date.now() }
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

    // Handle host changed
    handleHostChanged: (data) => {
        set({ hostUserId: data.hostUserId || null })
    },

    // Handle room reset
    handleRoomReset: (data) => {
        const snapshot = (data.snapshot || {}) as Partial<RoomSnapshot>

        const usersMap = new Map<string, UserState>()
        if (snapshot.users) {
            for (const user of snapshot.users) {
                usersMap.set(user.userId, user)
            }
        }

        const piecesMap = new Map<string, PieceState>()
        if (snapshot.pieces) {
            for (const piece of snapshot.pieces) {
                piecesMap.set(piece.pieceId, piece)
            }
        }

        const wallsMap = new Map<string, WallState>()
        if (snapshot.walls) {
            for (const wall of snapshot.walls) {
                wallsMap.set(wall.wallId, wall)
            }
        }

        const icingMap = new Map<string, IcingState>()
        if (snapshot.icing) {
            for (const stroke of snapshot.icing) {
                icingMap.set(stroke.icingId, stroke)
            }
        }

        set({
            users: usersMap,
            localUser: usersMap.get(get().userId!) || null,
            pieces: piecesMap,
            walls: wallsMap,
            icing: icingMap,
            chatMessages: snapshot.chatMessages || get().chatMessages,
            pieceCount: snapshot.pieceCount || 0,
            maxPieces: snapshot.maxPieces || get().maxPieces,
            heldPieceId: null,
            snapInfo: null,
            wallDrawingStartPoint: null,
            icingDrawingPoints: [],
            isDrawingIcing: false,
            undoCount: 0,
            hostUserId: snapshot.hostUserId || get().hostUserId
        })
    },

    // Clear error/notification
    clearError: () => set({ error: null }),
    clearNotification: () => set({ notification: null }),

    // Set notification
    showNotification: (type, message) => set({ notification: { type, message } }),

    // Time of day toggle
    toggleTimeOfDay: () => set({ timeOfDay: get().timeOfDay === 'day' ? 'night' : 'day' }),
    setTimeOfDay: (time) => set({ timeOfDay: time }),

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
            if (response.error) throw new Error(response.error)

            if (response.success) { // Check for success flag if your socket API returns it
                // Note: response might not contain 'wall' directly if it comes via event
                // But based on my socket.ts, it returns { success, error }
                // The event handleWallCreated adds it to store.
            }

            // If the socket response *does* return a wall, we can return it.
            // Based on previous code, it seems it relied on event or response.
            // I'll assume standard pattern: action triggers server, server broadcasts event, store updates via event.
            // But if we want to return the wall optimistically or from response (if provided):
            // socket.ts says createWallSegment returns { success, error }. It doesn't return the wall.
            // So we return null here, and the component should rely on store update or just success.
            // Wait, the previous code was: `return response.wall`. This implies socket.createWallSegment returned the wall.
            // Let's check socket.ts again.
            // socket.ts: `socket.emit('create_wall_segment', ... (response: { success: boolean; error?: string }) => ...`
            // It seems my socket.ts implementation of createWallSegment might be missing the `wall` in the response type/payload?
            // Or maybe the server indeed returns it. I'll trust the previous code and assume response might have it, but strict type says otherwise.
            // I should update socket.ts if I want to strictly type that it returns a wall, or just return null/void here.
            // For now, I'll return null to be safe with types, as the wall is added via event anyway.
            playGlobalSound(SoundType.SPAWN)
            return null
        } catch (error: any) {
            set({ error: error.message })
            return null
        }
    },

    deleteWall: async (wallId) => {
        try {
            await socket.deleteWallSegment(wallId)
            // Wall will be removed via socket event
            playGlobalSound(SoundType.DELETE)
        } catch (error: any) {
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
            await socket.createIcingStroke(points, radius, surfaceType, surfaceId)
            // Icing will be added via socket event
            playGlobalSound(SoundType.RELEASE)
            return null
        } catch (error: any) {
            set({ error: error.message })
            return null
        }
    },

    deleteIcing: async (icingId) => {
        try {
            await socket.deleteIcingStroke(icingId)
            // Icing will be removed via socket event
            playGlobalSound(SoundType.DELETE)
        } catch (error: any) {
            set({ error: error.message })
        }
    },

    // Reset room - delete all pieces, walls, and icing
    resetRoom: async () => {
        try {
            await socket.resetRoom()
            playGlobalSound(SoundType.DELETE)
        } catch (error: any) {
            if (error.message === 'NOT_HOST') {
                set({ notification: { type: 'warning', message: 'Only the host can reset the room' } })
            } else {
                set({ error: error.message })
            }
        }
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
    },

    // ==================== CHAT ACTIONS ====================

    sendChatMessage: async (message) => {
        try {
            await socket.sendChatMessage(message)
        } catch (error: any) {
            set({ error: error.message })
        }
    },

    toggleChat: () => {
        const isOpen = !get().isChatOpen
        set({
            isChatOpen: isOpen,
            unreadChatCount: isOpen ? 0 : get().unreadChatCount
        })
    },

    openChat: () => set({ isChatOpen: true, unreadChatCount: 0 }),
    closeChat: () => set({ isChatOpen: false }),

    handleChatMessage: (data) => {
        const state = get()
        const chatMessages = [...state.chatMessages, data]
        // Keep only last 100 messages on client too
        if (chatMessages.length > 100) {
            chatMessages.shift()
        }
        set({
            chatMessages,
            // Increment unread count if chat is closed and message is from another user
            unreadChatCount: !state.isChatOpen && data.userId !== state.userId
                ? state.unreadChatCount + 1
                : state.unreadChatCount
        })
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
    socket.on('host_changed', (data) => useGameStore.getState().handleHostChanged(data))
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

    // Chat events
    socket.on('chat_message', (data) => useGameStore.getState().handleChatMessage(data))

    // Room events
    socket.on('room_reset', (data) => useGameStore.getState().handleRoomReset(data))
}

/**
 * Cleanup socket listeners
 */
export function cleanupSocketListeners() {
    socket.cleanup()
    listenersInitialized = false
}
