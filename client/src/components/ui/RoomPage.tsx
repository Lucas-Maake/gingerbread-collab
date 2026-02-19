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

async function copyTextToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text)
            return true
        } catch (error) {
            // Fall back to legacy copy path below
        }
    }

    try {
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.setAttribute('readonly', '')
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        textArea.style.pointerEvents = 'none'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()

        const copied = document.execCommand('copy')
        document.body.removeChild(textArea)
        return copied
    } catch {
        return false
    }
}

export default function RoomPage() {
    const { roomId } = useParams<{ roomId: string }>()
    const navigate = useNavigate()

    const [isJoining, setIsJoining] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [copyLinkState, setCopyLinkState] = useState<'idle' | 'success' | 'error'>('idle')
    const hasJoined = useRef(false)
    const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Get state from store
    const connectionState = useGameStore((state) => state.connectionState)
    const pieceCount = useGameStore((state) => state.pieceCount)
    const maxPieces = useGameStore((state) => state.maxPieces)
    const undoCount = useGameStore((state) => state.undoCount)

    // Join room on mount
    useEffect(() => {
        if (pendingLeaveTimeoutRef.current) {
            clearTimeout(pendingLeaveTimeoutRef.current)
            pendingLeaveTimeoutRef.current = null
        }

        // Prevent double-join from React StrictMode
        if (hasJoined.current) return
        hasJoined.current = true

        if (!roomId) {
            setError('No room ID provided')
            setIsJoining(false)
            return
        }

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
            .catch((err: any) => {
                console.error('Failed to join room:', err)
                setError(err.message)
                setIsJoining(false)
            })

        // Cleanup on unmount - get fresh leaveRoom reference
        return () => {
            // Delay leave slightly so StrictMode dev remount does not trigger a real leave/join churn cycle.
            pendingLeaveTimeoutRef.current = setTimeout(() => {
                useGameStore.getState().leaveRoom()
                pendingLeaveTimeoutRef.current = null
            }, 150)
        }
    }, [roomId])

    // Handle undo keyboard shortcut - use callback to avoid stale closure
    const handleUndo = useCallback(() => {
        useGameStore.getState().undo()
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault()
                handleUndo()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleUndo])

    useEffect(() => {
        return () => {
            if (copyResetTimeoutRef.current) {
                clearTimeout(copyResetTimeoutRef.current)
                copyResetTimeoutRef.current = null
            }
            if (pendingLeaveTimeoutRef.current) {
                clearTimeout(pendingLeaveTimeoutRef.current)
                pendingLeaveTimeoutRef.current = null
            }
        }
    }, [])

    const setCopyFeedback = useCallback((state: 'success' | 'error') => {
        setCopyLinkState(state)

        if (copyResetTimeoutRef.current) {
            clearTimeout(copyResetTimeoutRef.current)
        }

        copyResetTimeoutRef.current = setTimeout(() => {
            setCopyLinkState('idle')
            copyResetTimeoutRef.current = null
        }, 2000)
    }, [])

    const handleCopyLink = useCallback(async () => {
        const copied = await copyTextToClipboard(window.location.href)
        setCopyFeedback(copied ? 'success' : 'error')
    }, [setCopyFeedback])

    const copyButtonLabel = copyLinkState === 'success'
        ? 'Copied!'
        : copyLinkState === 'error'
            ? 'Copy Failed'
            : 'Copy Link'

    const copyButtonTitle = copyLinkState === 'error'
        ? 'Clipboard unavailable. Please copy from the address bar.'
        : 'Copy room link'

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
                        className={`btn-copy ${copyLinkState === 'success' ? 'copied' : ''} ${copyLinkState === 'error' ? 'copy-error' : ''}`}
                        onClick={handleCopyLink}
                        title={copyButtonTitle}
                        aria-live="polite"
                    >
                        {copyButtonLabel}
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
                    <p>V: Select mode | W: Wall mode | F: Fence mode | I: Icing mode</p>
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

function getErrorMessage(error: string) {
    switch (error) {
        case 'ROOM_FULL':
            return 'This room is full (6/6 users). Try creating your own room!'
        case 'INVALID_ROOM_CODE':
            return 'Invalid room code. Room codes are 6 characters.'
        case 'ROOM_NOT_FOUND':
            return 'Room not found or expired. Ask the host to create a new one.'
        case 'Connection timeout':
            return 'Could not connect to server. Please check your connection.'
        default:
            return error || 'An unexpected error occurred.'
    }
}
