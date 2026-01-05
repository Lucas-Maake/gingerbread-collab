import { useState, useCallback } from 'react'
import { useGameStore } from '../../context/gameStore'
import './ResetRoomButton.css'

/**
 * Button to reset room - removes all pieces, walls, and icing
 * Includes confirmation dialog to prevent accidental resets
 */
export default function ResetRoomButton() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const resetRoom = useGameStore((state) => state.resetRoom)

  const handleClick = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    setIsResetting(true)
    await resetRoom()
    setIsResetting(false)
    setShowConfirm(false)
  }, [resetRoom])

  const handleCancel = useCallback(() => {
    setShowConfirm(false)
  }, [])

  return (
    <>
      <button
        className="reset-room-button"
        onClick={handleClick}
        title="Reset room - remove all pieces, walls, and icing"
        aria-label="Reset room"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
        <span className="reset-room-label">Reset</span>
      </button>

      {showConfirm && (
        <div className="reset-confirm-overlay">
          <div className="reset-confirm-dialog">
            <h3>Reset Room?</h3>
            <p>This will remove all pieces, walls, and icing from the room. This cannot be undone.</p>
            <div className="reset-confirm-buttons">
              <button
                className="reset-confirm-cancel"
                onClick={handleCancel}
                disabled={isResetting}
              >
                Cancel
              </button>
              <button
                className="reset-confirm-yes"
                onClick={handleConfirm}
                disabled={isResetting}
              >
                {isResetting ? 'Resetting...' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
