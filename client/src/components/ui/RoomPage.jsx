import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore, initSocketListeners } from '../../context/gameStore'
import Scene from '../3d/Scene'
import PresenceBar from './PresenceBar'
import PieceTray from './PieceTray'
import MuteButton from './MuteButton'
import SfxMuteButton from './SfxMuteButton'
import ScreenshotButton from './ScreenshotButton'
import ResetCameraButton from './ResetCameraButton'
import ResetRoomButton from './ResetRoomButton'
import DayNightToggle from './DayNightToggle'
import BuildToolbar from './BuildToolbar'
import ChatPanel from './ChatPanel'
import CameraPresets from './CameraPresets'
import './RoomPage.css'

export default function RoomPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()

  const [isJoining, setIsJoining] = useState(true)
  const [error, setError] = useState(null)
  const hasJoined = useRef(false)

  // Get state from store
  const connectionState = useGameStore((state) => state.connectionState)
  const pieceCount = useGameStore((state) => state.pieceCount)
  const maxPieces = useGameStore((state) => state.maxPieces)
  const undoCount = useGameStore((state) => state.undoCount)

  // Join room on mount
  useEffect(() => {
    // Prevent double-join from React StrictMode
    if (hasJoined.current) return
    hasJoined.current = true

    const userName = localStorage.getItem('nickname') || 'Guest'

    // Initialize socket listeners
    initSocketListeners()

    // Get fresh store functions to avoid stale closures
    const { joinRoom, leaveRoom } = useGameStore.getState()

    // Join the room
    joinRoom(roomId, userName)
      .then(() => {
        setIsJoining(false)
      })
      .catch((err) => {
        console.error('Failed to join room:', err)
        setError(err.message)
        setIsJoining(false)
      })

    // Cleanup on unmount - get fresh leaveRoom reference
    return () => {
      useGameStore.getState().leaveRoom()
    }
  }, [roomId])

  // Handle undo keyboard shortcut - use callback to avoid stale closure
  const handleUndo = useCallback(() => {
    useGameStore.getState().undo()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo])

  // Handle connection error
  if (error) {
    return (
      <div className="room-page">
        <div className="error-modal">
          <h2>Unable to Join Room</h2>
          <p>{getErrorMessage(error)}</p>
          <div className="error-actions">
            <button onClick={() => navigate('/')}>Back to Home</button>
            <button onClick={() => window.location.reload()}>Try Again</button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (isJoining) {
    return (
      <div className="room-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Joining room {roomId}...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="room-page">
      {/* Header */}
      <div className="room-header">
        <div className="room-info">
          <h2>Room: {roomId}</h2>
          <button
            className="btn-copy"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href)
            }}
          >
            Copy Link
          </button>
          <span className="piece-count">
            {pieceCount}/{maxPieces} pieces
          </span>
        </div>
        <PresenceBar />
      </div>

      {/* 3D Scene */}
      <div className="canvas-container">
        <Scene />
      </div>

      {/* Piece Tray */}
      <PieceTray />

      {/* Controls Overlay */}
      <div className="controls-overlay">
        <div className="controls-hint">
          <p><strong>Controls:</strong></p>
          <p>V: Select mode | W: Wall mode | I: Icing mode</p>
          <p>G: Toggle grid snap | R: Toggle roof style</p>
          <p>Rotate View: Right Mouse Drag</p>
          <p>Pan: Middle Mouse / Shift + Drag</p>
          <p>Zoom: Mouse Wheel</p>
          <p>Rotate Piece: Q/E (while holding)</p>
          <p>Undo: Ctrl+Z</p>
        </div>
      </div>

      {/* Undo Button */}
      <button
        className={`undo-button ${undoCount === 0 ? 'disabled' : ''}`}
        onClick={handleUndo}
        disabled={undoCount === 0}
        title={undoCount > 0 ? `Undo (${undoCount} available)` : 'Nothing to undo'}
      >
        Undo {undoCount > 0 && <span className="undo-count">({undoCount})</span>}
      </button>

      {/* Build Toolbar */}
      <BuildToolbar />

      {/* Connection Status */}
      {connectionState !== 'connected' && (
        <div className="connection-overlay">
          <p>
            {connectionState === 'connecting' && 'Connecting...'}
            {connectionState === 'disconnected' && 'Disconnected. Reconnecting...'}
            {connectionState === 'error' && 'Connection error. Please refresh.'}
          </p>
        </div>
      )}

      {/* Audio Controls Container */}
      <div className="audio-controls">
        <MuteButton />
        <SfxMuteButton />
      </div>

      {/* Screenshot Button */}
      <ScreenshotButton />

      {/* Reset Camera Button */}
      <ResetCameraButton />

      {/* Reset Room Button */}
      <ResetRoomButton />

      {/* Day/Night Toggle */}
      <DayNightToggle />

      {/* Chat Panel */}
      <ChatPanel />

      {/* Camera Presets */}
      <CameraPresets />
    </div>
  )
}

function getErrorMessage(error) {
  switch (error) {
    case 'ROOM_FULL':
      return 'This room is full (6/6 users). Try creating your own room!'
    case 'INVALID_ROOM_CODE':
      return 'Invalid room code. Room codes are 6 characters.'
    case 'Connection timeout':
      return 'Could not connect to server. Please check your connection.'
    default:
      return error || 'An unexpected error occurred.'
  }
}
