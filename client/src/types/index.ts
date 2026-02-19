/**
 * Shared TypeScript type definitions
 */

// ===========================================
// PIECE TYPES
// ===========================================

export type PieceType =
    | 'BASE_PLATFORM'
    | 'WALL_FRONT'
    | 'WALL_BACK'
    | 'WALL_LEFT'
    | 'WALL_RIGHT'
    | 'ROOF_LEFT'
    | 'ROOF_RIGHT'
    | 'DOOR'
    | 'WINDOW_SMALL'
    | 'WINDOW_LARGE'
    | 'CANDY_CANE'
    | 'GUMDROP'
    | 'PEPPERMINT'
    | 'GINGERBREAD_MAN'
    | 'COOKIE_STAR'
    | 'COOKIE_HEART'
    | 'MINI_TREE'
    | 'SNOWFLAKE'
    | 'CANDY_BUTTON'
    | 'LICORICE'
    | 'FROSTING_DOLLOP'
    | 'CHIMNEY'
    | 'FENCE_POST'
    | 'PRESENT'

export type GeometryType =
    | 'box'
    | 'cylinder'
    | 'cone'
    | 'door'
    | 'windowSmall'
    | 'windowLarge'
    | 'gingerbreadMan'
    | 'star'
    | 'heart'
    | 'tree'
    | 'snowflake'
    | 'candyButton'
    | 'licorice'
    | 'frostingDollop'
    | 'chimney'
    | 'fencePost'
    | 'present'

export interface PieceConfig {
    geometry: GeometryType
    size: number[]
    boundingSize: [number, number, number]
    color: string
    yOffset: number
    rotationX?: number
    model?: string
    modelScale?: number
    allowColorOverride: boolean
}

export type PieceConfigMap = Record<PieceType, PieceConfig>

// ===========================================
// GAME STATE TYPES
// ===========================================

export type Position = [number, number, number]
export type Normal = [number, number, number]

export interface PieceState {
    pieceId: string
    type: PieceType
    pos: Position
    yaw: number
    heldBy: string | null
    spawnedBy: string
    attachedTo: string | null
    snapNormal: Normal | null
    version: number
}

export interface UserState {
    userId: string
    name: string
    color: string
    cursor: { x: number; y: number; z: number; t: number }
    isActive: boolean
}

export interface WallState {
    wallId: string
    start: [number, number]
    end: [number, number]
    height: number
    thickness: number
    createdBy: string
    version: number
}

export interface IcingState {
    icingId: string
    points: Position[]
    radius: number
    surfaceType: 'wall' | 'roof' | 'ground'
    surfaceId: string | null
    createdBy: string
    version: number
}

// ===========================================
// SNAPPING TYPES
// ===========================================

export type SurfaceType = 'wall' | 'roof' | 'ground' | null

export interface SnapResult {
    snapped: boolean
    position: Position
    yaw: number
    pitch: number
    normal: Normal | null
    targetId: string | null
    surfaceType: SurfaceType
}

export interface SnapInfo {
    surfaceType: SurfaceType
    normal: Normal | null
    targetId: string | null
    position?: Position
}

export interface PieceSize {
    width: number
    height: number
    depth: number
    axis?: 'x' | 'z'
}

// ===========================================
// ROOM & SNAPSHOT TYPES
// ===========================================

export interface RoomSnapshot {
    roomId: string
    hostUserId: string
    users: UserState[]
    pieces: PieceState[]
    walls: WallState[]
    icing: IcingState[]
    chatMessages: ChatMessage[]
    pieceCount: number
    maxPieces: number
}

export interface ChatMessage {
    id: string
    userId: string
    userName: string
    userColor: string
    message: string
    timestamp: number
}

// ===========================================
// SOCKET EVENT TYPES
// ===========================================

export interface JoinRoomResponse {
    success?: boolean
    error?: string
    userId?: string
    snapshot?: RoomSnapshot
    isReconnect?: boolean
    undoCount?: number
}

export interface SpawnPieceResponse {
    success?: boolean
    error?: string
    piece?: PieceState
    undoCount?: number
}

export interface ReleasePieceResponse {
    success?: boolean
    error?: string
    piece?: PieceState
    adjusted?: boolean
    undoCount?: number
}

export interface CreateWallResponse {
    success: boolean
    error?: string
    wall?: WallState
    undoCount?: number
}

export interface CreateFenceLineResponse {
    success: boolean
    error?: string
    pieces?: PieceState[]
    undoCount?: number
}

export interface DeleteWallResponse {
    success: boolean
    error?: string
    undoCount?: number
}

export interface CreateIcingResponse {
    success: boolean
    error?: string
    icing?: IcingState
    undoCount?: number
}

export interface DeleteIcingResponse {
    success: boolean
    error?: string
    undoCount?: number
}

export interface UndoResponse {
    success: boolean
    error?: string
    undoCount?: number
}

export interface DeletePieceResponse {
    success: boolean
    error?: string
    undoCount?: number
}
