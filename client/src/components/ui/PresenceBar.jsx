import { useMemo } from 'react'
import { useGameStore } from '../../context/gameStore'
import './PresenceBar.css'

/**
 * Shows connected users with their colors
 */
export default function PresenceBar() {
  const users = useGameStore((state) => state.users)
  const localUserId = useGameStore((state) => state.userId)

  // Convert Map to array and sort (local user first)
  const userList = useMemo(() => {
    const arr = Array.from(users.values())
    return arr.sort((a, b) => {
      if (a.userId === localUserId) return -1
      if (b.userId === localUserId) return 1
      return 0
    })
  }, [users, localUserId])

  return (
    <div className="presence-bar">
      {userList.map((user) => (
        <UserBadge
          key={user.userId}
          user={user}
          isLocal={user.userId === localUserId}
        />
      ))}
      <span className="user-count">{userList.length}/6</span>
    </div>
  )
}

function UserBadge({ user, isLocal }) {
  return (
    <div
      className={`user-badge ${isLocal ? 'local' : ''} ${!user.isActive ? 'inactive' : ''}`}
      style={{ borderColor: user.color }}
      title={`${user.name}${isLocal ? ' (You)' : ''}${!user.isActive ? ' (Away)' : ''}`}
    >
      <div
        className="user-avatar"
        style={{ backgroundColor: user.color }}
      >
        {user.name.charAt(0).toUpperCase()}
      </div>
      <span className="user-name">
        {user.name}
        {isLocal && ' (You)'}
      </span>
    </div>
  )
}
