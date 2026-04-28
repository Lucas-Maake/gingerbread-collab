import { createWithEqualityFn } from 'zustand/traditional'
import { SERVER_EVENTS } from '../../../../shared/socketContracts.js'
import * as socket from '../../utils/socket'
import { playGlobalSound, SoundType } from '../../hooks/useSoundEffects'
import { getInitialTableSnowEnabled, getPreferredUserName } from './preferences'
import { buildSnapshotMaps } from './snapshot'
import { applyStarterTemplate as applyStarterTemplatePlan } from '../../templates/starterTemplates'
import type { GameState } from './types'
import type {
    PieceState,
    PieceProperties,
    RoomSnapshot,
    WallState,
    BuildHistoryEntry,
} from '../../types'

export type { BuildMode, ConnectionState, GameState, RoofStyle, TimeOfDay } from './types'

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

/**
 * Main game state store using Zustand
 */
export const useGameStore = createWithEqualityFn<GameState>((set, get) => ({
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
    historyEntries: [],

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
            historyEntries: [],
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

            const {
                usersMap,
                piecesMap,
                wallsMap,
                icingMap,
                chatMessages,
                historyEntries
            } = buildSnapshotMaps(snapshot)

            set({
                roomId: snapshot.roomId,
                userId,
                hostUserId: snapshot.hostUserId || null,
                users: usersMap,
                pieces: piecesMap,
                walls: wallsMap,
                icing: icingMap,
                chatMessages,
                historyEntries,
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
            historyEntries: [],
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

    updatePieceProperties: async (pieceId, properties) => {
        const pieces = new Map(get().pieces)
        const piece = pieces.get(pieceId)
        if (!piece) return

        const previousPiece = { ...piece }
        const nextPiece = {
            ...piece,
            ...properties,
            version: piece.version + 1
        }

        pieces.set(pieceId, nextPiece)
        set({ pieces })

        try {
            const response = await socket.updatePieceProperties(pieceId, properties)
            if (response.piece) {
                const latestPieces = new Map(get().pieces)
                latestPieces.set(pieceId, response.piece)
                set({ pieces: latestPieces })
            }
        } catch (error: any) {
            const latestPieces = new Map(get().pieces)
            latestPieces.set(pieceId, previousPiece)
            set({ pieces: latestPieces, error: error.message })
        }
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
            const cursor = Array.isArray(data.cursor)
                ? { x: data.cursor[0], y: data.cursor[1], z: data.cursor[2], t: Date.now() }
                : { x: data.cursor.x, y: data.cursor.y, z: data.cursor.z, t: data.cursor.t ?? Date.now() }

            if (![cursor.x, cursor.y, cursor.z].every(Number.isFinite)) {
                return
            }

            user.cursor = cursor
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

    handlePiecePropertiesUpdated: (data) => {
        const pieces = new Map(get().pieces)
        const piece = pieces.get(data.pieceId)
        if (piece) {
            const properties = data.properties as PieceProperties
            pieces.set(data.pieceId, {
                ...piece,
                ...properties,
                version: data.version
            })
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
        const {
            usersMap,
            piecesMap,
            wallsMap,
            icingMap,
            chatMessages,
            historyEntries
        } = buildSnapshotMaps(snapshot)

        set({
            users: usersMap,
            localUser: usersMap.get(get().userId!) || null,
            pieces: piecesMap,
            walls: wallsMap,
            icing: icingMap,
            chatMessages: snapshot.chatMessages !== undefined ? chatMessages : get().chatMessages,
            historyEntries: snapshot.historyEntries !== undefined ? historyEntries : get().historyEntries,
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

    handleHistoryEntryAdded: (data) => {
        const entry = data.entry as BuildHistoryEntry
        const historyEntries = [...get().historyEntries, entry].slice(-30)
        set({ historyEntries })
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
                const heldPieceId = get().heldPieceId
                if (heldPieceId && data.deletedPieces.includes(heldPieceId)) {
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

    applyStarterTemplate: async (templateId) => {
        const state = get()
        if (state.pieceCount > 0 || state.walls.size > 0) {
            set({ notification: { type: 'warning', message: 'Starter templates need a blank room' } })
            return
        }

        set({
            error: null,
            buildMode: 'select',
            wallDrawingStartPoint: null,
            fenceDrawingStartPoint: null,
            isDrawingIcing: false,
            icingDrawingPoints: [],
        })

        try {
            await applyStarterTemplatePlan(templateId, {
                createWall: (start, end, height) => get().createWall(start, end, height),
                spawnPiece: (type) => get().spawnPiece(type),
                releasePiece: (pos, yaw, attachedTo, snapNormal) => get().releasePiece(pos, yaw, attachedTo, snapNormal),
            })
            set({ notification: { type: 'success', message: 'Starter template added' } })
        } catch (error: any) {
            const message = error.message || 'Could not apply starter template'
            set({ error: message })
            throw new Error(message)
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
    socket.on(SERVER_EVENTS.USER_JOINED, (data) => useGameStore.getState().handleUserJoined(data))
    socket.on(SERVER_EVENTS.USER_LEFT, (data) => useGameStore.getState().handleUserLeft(data))
    socket.on(SERVER_EVENTS.HOST_CHANGED, (data) => useGameStore.getState().handleHostChanged(data))
    socket.on(SERVER_EVENTS.CURSOR_MOVED, (data) => useGameStore.getState().handleCursorMoved(data))
    socket.on(SERVER_EVENTS.PIECE_SPAWNED, (data) => useGameStore.getState().handlePieceSpawned(data))
    socket.on(SERVER_EVENTS.PIECE_GRABBED, (data) => useGameStore.getState().handlePieceGrabbed(data))
    socket.on(SERVER_EVENTS.PIECE_RELEASED, (data) => useGameStore.getState().handlePieceReleased(data))
    socket.on(SERVER_EVENTS.PIECE_MOVED, (data) => useGameStore.getState().handlePieceMoved(data))
    socket.on(SERVER_EVENTS.PIECE_PROPERTIES_UPDATED, (data) => useGameStore.getState().handlePiecePropertiesUpdated(data))
    socket.on(SERVER_EVENTS.PIECE_DELETED, (data) => useGameStore.getState().handlePieceDeleted(data))
    socket.on(SERVER_EVENTS.HISTORY_ENTRY_ADDED, (data) => useGameStore.getState().handleHistoryEntryAdded(data))

    // Wall events
    socket.on(SERVER_EVENTS.WALL_SEGMENT_CREATED, (data) => useGameStore.getState().handleWallCreated(data))
    socket.on(SERVER_EVENTS.WALL_SEGMENT_DELETED, (data) => useGameStore.getState().handleWallDeleted(data))

    // Icing events
    socket.on(SERVER_EVENTS.ICING_STROKE_CREATED, (data) => useGameStore.getState().handleIcingCreated(data))
    socket.on(SERVER_EVENTS.ICING_STROKE_DELETED, (data) => useGameStore.getState().handleIcingDeleted(data))

    // Chat events
    socket.on(SERVER_EVENTS.CHAT_MESSAGE, (data) => useGameStore.getState().handleChatMessage(data))

    // Room events
    socket.on(SERVER_EVENTS.ROOM_RESET, (data) => useGameStore.getState().handleRoomReset(data))
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
