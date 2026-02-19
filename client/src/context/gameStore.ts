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
export type BuildMode = 'select' | 'wall' | 'fence' | 'icing'
export type RoofStyle = 'flat' | 'pitched'
export type TimeOfDay = 'day' | 'night'

function getInitialTableSnowEnabled() {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('tableSnowEnabled')
    return saved === 'true'
}

function getPreferredUserName(fallbackName: string | null = null) {
    if (typeof window === 'undefined') {
        return fallbackName || 'Guest'
    }

    const saved = localStorage.getItem('nickname')
    const trimmed = saved?.trim()
    if (trimmed) return trimmed

    return fallbackName || 'Guest'
}

// Join orchestration state to prevent overlapping snapshot overwrites.
let listenersInitialized = false
let autoRejoinInFlight: Promise<any> | null = null
let joinInFlight: Promise<any> | null = null
let joinInFlightKey: string | null = null
let joinRequestCounter = 0
let latestJoinRequestId = 0

function buildJoinKey(roomId: string, userName: string) {
    return `${roomId.toUpperCase()}::${userName.trim()}`
}

function invalidateJoinRequests() {
    latestJoinRequestId += 1
    joinInFlight = null
    joinInFlightKey = null
}

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
    fenceDrawingStartPoint: [number, number] | null

    // ==================== ICING STATE ====================
    icing: Map<string, IcingState>
    icingDrawingPoints: Position[]
    isDrawingIcing: boolean

    // ==================== UI STATE ====================
    isLoading: boolean
    error: string | null
    notification: Notification | null
    timeOfDay: TimeOfDay
    tableSnowEnabled: boolean

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
    toggleTableSnow: () => void
    setTableSnowEnabled: (enabled: boolean) => void

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
    setFenceDrawingStartPoint: (point: [number, number] | null) => void
    clearFenceDrawingStartPoint: () => void
    createWall: (start: [number, number], end: [number, number], height?: number) => Promise<WallState | null>
    createFenceLine: (start: [number, number], end: [number, number], spacing?: number) => Promise<PieceState[]>
    deleteWall: (wallId: string) => Promise<void>
    handleWallCreated: (data: { wall: WallState }) => void
    handleWallDeleted: (data: {
        wallId: string
        deletedPieces?: string[]
        deletedIcing?: string[]
    }) => void

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
    fenceDrawingStartPoint: null,

    // ==================== ICING STATE ====================
    icing: new Map(),
    icingDrawingPoints: [],
    isDrawingIcing: false,

    // ==================== UI STATE ====================
    isLoading: false,
    error: null,
    notification: null,
    timeOfDay: 'day',
    tableSnowEnabled: getInitialTableSnowEnabled(),

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
        invalidateJoinRequests()
        autoRejoinInFlight = null
        set({
            connectionState: 'disconnected',
            roomId: null,
            userId: null,
            hostUserId: null,
            users: new Map(),
            pieces: new Map(),
            localUser: null,
            heldPieceId: null,
            snapInfo: null,
            fenceDrawingStartPoint: null
        })
    },

    // Room actions
    joinRoom: async (roomId, userName) => {
        const normalizedRoomId = roomId.toUpperCase()
        const joinKey = buildJoinKey(normalizedRoomId, userName)

        if (joinInFlight && joinInFlightKey === joinKey) {
            return joinInFlight
        }

        set({ isLoading: true, error: null, connectionState: 'connecting' })

        const requestId = ++joinRequestCounter
        latestJoinRequestId = requestId

        const joinPromise = (async () => {
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

            const response = await socket.joinRoom(normalizedRoomId, userName)

            // Parse snapshot
            const { snapshot, userId, undoCount = 0 } = response

            if (!snapshot) throw new Error('No snapshot received')

            // Ignore stale join responses that completed after a newer join started.
            if (requestId !== latestJoinRequestId) {
                return response
            }

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
        })()

        joinInFlight = joinPromise
        joinInFlightKey = joinKey

        try {
            return await joinPromise
        } catch (error: any) {
            if (requestId === latestJoinRequestId) {
                set({
                    error: error.message,
                    isLoading: false
                })
            }
            throw error
        } finally {
            if (joinInFlight === joinPromise) {
                joinInFlight = null
                joinInFlightKey = null
            }
        }
    },

    leaveRoom: async () => {
        await socket.leaveRoom()
        invalidateJoinRequests()
        autoRejoinInFlight = null
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
            fenceDrawingStartPoint: null,
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

        const trySpawnPiece = async (allowRejoinRetry: boolean): Promise<PieceState | null> => {
            try {
                if (autoRejoinInFlight) {
                    await autoRejoinInFlight.catch(() => null)
                }
                if (joinInFlight) {
                    await joinInFlight.catch(() => null)
                }

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
                if (allowRejoinRetry && error?.message === 'NOT_IN_ROOM') {
                    const latestState = get()
                    if (latestState.roomId) {
                        try {
                            await latestState.joinRoom(
                                latestState.roomId,
                                getPreferredUserName(latestState.localUser?.name || null)
                            )
                            return await trySpawnPiece(false)
                        } catch (rejoinError: any) {
                            set({ error: rejoinError.message })
                            return null
                        }
                    }
                }

                set({ error: error.message })
                return null
            }
        }

        return trySpawnPiece(true)
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
        const alreadyPresent = pieces.has(data.piece.pieceId)
        pieces.set(data.piece.pieceId, data.piece)
        set({
            pieces,
            pieceCount: alreadyPresent ? get().pieceCount : get().pieceCount + 1
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
        const wasDeleted = pieces.delete(data.pieceId)
        if (!wasDeleted) return

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
            fenceDrawingStartPoint: null,
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
    toggleTableSnow: () => {
        const nextValue = !get().tableSnowEnabled
        set({ tableSnowEnabled: nextValue })
        if (typeof window !== 'undefined') {
            localStorage.setItem('tableSnowEnabled', String(nextValue))
        }
    },
    setTableSnowEnabled: (enabled) => {
        set({ tableSnowEnabled: enabled })
        if (typeof window !== 'undefined') {
            localStorage.setItem('tableSnowEnabled', String(enabled))
        }
    },

    // ==================== BUILD MODE ACTIONS ====================

    setBuildMode: (mode) => {
        const state = get()
        // Clear any in-progress drawing when switching modes
        if (state.wallDrawingStartPoint) {
            set({ wallDrawingStartPoint: null })
        }
        if (state.fenceDrawingStartPoint) {
            set({ fenceDrawingStartPoint: null })
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
    setFenceDrawingStartPoint: (point) => set({ fenceDrawingStartPoint: point }),
    clearFenceDrawingStartPoint: () => set({ fenceDrawingStartPoint: null }),

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
        const tryCreateWall = async (allowRejoinRetry: boolean): Promise<WallState | null> => {
            try {
                if (autoRejoinInFlight) {
                    await autoRejoinInFlight.catch(() => null)
                }
                if (joinInFlight) {
                    await joinInFlight.catch(() => null)
                }

                const response = await socket.createWallSegment(start, end, height)
                if (response.error) throw new Error(response.error)

                const updates: Partial<GameState> = {}
                if (response.wall) {
                    // Apply wall from ack for immediate feedback and to avoid missed-broadcast races
                    const walls = new Map(get().walls)
                    walls.set(response.wall.wallId, response.wall)
                    updates.walls = walls
                }
                if (response.undoCount !== undefined) {
                    updates.undoCount = response.undoCount
                }
                if (Object.keys(updates).length > 0) {
                    set(updates)
                }

                playGlobalSound(SoundType.SPAWN)
                return response.wall || null
            } catch (error: any) {
                if (allowRejoinRetry && error?.message === 'NOT_IN_ROOM') {
                    const state = get()
                    if (state.roomId) {
                        try {
                            await state.joinRoom(
                                state.roomId,
                                getPreferredUserName(state.localUser?.name || null)
                            )
                            return await tryCreateWall(false)
                        } catch (rejoinError: any) {
                            set({ error: rejoinError.message })
                            return null
                        }
                    }
                }

                set({ error: error.message })
                return null
            }
        }

        return tryCreateWall(true)
    },

    createFenceLine: async (start, end, spacing = 0.5) => {
        const tryCreateFenceLine = async (allowRejoinRetry: boolean): Promise<PieceState[]> => {
            try {
                if (autoRejoinInFlight) {
                    await autoRejoinInFlight.catch(() => null)
                }
                if (joinInFlight) {
                    await joinInFlight.catch(() => null)
                }

                const response = await socket.createFenceLine(start, end, spacing)
                if (response.error) throw new Error(response.error)

                const updates: Partial<GameState> = {}
                if (response.pieces && response.pieces.length > 0) {
                    const pieces = new Map(get().pieces)
                    let addedCount = 0

                    for (const piece of response.pieces) {
                        if (!pieces.has(piece.pieceId)) {
                            addedCount += 1
                        }
                        pieces.set(piece.pieceId, piece)
                    }

                    updates.pieces = pieces
                    if (addedCount > 0) {
                        updates.pieceCount = get().pieceCount + addedCount
                    }
                }
                if (response.undoCount !== undefined) {
                    updates.undoCount = response.undoCount
                }
                if (Object.keys(updates).length > 0) {
                    set(updates)
                }

                if (response.pieces && response.pieces.length > 0) {
                    playGlobalSound(SoundType.SPAWN)
                }

                return response.pieces || []
            } catch (error: any) {
                if (allowRejoinRetry && error?.message === 'NOT_IN_ROOM') {
                    const state = get()
                    if (state.roomId) {
                        try {
                            await state.joinRoom(
                                state.roomId,
                                getPreferredUserName(state.localUser?.name || null)
                            )
                            return await tryCreateFenceLine(false)
                        } catch (rejoinError: any) {
                            set({ error: rejoinError.message })
                            return []
                        }
                    }
                }

                set({ error: error.message })
                return []
            }
        }

        return tryCreateFenceLine(true)
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

        const updates: Partial<GameState> = { walls }

        if (Array.isArray(data.deletedPieces) && data.deletedPieces.length > 0) {
            const pieces = new Map(get().pieces)
            let deletedCount = 0

            for (const pieceId of data.deletedPieces) {
                if (pieces.delete(pieceId)) {
                    deletedCount += 1
                }
            }

            if (deletedCount > 0) {
                updates.pieces = pieces
                updates.pieceCount = Math.max(0, get().pieceCount - deletedCount)
                if (get().heldPieceId && data.deletedPieces.includes(get().heldPieceId)) {
                    updates.heldPieceId = null
                }
            }
        }

        if (Array.isArray(data.deletedIcing) && data.deletedIcing.length > 0) {
            const icing = new Map(get().icing)
            let changed = false

            for (const icingId of data.deletedIcing) {
                if (icing.delete(icingId)) {
                    changed = true
                }
            }

            if (changed) {
                updates.icing = icing
            }
        }

        set(updates)
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
        const state = useGameStore.getState()
        if (!state.roomId) {
            useGameStore.setState({ connectionState: 'connected' })
            return
        }

        if (autoRejoinInFlight) {
            return
        }

        useGameStore.setState({ connectionState: 'connecting' })

        const userName = getPreferredUserName(state.localUser?.name || null)
        autoRejoinInFlight = state.joinRoom(state.roomId, userName)
            .catch((error: any) => {
                console.error('Auto-rejoin failed:', error)
                useGameStore.setState({ error: `Reconnect failed: ${error.message}` })
            })
            .finally(() => {
                autoRejoinInFlight = null
            })
    })

    socket.on('disconnect', () => {
        invalidateJoinRequests()
        autoRejoinInFlight = null
        useGameStore.setState({ connectionState: 'disconnected', isLoading: false })
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
    invalidateJoinRequests()
    autoRejoinInFlight = null
}
