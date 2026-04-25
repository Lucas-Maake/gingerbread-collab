import { useMemo, useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import { PieceType } from '../../types'
import './PieceTray.css'

type CategoryId = 'all' | 'structure' | 'candy' | 'cookies' | 'seasonal' | 'icing'

interface PieceDefinition {
    type: PieceType
    label: string
    icon: string
    category: Exclude<CategoryId, 'all'>
}

interface PieceCategory {
    id: CategoryId
    label: string
}

// Walls and roofs are drawn via build tools; this tray handles spawnable details.
const CATEGORY_TABS: PieceCategory[] = [
    { id: 'all', label: 'All' },
    { id: 'structure', label: 'Structure' },
    { id: 'candy', label: 'Candy' },
    { id: 'cookies', label: 'Cookies' },
    { id: 'seasonal', label: 'Seasonal' },
    { id: 'icing', label: 'Icing' },
]

const PIECES: PieceDefinition[] = [
    { type: 'DOOR', label: 'Door', icon: '🚪', category: 'structure' },
    { type: 'WINDOW_SMALL', label: 'Window S', icon: '🪟', category: 'structure' },
    { type: 'WINDOW_LARGE', label: 'Window L', icon: '🪟', category: 'structure' },
    { type: 'CHIMNEY', label: 'Chimney', icon: '🧱', category: 'structure' },
    { type: 'FENCE_POST', label: 'Fence', icon: '🪵', category: 'structure' },
    { type: 'CANDY_CANE', label: 'Cane', icon: '🍬', category: 'candy' },
    { type: 'GUMDROP', label: 'Gumdrop', icon: '🍭', category: 'candy' },
    { type: 'PEPPERMINT', label: 'Mint', icon: '⚪', category: 'candy' },
    { type: 'CANDY_BUTTON', label: 'Button', icon: '🔴', category: 'candy' },
    { type: 'LICORICE', label: 'Licorice', icon: '⬛', category: 'candy' },
    { type: 'GINGERBREAD_MAN', label: 'Person', icon: '🧑', category: 'cookies' },
    { type: 'COOKIE_STAR', label: 'Star', icon: '⭐', category: 'cookies' },
    { type: 'COOKIE_HEART', label: 'Heart', icon: '💗', category: 'cookies' },
    { type: 'MINI_TREE', label: 'Tree', icon: '🎄', category: 'seasonal' },
    { type: 'SNOWFLAKE', label: 'Snowflake', icon: '❄️', category: 'seasonal' },
    { type: 'PRESENT', label: 'Present', icon: '🎁', category: 'seasonal' },
    { type: 'FROSTING_DOLLOP', label: 'Frosting', icon: '🍦', category: 'icing' },
]

/**
 * Piece tray for spawning new pieces.
 */
export default function PieceTray() {
    const [activeCategory, setActiveCategory] = useState<CategoryId>('all')
    const spawnPiece = useGameStore((state) => state.spawnPiece)
    const pieceCount = useGameStore((state) => state.pieceCount)
    const maxPieces = useGameStore((state) => state.maxPieces)
    const setBuildMode = useGameStore((state) => state.setBuildMode)

    const isAtLimit = pieceCount >= maxPieces
    const visiblePieces = useMemo(() => {
        if (activeCategory === 'all') {
            return PIECES
        }
        return PIECES.filter((piece) => piece.category === activeCategory)
    }, [activeCategory])

    const activeLabel = CATEGORY_TABS.find((category) => category.id === activeCategory)?.label || 'All'

    const handleSpawn = async (type: PieceType) => {
        if (type === 'FENCE_POST') {
            setBuildMode('fence')
            return
        }
        if (isAtLimit) return

        setBuildMode('select')
        await spawnPiece(type)
    }

    return (
        <div className="piece-tray">
            <div className="piece-category-tabs" role="tablist" aria-label="Piece categories">
                {CATEGORY_TABS.map((category) => (
                    <button
                        key={category.id}
                        type="button"
                        role="tab"
                        aria-selected={activeCategory === category.id}
                        className={`piece-category-tab ${activeCategory === category.id ? 'active' : ''}`}
                        onClick={() => setActiveCategory(category.id)}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            <div className="piece-category">
                <span className="category-label">{activeLabel}</span>
                <div className="piece-buttons">
                    {visiblePieces.map((piece) => (
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

            {isAtLimit && (
                <div className="limit-warning">
                    Piece limit reached ({maxPieces} max)
                </div>
            )}
        </div>
    )
}
