import type {
    ChatMessage,
    IcingState,
    PieceState,
    RoomSnapshot,
    UserState,
    WallState
} from '../../types'

export interface SnapshotMaps {
    usersMap: Map<string, UserState>
    piecesMap: Map<string, PieceState>
    wallsMap: Map<string, WallState>
    icingMap: Map<string, IcingState>
    chatMessages: ChatMessage[]
}

export function buildSnapshotMaps(snapshot: Partial<RoomSnapshot>): SnapshotMaps {
    const usersMap = new Map<string, UserState>()
    for (const user of snapshot.users || []) {
        usersMap.set(user.userId, user)
    }

    const piecesMap = new Map<string, PieceState>()
    for (const piece of snapshot.pieces || []) {
        piecesMap.set(piece.pieceId, piece)
    }

    const wallsMap = new Map<string, WallState>()
    for (const wall of snapshot.walls || []) {
        wallsMap.set(wall.wallId, wall)
    }

    const icingMap = new Map<string, IcingState>()
    for (const stroke of snapshot.icing || []) {
        icingMap.set(stroke.icingId, stroke)
    }

    return {
        usersMap,
        piecesMap,
        wallsMap,
        icingMap,
        chatMessages: snapshot.chatMessages || []
    }
}
