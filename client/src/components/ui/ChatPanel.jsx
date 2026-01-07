import { useState, useRef, useEffect } from 'react'
import { useGameStore } from '../../context/gameStore'
import './ChatPanel.css'

/**
 * Chat panel for room collaboration
 * Shows message history and allows sending messages
 */
export default function ChatPanel() {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const {
    chatMessages,
    isChatOpen,
    unreadChatCount,
    userId,
    toggleChat,
    sendChatMessage
  } = useGameStore()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isChatOpen])

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isChatOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputValue.trim()) {
      sendChatMessage(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e) => {
    // Prevent event from bubbling to game controls
    e.stopPropagation()
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Chat toggle button */}
      <button
        className="chat-toggle-btn"
        onClick={toggleChat}
        title={isChatOpen ? 'Close chat' : 'Open chat'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {!isChatOpen && unreadChatCount > 0 && (
          <span className="chat-badge">{unreadChatCount > 9 ? '9+' : unreadChatCount}</span>
        )}
      </button>

      {/* Chat panel */}
      {isChatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <span>Room Chat</span>
            <button className="chat-close-btn" onClick={toggleChat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                No messages yet. Say hello!
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.userId === userId ? 'own-message' : ''}`}
                >
                  <div className="message-header">
                    <span
                      className="message-author"
                      style={{ color: msg.userColor }}
                    >
                      {msg.userName}
                    </span>
                    <span className="message-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-content">{msg.message}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={!inputValue.trim()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  )
}
