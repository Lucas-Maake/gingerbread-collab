import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import { BUILD_SURFACE } from '../../constants/buildConfig'
import type { Normal, PieceProperties, PieceScale, PieceState, PieceType, Position, SnapPreference } from '../../types'
import './PieceActionToolbar.css'

const DUPLICATE_OFFSET = 0.5
const HALF_BUILD_SURFACE = BUILD_SURFACE.SIZE / 2
const COLOR_VARIANT_COUNT = 8
const PIECE_SCALES: PieceScale[] = ['small', 'normal', 'large']
const SNAP_PREFERENCES: SnapPreference[] = [null, 'ground', 'wall', 'roof']
const PROPERTY_PIECES = new Set<PieceType>([
    'CANDY_CANE',
    'GUMDROP',
    'PEPPERMINT',
    'GINGERBREAD_MAN',
    'COOKIE_STAR',
    'COOKIE_HEART',
    'MINI_TREE',
    'SNOWFLAKE',
    'CANDY_BUTTON',
    'LICORICE',
    'FROSTING_DOLLOP',
    'CHIMNEY',
    'PRESENT',
])

type BusyAction = 'duplicate' | 'delete' | 'place' | null

interface HeldPieceShortcutHudProps {
    heldPiece: PieceState
    userId: string | null
    pieceCount: number
    maxPieces: number
    releasePiece: (pos: Position, yaw: number, attachedTo?: string | null, snapNormal?: Normal | null) => Promise<void>
    spawnPiece: (type: PieceType) => Promise<PieceState | null>
    deletePiece: (pieceId: string) => Promise<void>
    updatePieceProperties: (pieceId: string, properties: PieceProperties) => Promise<void>
}

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

function isTextEntryTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && (
        target.matches('input, textarea, select') ||
        target.isContentEditable
    )
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
    const releasePiece = useGameStore((state) => state.releasePiece)
    const spawnPiece = useGameStore((state) => state.spawnPiece)
    const deletePiece = useGameStore((state) => state.deletePiece)
    const updatePieceProperties = useGameStore((state) => state.updatePieceProperties)

    const heldPiece = useMemo(() => {
        return heldPieceId ? pieces.get(heldPieceId) || null : null
    }, [heldPieceId, pieces])

    if (!heldPiece) {
        return null
    }

    return (
        <HeldPieceShortcutHud
            heldPiece={heldPiece}
            userId={userId}
            pieceCount={pieceCount}
            maxPieces={maxPieces}
            releasePiece={releasePiece}
            spawnPiece={spawnPiece}
            deletePiece={deletePiece}
            updatePieceProperties={updatePieceProperties}
        />
    )
}

function HeldPieceShortcutHud({
    heldPiece,
    userId,
    pieceCount,
    maxPieces,
    releasePiece,
    spawnPiece,
    deletePiece,
    updatePieceProperties,
}: HeldPieceShortcutHudProps) {
    const [busyAction, setBusyAction] = useState<BusyAction>(null)
    const canDelete = heldPiece.spawnedBy === userId
    const canDuplicate = pieceCount < maxPieces
    const hasEditableProperties = PROPERTY_PIECES.has(heldPiece.type)
    const isBusy = busyAction !== null
    const pieceName = formatPieceName(heldPiece.type)

    const placePiece = useCallback(async () => {
        const pos = clonePosition(heldPiece.pos)
        const snapNormal = cloneNormal(heldPiece.snapNormal)

        setBusyAction('place')
        try {
            await releasePiece(pos, heldPiece.yaw, heldPiece.attachedTo, snapNormal)
        } finally {
            setBusyAction(null)
        }
    }, [heldPiece, releasePiece])

    const duplicatePiece = useCallback(async () => {
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
    }, [canDuplicate, heldPiece, releasePiece, spawnPiece])

    const removePiece = useCallback(async () => {
        if (!canDelete) return

        setBusyAction('delete')
        try {
            await deletePiece(heldPiece.pieceId)
        } finally {
            setBusyAction(null)
        }
    }, [canDelete, deletePiece, heldPiece.pieceId])

    const updateProperties = useCallback((properties: PieceProperties) => {
        if (!hasEditableProperties) return
        void updatePieceProperties(heldPiece.pieceId, properties)
    }, [hasEditableProperties, heldPiece.pieceId, updatePieceProperties])

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.repeat || isBusy || isTextEntryTarget(event.target)) {
                return
            }

            const key = event.key.toLowerCase()

            if (key === 'd') {
                if (!canDuplicate) return
                event.preventDefault()
                void duplicatePiece()
                return
            }

            if (key === 'enter') {
                event.preventDefault()
                void placePiece()
                return
            }

            if (key === 'delete' || key === 'backspace') {
                if (!canDelete) return
                event.preventDefault()
                void removePiece()
                return
            }

            if (key === 'c') {
                if (!hasEditableProperties) return
                event.preventDefault()
                updateProperties({
                    colorVariant: ((heldPiece.colorVariant ?? 0) + 1) % COLOR_VARIANT_COUNT
                })
                return
            }

            if (key === '[' || key === ']') {
                if (!hasEditableProperties) return
                event.preventDefault()
                const currentIndex = PIECE_SCALES.indexOf(heldPiece.scale || 'normal')
                const direction = key === ']' ? 1 : -1
                const nextIndex = (currentIndex + direction + PIECE_SCALES.length) % PIECE_SCALES.length
                updateProperties({ scale: PIECE_SCALES[nextIndex] })
                return
            }

            if (key === 's') {
                if (!hasEditableProperties) return
                event.preventDefault()
                const currentIndex = SNAP_PREFERENCES.indexOf(heldPiece.snapPreference ?? null)
                const nextIndex = (currentIndex + 1) % SNAP_PREFERENCES.length
                updateProperties({ snapPreference: SNAP_PREFERENCES[nextIndex] })
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
        canDelete,
        canDuplicate,
        duplicatePiece,
        hasEditableProperties,
        heldPiece.colorVariant,
        heldPiece.scale,
        heldPiece.snapPreference,
        isBusy,
        placePiece,
        removePiece,
        updateProperties
    ])

    const shortcuts = [
        { key: 'Q', label: 'Rotate L' },
        { key: 'E', label: 'Rotate R' },
        {
            key: 'D',
            label: busyAction === 'duplicate' ? 'Copying' : 'Copy',
            disabled: !canDuplicate,
        },
        {
            key: 'Enter',
            label: busyAction === 'place' ? 'Placing' : 'Place',
        },
        {
            key: 'Del',
            label: busyAction === 'delete' ? 'Deleting' : 'Delete',
            disabled: !canDelete,
        },
        {
            key: 'C',
            label: 'Color',
            value: hasEditableProperties ? `${(heldPiece.colorVariant ?? 0) + 1}` : '',
            disabled: !hasEditableProperties,
        },
        {
            key: '[ ]',
            label: 'Size',
            value: heldPiece.scale || 'normal',
            disabled: !hasEditableProperties,
        },
        {
            key: 'S',
            label: 'Snap',
            value: heldPiece.snapPreference || 'auto',
            disabled: !hasEditableProperties,
        },
    ]

    return (
        <div
            className="piece-action-toolbar"
            role="status"
            aria-label="Piece shortcuts"
            aria-live="polite"
        >
            <div className="piece-action-summary">
                <span className="piece-action-kicker">Holding</span>
                <strong>{pieceName}</strong>
            </div>

            <div className="piece-action-shortcuts">
                {shortcuts.map((shortcut) => (
                    <span
                        key={`${shortcut.key}-${shortcut.label}`}
                        className={`piece-action-shortcut ${shortcut.disabled ? 'disabled' : ''}`}
                        aria-disabled={shortcut.disabled ? 'true' : undefined}
                    >
                        <kbd>{shortcut.key}</kbd>
                        <span>
                            {shortcut.label}
                            {shortcut.value ? <em>{shortcut.value}</em> : null}
                        </span>
                    </span>
                ))}
            </div>
        </div>
    )
}
