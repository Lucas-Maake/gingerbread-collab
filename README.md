# Gingerbread Collab Builder

A web-based, 3D collaborative gingerbread house builder where up to 6 users can build together in real-time with a cozy LoFi Christmas vibe.

## Product Overview

- **Real-time Collaboration**: Up to 6 concurrent users per room
- **3D Building**: Interactive 3D environment powered by Three.js
- **Shared Presence**: See other users' cursors and interactions in real-time
- **Server-Authoritative**: Piece locking prevents conflicts
- **Ephemeral Rooms**: No persistence - rooms exist while users are connected

## Technical Stack

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **3D Engine**: Three.js (r150+)
- **3D React Integration**: @react-three/fiber, @react-three/drei
- **State Management**: Zustand
- **Routing**: React Router v6
- **Real-time**: Socket.io Client

### Backend
- **Runtime**: Node.js 18+
- **WebSocket**: Socket.io v4+
- **Framework**: Express
- **State Storage**: In-memory (no database for MVP)

## Project Structure

```
gingerbread-collab/
├── client/                      # Frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── 3d/              # Three.js scene components
│   │   │   │   ├── Scene.jsx           # Main canvas setup
│   │   │   │   ├── BuildSurface.jsx    # 10x10 wooden table
│   │   │   │   ├── Pieces.jsx          # Gingerbread pieces
│   │   │   │   ├── Cursors.jsx         # Other users' cursors
│   │   │   │   ├── CameraController.jsx # Pan/zoom controls
│   │   │   │   ├── Lighting.jsx        # Warm kitchen lighting
│   │   │   │   └── SnowParticles.jsx   # Falling snow effect
│   │   │   └── ui/              # React UI components
│   │   │       ├── LandingPage.jsx     # Room create/join
│   │   │       ├── RoomPage.jsx        # Main game room
│   │   │       ├── PresenceBar.jsx     # Connected users
│   │   │       └── PieceTray.jsx       # Piece spawning
│   │   ├── context/
│   │   │   └── gameStore.js     # Zustand state management
│   │   ├── utils/
│   │   │   └── socket.js        # Socket.io client wrapper
│   │   └── styles/              # CSS files
│   └── package.json
│
├── server/                      # Backend application
│   ├── src/
│   │   ├── rooms/
│   │   │   ├── RoomState.js     # Room, User, Piece data models
│   │   │   └── RoomManager.js   # Room lifecycle management
│   │   ├── handlers/
│   │   │   └── socketHandlers.js # WebSocket event handlers
│   │   ├── utils/
│   │   │   └── TokenBucket.js   # Rate limiting implementation
│   │   ├── constants/
│   │   │   └── config.js        # Configuration constants
│   │   └── index.js             # Server entry point
│   └── package.json
│
├── docs/
│   └── PRD_v2.docx              # Product Requirements Document
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** 18.0.0 or higher
- **npm** or **yarn**
- Modern web browser (Chrome, Firefox, Edge - latest versions)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gingerbread-collab
   ```

2. **Install client dependencies**
   ```bash
   cd client
   npm install
   ```

3. **Install server dependencies**
   ```bash
   cd ../server
   npm install
   ```

### Development

You'll need two terminal windows - one for the client and one for the server.

#### Terminal 1: Start the Backend Server

```bash
cd server
npm run dev
```

The server will run on **http://localhost:3001**

You should see:
```
🏠 Gingerbread Collab Server running on port 3001
Environment: development
Allowed origins: http://localhost:3000, http://localhost:5173, http://localhost:5174, http://localhost:5175
```

#### Terminal 2: Start the Frontend Dev Server

```bash
cd client
npm run dev
```

## Optional Persistence and Scaling

The server now supports optional Redis-backed scaling and room snapshots.

- Set `REDIS_URL` to enable:
  - Socket.IO Redis adapter (multi-instance pub/sub)
  - Redis snapshot storage for room state
- Without `REDIS_URL`, snapshots are stored in a local JSON file (`ROOM_SNAPSHOT_FILE`).
- Snapshot retention is configurable via `ROOM_SNAPSHOT_TTL_MS`.

See `server/.env.example` for the full variable list.
