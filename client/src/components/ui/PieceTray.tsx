import { useGameStore } from '../../context/gameStore'
import { PieceType } from '../../types'
import './PieceTray.css'

interface PieceDefinition {
    type: PieceType
    label: string
    icon: string
}

interface PieceCategory {
    name: string
    pieces: PieceDefinition[]
}

// Piece categories for organization
// Note: Walls, roofs, and fences are drawn via build tools instead of piece spawning.
const PIECE_CATEGORIES: PieceCategory[] = [
    {
        name: 'Details',
        pieces: [
            { type: 'DOOR', label: 'Door', icon: '🚪' },
            { type: 'WINDOW_SMALL', label: 'Window S', icon: '🪟' },
            { type: 'WINDOW_LARGE', label: 'Window L', icon: '🪟' },
            { type: 'CHIMNEY', label: 'Chimney', icon: '🧱' },
            { type: 'FENCE_POST', label: 'Fence', icon: '🪵' },
        ]
    },
    {
        name: 'Cookies',
        pieces: [
            { type: 'GINGERBREAD_MAN', label: 'Person', icon: '🧑' },
            { type: 'COOKIE_STAR', label: 'Star', icon: '⭐' },
            { type: 'COOKIE_HEART', label: 'Heart', icon: '💗' },
        ]
    },
    {
        name: 'Candy',
        pieces: [
            { type: 'CANDY_CANE', label: 'Cane', icon: '🍬' },
            { type: 'GUMDROP', label: 'Gumdrop', icon: '🍭' },
            { type: 'PEPPERMINT', label: 'Mint', icon: '⚪' },
            { type: 'CANDY_BUTTON', label: 'Button', icon: '🔴' },
            { type: 'LICORICE', label: 'Licorice', icon: '⬛' },
        ]
    },
    {
        name: 'Decor',
        pieces: [
            { type: 'MINI_TREE', label: 'Tree', icon: '🎄' },
            { type: 'SNOWFLAKE', label: 'Snowflake', icon: '❄️' },
            { type: 'FROSTING_DOLLOP', label: 'Frosting', icon: '🍦' },
            { type: 'PRESENT', label: 'Present', icon: '🎁' },
        ]
    }
]

/**
 * Piece tray for spawning new pieces
 */
export default function PieceTray() {
    const spawnPiece = useGameStore((state) => state.spawnPiece)
    const pieceCount = useGameStore((state) => state.pieceCount)
    const maxPieces = useGameStore((state) => state.maxPieces)
    const setBuildMode = useGameStore((state) => state.setBuildMode)

    const isAtLimit = pieceCount >= maxPieces

    const handleSpawn = async (type: PieceType) => {
        if (type === 'FENCE_POST') {
            setBuildMode('fence')
            return
        }
        if (isAtLimit) return
        // Auto-switch to select mode so the user can place the piece
        setBuildMode('select')
        await spawnPiece(type)
    }

    return (
        <div className="piece-tray">
            {PIECE_CATEGORIES.map((category) => (
                <div key={category.name} className="piece-category">
                    <span className="category-label">{category.name}</span>
                    <div className="piece-buttons">
                        {category.pieces.map((piece) => (
                            <button
                                key={piece.type}
                                className="piece-button"
                                onClick={() => handleSpawn(piece.type)}
                                disabled={piece.type !== 'FENCE_POST' && isAtLimit}
                                title={
                                    piece.type === 'FENCE_POST'
                                        ? 'Activate fence drawing tool'
                                        : (isAtLimit ? `Room piece limit reached (${maxPieces} max)` : `Spawn ${piece.label}`)
                                }
                            >
                                <span className="piece-icon">{piece.icon}</span>
                                <span className="piece-label">{piece.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {isAtLimit && (
                <div className="limit-warning">
                    Piece limit reached ({maxPieces} max)
                </div>
            )}
        </div>
    )
}
