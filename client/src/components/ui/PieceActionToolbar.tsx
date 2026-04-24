import { useMemo, useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import { BUILD_SURFACE, INTERACTION } from '../../constants/buildConfig'
import type { Normal, PieceState, PieceType, Position } from '../../types'
import './PieceActionToolbar.css'

const DUPLICATE_OFFSET = 0.5
const HALF_BUILD_SURFACE = BUILD_SURFACE.SIZE / 2

type BusyAction = 'duplicate' | 'delete' | 'place' | null

function clonePosition(pos: Position): Position {
    return [pos[0], pos[1], pos[2]]
}

function cloneNormal(normal: Normal | null): Normal | null {
    return normal ? [normal[0], normal[1], normal[2]] : null
}

function clampToSurface(value: number) {
    return Math.max(-HALF_BUILD_SURFACE, Math.min(HALF_BUILD_SURFACE, value))
}

function formatPieceName(type: PieceType) {
    return type
        .split('_')
        .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
        .join(' ')
}

export function getDuplicateReleasePosition(pos: Position, snapNormal: Normal | null): Position {
    if (snapNormal) {
        const tangentX = -snapNormal[2]
        const tangentZ = snapNormal[0]
        const length = Math.hypot(tangentX, tangentZ)

        if (length > 0.001) {
            return [
                clampToSurface(pos[0] + (tangentX / length) * DUPLICATE_OFFSET),
                pos[1],
                clampToSurface(pos[2] + (tangentZ / length) * DUPLICATE_OFFSET),
            ]
        }
    }

    return [
        clampToSurface(pos[0] + DUPLICATE_OFFSET),
        pos[1],
        clampToSurface(pos[2] + DUPLICATE_OFFSET),
    ]
}

export default function PieceActionToolbar() {
    const heldPieceId = useGameStore((state) => state.heldPieceId)
    const pieces = useGameStore((state) => state.pieces)
    const userId = useGameStore((state) => state.userId)
    const pieceCount = useGameStore((state) => state.pieceCount)
    const maxPieces = useGameStore((state) => state.maxPieces)
    const updatePieceTransform = useGameStore((state) => state.updatePieceTransform)
    const releasePiece = useGameStore((state) => state.releasePiece)
    const spawnPiece = useGameStore((state) => state.spawnPiece)
    const deletePiece = useGameStore((state) => state.deletePiece)
    const [busyAction, setBusyAction] = useState<BusyAction>(null)

    const heldPiece = useMemo(() => {
        return heldPieceId ? pieces.get(heldPieceId) || null : null
    }, [heldPieceId, pieces])

    if (!heldPiece) {
        return null
    }

    const canDelete = heldPiece.spawnedBy === userId
    const canDuplicate = pieceCount < maxPieces
    const isBusy = busyAction !== null
    const pieceName = formatPieceName(heldPiece.type)

    const rotatePiece = (direction: 'left' | 'right') => {
        const delta = direction === 'left'
            ? INTERACTION.ROTATION_SPEED
            : -INTERACTION.ROTATION_SPEED

        updatePieceTransform(
            heldPiece.pieceId,
            clonePosition(heldPiece.pos),
            heldPiece.yaw + delta
        )
    }

    const placePiece = async () => {
        const pos = clonePosition(heldPiece.pos)
        const snapNormal = cloneNormal(heldPiece.snapNormal)

        setBusyAction('place')
        try {
            await releasePiece(pos, heldPiece.yaw, heldPiece.attachedTo, snapNormal)
        } finally {
            setBusyAction(null)
        }
    }

    const duplicatePiece = async () => {
        if (!canDuplicate) return

        const source: Pick<PieceState, 'type' | 'pos' | 'yaw' | 'attachedTo' | 'snapNormal'> = {
            type: heldPiece.type,
            pos: clonePosition(heldPiece.pos),
            yaw: heldPiece.yaw,
            attachedTo: heldPiece.attachedTo,
            snapNormal: cloneNormal(heldPiece.snapNormal),
        }
        const duplicatePos = getDuplicateReleasePosition(source.pos, source.snapNormal)

        setBusyAction('duplicate')
        try {
            await releasePiece(source.pos, source.yaw, source.attachedTo, source.snapNormal)
            const duplicate = await spawnPiece(source.type)

            if (duplicate) {
                await releasePiece(duplicatePos, source.yaw, source.attachedTo, source.snapNormal)
            }
        } finally {
            setBusyAction(null)
        }
    }

    const removePiece = async () => {
        if (!canDelete) return

        setBusyAction('delete')
        try {
            await deletePiece(heldPiece.pieceId)
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className="piece-action-toolbar" role="toolbar" aria-label="Piece actions">
            <div className="piece-action-summary">
                <span className="piece-action-kicker">Holding</span>
                <strong>{pieceName}</strong>
            </div>

            <div className="piece-action-buttons">
                <button
                    type="button"
                    className="piece-action-button"
                    onClick={() => rotatePiece('left')}
                    disabled={isBusy}
                    aria-label="Rotate left"
                    title="Rotate piece left"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11 5.1V2L5.5 6.5 11 11V7.1c3.4.5 6 3.4 6 6.9 0 1.7-.6 3.2-1.6 4.4l1.5 1.3c1.3-1.5 2.1-3.5 2.1-5.7 0-4.6-3.5-8.4-8-8.9z" />
                    </svg>
                    <span>Left</span>
                </button>

                <button
                    type="button"
                    className="piece-action-button"
                    onClick={() => rotatePiece('right')}
                    disabled={isBusy}
                    aria-label="Rotate right"
                    title="Rotate piece right"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M13 5.1V2l5.5 4.5L13 11V7.1c-3.4.5-6 3.4-6 6.9 0 1.7.6 3.2 1.6 4.4l-1.5 1.3C5.8 18.2 5 16.2 5 14c0-4.6 3.5-8.4 8-8.9z" />
                    </svg>
                    <span>Right</span>
                </button>

                <button
                    type="button"
                    className="piece-action-button"
                    onClick={duplicatePiece}
                    disabled={isBusy || !canDuplicate}
                    aria-label="Duplicate"
                    title={canDuplicate ? 'Duplicate piece nearby' : `Room piece limit reached (${maxPieces} max)`}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 7V4c0-1.1.9-2 2-2h9c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-3v3c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2h3zm2 0h4c1.1 0 2 .9 2 2v4h3V4H9v3zm4 2H4v9h9V9z" />
                    </svg>
                    <span>{busyAction === 'duplicate' ? 'Copying' : 'Copy'}</span>
                </button>

                <button
                    type="button"
                    className="piece-action-button"
                    onClick={placePiece}
                    disabled={isBusy}
                    aria-label="Place piece"
                    title="Place piece here"
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9.5 16.2 5.8 12.5 4.4 13.9l5.1 5.1L20 8.5 18.6 7.1 9.5 16.2z" />
                    </svg>
                    <span>Place</span>
                </button>

                <button
                    type="button"
                    className="piece-action-button danger"
                    onClick={removePiece}
                    disabled={isBusy || !canDelete}
                    aria-label="Delete"
                    title={canDelete ? 'Delete piece' : 'Only the creator can delete this piece'}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 21c-1.1 0-2-.9-2-2V7h14v12c0 1.1-.9 2-2 2H7zM8 4l1-1h6l1 1h4v2H4V4h4zm1 5v9h2V9H9zm4 0v9h2V9h-2z" />
                    </svg>
                    <span>Delete</span>
                </button>
            </div>
        </div>
    )
}
