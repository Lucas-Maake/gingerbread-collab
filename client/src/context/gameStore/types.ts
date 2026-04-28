import type {
    ChatMessage,
    BuildHistoryEntry,
    IcingState,
    Normal,
    PieceProperties,
    PieceState,
    PieceType,
    Position,
    RoomSnapshot,
    SnapInfo,
    UserState,
    WallState
} from '../../types'
import type { StarterTemplateId } from '../../templates/starterTemplates'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'
export type BuildMode = 'select' | 'wall' | 'fence' | 'icing'
export type RoofStyle = 'flat' | 'pitched'
export type TimeOfDay = 'day' | 'night'

export interface Notification {
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
}

export interface GameState {
    connectionState: ConnectionState
    roomId: string | null
    userId: string | null
    hostUserId: string | null

    users: Map<string, UserState>
    localUser: UserState | null

    pieces: Map<string, PieceState>
    heldPieceId: string | null
    snapInfo: SnapInfo | null
    pieceCount: number
    maxPieces: number

    buildMode: BuildMode
    gridSnapEnabled: boolean
    gridSize: number
    roofStyle: RoofStyle
    roofPitchAngle: number

    walls: Map<string, WallState>
    wallDrawingStartPoint: [number, number] | null
    fenceDrawingStartPoint: [number, number] | null

    icing: Map<string, IcingState>
    icingDrawingPoints: Position[]
    isDrawingIcing: boolean

    isLoading: boolean
    error: string | null
    notification: Notification | null
    timeOfDay: TimeOfDay
    tableSnowEnabled: boolean

    chatMessages: ChatMessage[]
    isChatOpen: boolean
    unreadChatCount: number

    undoCount: number
    historyEntries: BuildHistoryEntry[]

    setConnectionState: (state: ConnectionState) => void
    connect: () => void
    disconnect: () => void

    joinRoom: (roomId: string, userName: string) => Promise<any>
    leaveRoom: () => Promise<void>

    spawnPiece: (type: PieceType) => Promise<PieceState | null>
    grabPiece: (pieceId: string) => Promise<PieceState | null>
    releasePiece: (pos: Position, yaw: number, attachedTo?: string | null, snapNormal?: Normal | null) => Promise<void>
    updatePieceTransform: (pieceId: string, pos: Position, yaw: number) => void
    updatePieceProperties: (pieceId: string, properties: PieceProperties) => Promise<void>
    setSnapInfo: (snapInfo: SnapInfo | null) => void
    deletePiece: (pieceId: string) => Promise<void>

    updateCursor: (x: number, y: number, z: number) => void

    undo: () => Promise<void>

    handleUserJoined: (data: { user: UserState }) => void
    handleUserLeft: (data: { userId: string; hostUserId?: string }) => void
    handleCursorMoved: (data: { userId: string; cursor: Position | { x: number; y: number; z: number; t?: number } }) => void
    handlePieceSpawned: (data: { piece: PieceState }) => void
    handlePieceGrabbed: (data: { pieceId: string; heldBy: string }) => void
    handlePieceReleased: (data: { piece: PieceState }) => void
    handlePieceMoved: (data: { pieceId: string; pos: Position; yaw: number; version: number }) => void
    handlePiecePropertiesUpdated: (data: { pieceId: string; properties: PieceProperties; version: number }) => void
    handlePieceDeleted: (data: { pieceId: string }) => void
    handleHostChanged: (data: { hostUserId?: string }) => void
    handleRoomReset: (data: { snapshot?: RoomSnapshot }) => void
    handleHistoryEntryAdded: (data: { entry: BuildHistoryEntry }) => void

    clearError: () => void
    clearNotification: () => void
    showNotification: (type: 'info' | 'success' | 'warning' | 'error', message: string) => void
    toggleTimeOfDay: () => void
    setTimeOfDay: (time: TimeOfDay) => void
    toggleTableSnow: () => void
    setTableSnowEnabled: (enabled: boolean) => void

    setBuildMode: (mode: BuildMode) => void
    toggleGridSnap: () => void
    setGridSnapEnabled: (enabled: boolean) => void
    toggleRoofStyle: () => void
    setRoofStyle: (style: RoofStyle) => void
    setRoofPitchAngle: (angle: number) => void

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

    startIcingStroke: () => void
    addIcingPoint: (point: Position) => void
    endIcingStroke: () => void
    clearIcingStroke: () => void
    createIcing: (points: Position[], radius?: number, surfaceType?: 'ground' | 'wall' | 'roof', surfaceId?: string | null) => Promise<IcingState | null>
    deleteIcing: (icingId: string) => Promise<void>
    handleIcingCreated: (data: { icing: IcingState }) => void
    handleIcingDeleted: (data: { icingId: string }) => void
    resetRoom: () => Promise<void>
    applyStarterTemplate: (templateId: StarterTemplateId) => Promise<void>

    sendChatMessage: (message: string) => Promise<void>
    toggleChat: () => void
    openChat: () => void
    closeChat: () => void
    handleChatMessage: (data: ChatMessage) => void
}
