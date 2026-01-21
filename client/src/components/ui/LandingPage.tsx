import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

function LandingPage() {
    const [roomCode, setRoomCode] = useState('')
    const [nickname, setNickname] = useState(
        localStorage.getItem('nickname') || ''
    )
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const navigate = useNavigate()

    const getServerUrl = () => {
        return import.meta.env.VITE_SERVER_URL ||
            (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001')
    }

    const handleCreateRoom = async () => {
        if (isCreating) return
        setIsCreating(true)
        setCreateError(null)

        try {
            const response = await fetch(`${getServerUrl()}/api/room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}'
            })

            if (!response.ok) {
                throw new Error('Failed to create room')
            }

            const data = await response.json()
            const code = data.roomId
            if (!code) {
                throw new Error('Invalid server response')
            }

            if (nickname) {
                localStorage.setItem('nickname', nickname)
            }

            navigate(`/room/${code}`)
        } catch (error: any) {
            setCreateError(error.message || 'Failed to create room')
        } finally {
            setIsCreating(false)
        }
    }

    const handleJoinRoom = (e: FormEvent) => {
        e.preventDefault()
        if (roomCode.trim().length === 6) {
            if (nickname) {
                localStorage.setItem('nickname', nickname)
            }
            navigate(`/room/${roomCode.toUpperCase()}`)
        }
    }

    return (
        <div className="landing-page">
            <div className="landing-content">
                <span className="landing-icon">❄️</span>
                <h1 className="landing-title">Gingerbread Collab</h1>
                <p className="landing-subtitle">
                    Build cozy gingerbread houses with friends in real-time
                </p>

                <div className="landing-card">
                    <div className="input-group">
                        <label htmlFor="nickname">Nickname (optional)</label>
                        <input
                            id="nickname"
                            type="text"
                            placeholder="Enter your nickname"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            maxLength={20}
                        />
                    </div>

                    <button className="btn btn-primary" onClick={handleCreateRoom} disabled={isCreating}>
                        {isCreating ? 'Creating...' : 'Create New Room'}
                    </button>
                    {createError && (
                        <p className="landing-error">{createError}</p>
                    )}

                    <div className="divider">
                        <span>OR</span>
                    </div>

                    <form onSubmit={handleJoinRoom}>
                        <div className="input-group">
                            <label htmlFor="roomCode">Room Code</label>
                            <input
                                id="roomCode"
                                type="text"
                                placeholder="Enter 6-character code"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={6}
                            />
                        </div>
                        <button
                            className="btn btn-secondary"
                            type="submit"
                            disabled={roomCode.trim().length !== 6}
                        >
                            Join Room
                        </button>
                    </form>
                </div>

                <div className="landing-footer">
                    <p className="warning-text">
                        ⚠️ Rooms are ephemeral and last only while users are connected.
                    </p>
                    <p className="info-text">Desktop only • Up to 6 players per room</p>
                </div>
            </div>
        </div>
    )
}

export default LandingPage
