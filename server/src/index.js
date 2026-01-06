import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerSocketHandlers } from './handlers/socketHandlers.js'
import { roomManager } from './rooms/RoomManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

const isProduction = process.env.NODE_ENV === 'production'

// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  process.env.CLIENT_URL,
  process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null
].filter(Boolean)

// In production, also allow same-origin requests
const corsOptions = {
  origin: isProduction ? (origin, callback) => {
    // Allow requests with no origin (same-origin, mobile apps, etc.)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    // Allow any railway.app subdomain
    if (origin.endsWith('.railway.app')) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  } : allowedOrigins,
  credentials: true
}

// Configure CORS
app.use(cors(corsOptions))

// Parse JSON bodies
app.use(express.json())

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: corsOptions,
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

// Serve static files in production
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist')
  app.use(express.static(clientDistPath))

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes or socket.io
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

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
