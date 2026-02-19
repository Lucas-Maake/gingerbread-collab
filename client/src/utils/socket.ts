import { io, Socket } from 'socket.io-client'
import type {
    PieceType,
    Position,
    Normal,
    JoinRoomResponse,
    SpawnPieceResponse,
    ReleasePieceResponse,
    RoomSnapshot,
    DeletePieceResponse,
    CreateWallResponse,
    CreateFenceLineResponse,
    DeleteWallResponse,
    CreateIcingResponse,
    DeleteIcingResponse,
    UndoResponse
} from '../types'

// In production, connect to same origin. In development, use env var or localhost
const SERVER_URL = import.meta.env.VITE_SERVER_URL ||
    (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001')

// Socket instance (singleton)
let socket: Socket | null = null

// Connection state
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'
let connectionState: ConnectionState = 'disconnected'

// Event listeners map for cleanup
const eventListeners = new Map<string, Function[]>()

/**
 * Initialize socket connection
 */
export function initSocket(): Socket {
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
        console.log('Socket connected:', socket?.id)
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
export function connect(): Socket {
    if (!socket) {
        initSocket()
    }
    if (!socket?.connected) {
        connectionState = 'connecting'
        socket?.connect()
    }
    return socket!
}

/**
 * Disconnect the socket
 */
export function disconnect(): void {
    if (socket) {
        socket.disconnect()
        connectionState = 'disconnected'
    }
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
    return socket
}

/**
 * Get connection state
 */
export function getConnectionState(): ConnectionState {
    return connectionState
}

/**
 * Check if connected
 */
export function isConnected(): boolean {
    return socket?.connected ?? false
}

// ==================== ROOM OPERATIONS ====================

/**
 * Get stored user ID for reconnection
 */
function getStoredUserId(roomId: string): string | null {
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
function storeUserId(roomId: string, visitorId: string): void {
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
export function joinRoom(roomId: string, userName: string): Promise<JoinRoomResponse> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        // Try to retrieve previous userId for reconnection
        const previousUserId = getStoredUserId(roomId)
        let settled = false

        const onDisconnect = () => {
            if (settled) return
            settled = true
            cleanup()
            reject(new Error('Disconnected during join'))
        }

        const timeout = setTimeout(() => {
            if (settled) return
            settled = true
            cleanup()
            reject(new Error('Join room timeout'))
        }, 8000)

        const cleanup = () => {
            clearTimeout(timeout)
            socket?.off('disconnect', onDisconnect)
        }

        socket.on('disconnect', onDisconnect)

        socket.emit('join_room', { roomId, userName, previousUserId }, (response: JoinRoomResponse) => {
            if (settled) return
            settled = true
            cleanup()

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
export function leaveRoom(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
        if (!socket?.connected) {
            resolve({ success: true })
            return
        }

        socket.emit('leave_room', (response: { success: boolean; error?: string }) => {
            resolve(response)
        })
    })
}

/**
 * Reset the current room (host only)
 */
export function resetRoom(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('reset_room', (response: { success: boolean; error?: string }) => {
            if (response.error) {
                reject(new Error(response.error))
            } else {
                resolve(response)
            }
        })
    })
}

/**
 * Request fresh snapshot
 */
export function requestSnapshot(): Promise<{ success: boolean; snapshot?: RoomSnapshot; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('request_snapshot', (response: { success: boolean; snapshot?: RoomSnapshot; error?: string }) => {
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
export function spawnPiece(type: PieceType): Promise<SpawnPieceResponse> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('spawn_piece', { type }, (response: SpawnPieceResponse) => {
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
export function grabPiece(pieceId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
        console.log('socket.grabPiece called, connected:', socket?.connected)
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        console.log('Emitting grab_piece event for:', pieceId)
        socket.emit('grab_piece', { pieceId }, (response: { success: boolean; error?: string }) => {
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
export function releasePiece(
    pieceId: string,
    pos: Position,
    yaw: number,
    attachedTo: string | null = null,
    snapNormal: Normal | null = null
): Promise<ReleasePieceResponse> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('release_piece', { pieceId, pos, yaw, attachedTo, snapNormal }, (response: ReleasePieceResponse) => {
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
export function sendTransformUpdate(pieceId: string, pos: Position, yaw: number): void {
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
export function deletePiece(pieceId: string): Promise<DeletePieceResponse> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('delete_piece', { pieceId }, (response: DeletePieceResponse) => {
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
export function sendCursorUpdate(x: number, y: number, z: number): void {
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
export function undo(): Promise<{ success: boolean; undoCount?: number; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('undo', (response: UndoResponse) => {
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
export function createWallSegment(start: [number, number], end: [number, number], height = 1.5): Promise<CreateWallResponse> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        // Avoid hanging UI if ack is lost during connection churn
        let settled = false
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true
                reject(new Error('Wall creation timeout'))
            }
        }, 5000)

        socket.emit('create_wall_segment', { start, end, height }, (response: CreateWallResponse) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)

            if (response.error) {
                reject(new Error(response.error))
            } else {
                resolve(response)
            }
        })
    })
}

/**
 * Create a fence line made of multiple fence posts
 */
export function createFenceLine(
    start: [number, number],
    end: [number, number],
    spacing = 0.5
): Promise<CreateFenceLineResponse> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        let settled = false
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true
                reject(new Error('Fence creation timeout'))
            }
        }, 5000)

        socket.emit('create_fence_line', { start, end, spacing }, (response: CreateFenceLineResponse) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)

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
export function deleteWallSegment(wallId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('delete_wall_segment', { wallId }, (response: DeleteWallResponse) => {
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
export function createIcingStroke(
    points: Position[],
    radius = 0.05,
    surfaceType: 'ground' | 'wall' | 'roof' = 'ground',
    surfaceId: string | null = null
): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('create_icing_stroke', { points, radius, surfaceType, surfaceId }, (response: CreateIcingResponse) => {
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
export function deleteIcingStroke(icingId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('delete_icing_stroke', { icingId }, (response: DeleteIcingResponse) => {
            if (response.error) {
                reject(new Error(response.error))
            } else {
                resolve(response)
            }
        })
    })
}

// ==================== CHAT OPERATIONS ====================

/**
 * Send a chat message
 */
export function sendChatMessage(message: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        socket.emit('send_chat_message', { message }, (response: { success: boolean; error?: string }) => {
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
export function ping(): Promise<{ latency: number; serverTime: number }> {
    return new Promise((resolve, reject) => {
        if (!socket?.connected) {
            reject(new Error('Not connected'))
            return
        }

        const startTime = Date.now()
        socket.emit('ping', (response: { timestamp: number }) => {
            const latency = Date.now() - startTime
            resolve({ latency, serverTime: response.timestamp })
        })
    })
}

/**
 * Subscribe to socket events
 */
export function on(event: string, callback: (...args: any[]) => void): void {
    if (!socket) {
        initSocket()
    }

    socket?.on(event, callback)

    // Track for cleanup
    if (!eventListeners.has(event)) {
        eventListeners.set(event, [])
    }
    eventListeners.get(event)?.push(callback)
}

/**
 * Unsubscribe from socket events
 */
export function off(event: string, callback?: (...args: any[]) => void): void {
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
export function cleanup(): void {
    if (!socket) return

    for (const [event, callbacks] of eventListeners.entries()) {
        for (const callback of callbacks) {
            socket.off(event, callback as any)
        }
    }
    eventListeners.clear()
}

// Export socket for direct access if needed
export { socket }
