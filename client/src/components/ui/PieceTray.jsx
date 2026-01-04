import { useGameStore } from '../../context/gameStore'
import './PieceTray.css'

// Piece categories for organization
// Note: Walls and roofs are now drawn using the Wall tool in the BuildToolbar
const PIECE_CATEGORIES = [
  {
    name: 'Details',
    pieces: [
      { type: 'DOOR', label: 'Door', icon: '🚪' },
      { type: 'WINDOW_SMALL', label: 'Window S', icon: '🪟' },
      { type: 'WINDOW_LARGE', label: 'Window L', icon: '🪟' },
    ]
  },
  {
    name: 'Candy',
    pieces: [
      { type: 'CANDY_CANE', label: 'Cane', icon: '🍬' },
      { type: 'GUMDROP', label: 'Gumdrop', icon: '🍭' },
      { type: 'PEPPERMINT', label: 'Mint', icon: '⚪' },
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

  const isAtLimit = pieceCount >= maxPieces

  const handleSpawn = async (type) => {
    if (isAtLimit) return
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
                disabled={isAtLimit}
                title={isAtLimit ? 'Room piece limit reached (50 max)' : `Spawn ${piece.label}`}
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
          Piece limit reached (50 max)
        </div>
      )}
    </div>
  )
}
