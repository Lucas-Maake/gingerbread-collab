import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerSocketHandlers } from './handlers/socketHandlers.js'
import { roomManager } from './rooms/RoomManager.js'
import { RoomSnapshotStore } from './persistence/RoomSnapshotStore.js'

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

let redisCleanup = null

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

// API endpoint to create a new room
app.post('/api/room', (req, res) => {
  const result = roomManager.createRoom()
  if (result.error) {
    return res.status(409).json({ error: result.error })
  }

  return res.json({
    roomId: result.room.roomId
  })
})

// Serve static files in production
if (isProduction) {
  const clientDistPath = path.join(__dirname, '../../client/dist')
  console.log('Static files path:', clientDistPath)

  // Check if dist folder exists
  import('fs').then(fs => {
    if (fs.existsSync(clientDistPath)) {
      console.log('Client dist folder exists')
      console.log('Contents:', fs.readdirSync(clientDistPath))
    } else {
      console.error('ERROR: Client dist folder does not exist at:', clientDistPath)
    }
  })

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

async function configureRedisInfrastructure() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    return null
  }

  try {
    const [{ createClient }, { createAdapter }] = await Promise.all([
      import('redis'),
      import('@socket.io/redis-adapter')
    ])

    const adapterPubClient = createClient({ url: redisUrl })
    const adapterSubClient = adapterPubClient.duplicate()
    const snapshotClient = adapterPubClient.duplicate()

    await Promise.all([
      adapterPubClient.connect(),
      adapterSubClient.connect(),
      snapshotClient.connect()
    ])

    io.adapter(createAdapter(adapterPubClient, adapterSubClient))
    console.log('Socket.IO Redis adapter enabled')

    redisCleanup = async () => {
      await Promise.allSettled([
        adapterPubClient.quit(),
        adapterSubClient.quit(),
        snapshotClient.quit()
      ])
    }

    return snapshotClient
  } catch (error) {
    console.error('Failed to initialize Redis infrastructure. Falling back to in-memory adapter.', error)
    return null
  }
}

async function initializePersistence() {
  const redisSnapshotClient = await configureRedisInfrastructure()
  const snapshotTtlMs = Number(process.env.ROOM_SNAPSHOT_TTL_MS) || undefined

  const snapshotStore = new RoomSnapshotStore({
    redisClient: redisSnapshotClient,
    filePath: process.env.ROOM_SNAPSHOT_FILE || undefined,
    ttlMs: snapshotTtlMs
  })

  roomManager.setSnapshotStore(snapshotStore)
  await roomManager.hydrateFromSnapshotStore()
}

let isShuttingDown = false
async function shutdownServer(signal) {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true

  console.log(`${signal} received, closing server...`)
  await roomManager.shutdown()

  await new Promise((resolve) => {
    httpServer.close(() => {
      console.log('Server closed')
      resolve()
    })
  })

  if (redisCleanup) {
    await redisCleanup()
  }

  process.exit(0)
}

async function startServer() {
  await initializePersistence()

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Gingerbread Collab Server running on port ${PORT}`)
    console.log(`Binding to: 0.0.0.0:${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`)
    console.log(process.env.REDIS_URL
      ? 'Persistence: Redis snapshot store enabled'
      : 'Persistence: local snapshot file store enabled')
  })
}

startServer().catch((error) => {
  console.error('Server failed to start:', error)
  process.exit(1)
})

process.on('SIGTERM', () => {
  void shutdownServer('SIGTERM')
})

process.on('SIGINT', () => {
  void shutdownServer('SIGINT')
})
