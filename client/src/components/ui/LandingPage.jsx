import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

function LandingPage() {
  const [roomCode, setRoomCode] = useState('')
  const [nickname, setNickname] = useState(
    localStorage.getItem('nickname') || ''
  )
  const navigate = useNavigate()

  const handleCreateRoom = () => {
    // Generate 6-character room code (uppercase, no ambiguous chars)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    if (nickname) {
      localStorage.setItem('nickname', nickname)
    }

    navigate(`/room/${code}`)
  }

  const handleJoinRoom = (e) => {
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
        <h1 className="landing-title">🏠 Gingerbread Collab Builder</h1>
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

          <button className="btn btn-primary" onClick={handleCreateRoom}>
            Create New Room
          </button>

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
