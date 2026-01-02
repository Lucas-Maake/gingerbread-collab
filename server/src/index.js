import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { registerSocketHandlers } from './handlers/socketHandlers.js'
import { roomManager } from './rooms/RoomManager.js'

const app = express()
const httpServer = createServer(app)

// Allowed origins for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.CLIENT_URL
].filter(Boolean)

// Configure CORS
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}))

// Parse JSON bodies
app.use(express.json())

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
})

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = roomManager.getStats()
  res.json({
    status: 'ok',
    ...stats,
    timestamp: Date.now()
  })
})

// API endpoint to check if room exists
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params
  const room = roomManager.getRoom(roomId.toUpperCase())

  if (room) {
    res.json({
      exists: true,
      roomId: room.roomId,
      userCount: room.userCount,
      pieceCount: room.pieceCount,
      isFull: room.isFull()
    })
  } else {
    res.json({
      exists: false,
      roomId: roomId.toUpperCase()
    })
  }
})

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Register all event handlers
  registerSocketHandlers(io, socket)
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`🏠 Gingerbread Collab Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...')
  roomManager.stopCleanupTimer()
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...')
  roomManager.stopCleanupTimer()
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
