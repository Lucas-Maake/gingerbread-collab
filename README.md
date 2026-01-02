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

The client will run on **http://localhost:5173** (or 5174+ if that port is busy)

### Testing the Setup

1. Open the client URL in your browser
2. Enter a nickname (optional) and click "Create New Room"
3. You should see the 3D scene with:
   - A wooden build surface with grid lines
   - Falling snow particles
   - Piece tray at the bottom
   - Your presence indicator in the header
4. Click pieces in the tray to spawn them
5. Open another browser tab to the same room URL to test multiplayer

### Verifying Server Health

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "ok",
  "roomCount": 1,
  "totalUsers": 2,
  "totalPieces": 5,
  "timestamp": 1234567890
}
```

## Implementation Status

### Completed Features

| Feature | Description |
|---------|-------------|
| **Server-Authoritative Locking** | First user to request a piece lock gets it; others receive LOCK_DENIED |
| **Rate Limiting** | Token bucket algorithm limits cursor (20/sec) and transform (30/sec) updates |
| **Occupancy Grid** | 0.25 world unit cells prevent pieces from overlapping on release |
| **Real-time Cursor Sync** | See other users' 3D cursors with names and colors |
| **Piece Spawning** | Click tray to spawn pieces (max 50 per room) |
| **Piece Deletion** | Spawner can delete their own pieces |
| **Transform Broadcasting** | Real-time piece position/rotation sync at max 20Hz |
| **Per-User Undo Stack** | Last 10 actions tracked per user (Ctrl+Z) |
| **Room Management** | Create/join rooms, auto-cleanup after 60s empty |
| **Reconnection Handling** | Automatic reconnection with state restoration |
| **3D Scene** | Isometric orthographic camera with pan/zoom |
| **Visual Effects** | 75 falling snow particles, warm kitchen lighting |
| **User Presence** | Color-coded users in header with active/inactive states |

### Pending Features

| Feature | Status |
|---------|--------|
| Piece interaction (click to grab) | Not yet wired to 3D scene |
| Drag to move pieces | Needs raycasting implementation |
| Q/E rotation while holding | Keyboard handler needed |
| Right-click to delete | Context menu handler needed |
| Cursor raycasting | Project mouse onto build surface |
| Hold visual feedback | Outline/highlight on grabbed pieces |

## How to Use

1. Open **http://localhost:5173** in your browser
2. Enter an optional nickname
3. Click **"Create New Room"** to start a new session, or enter a 6-character room code to join
4. Share the room URL with friends (up to 6 total users)
5. Use the piece tray at the bottom to spawn gingerbread pieces

### Controls (Planned)

| Action | Control |
|--------|---------|
| Pan camera | Middle mouse drag OR Shift + Left drag |
| Zoom | Mouse scroll wheel |
| Grab piece | Left click on piece |
| Move piece | Drag while grabbed |
| Rotate piece | Q/E keys while grabbed |
| Release piece | Left click again or Escape |
| Delete piece | Right click (spawner only) |
| Undo | Ctrl+Z |

## Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────┐  │
│  │  React   │◄──►│  Zustand │◄──►│  Socket.io Client    │  │
│  │   UI     │    │  Store   │    │  (utils/socket.js)   │  │
│  └──────────┘    └──────────┘    └──────────────────────┘  │
│       ▲                                     │               │
│       │                                     │               │
│  ┌──────────┐                              │               │
│  │ Three.js │                              │               │
│  │  Scene   │                              │               │
│  └──────────┘                              │               │
└────────────────────────────────────────────│───────────────┘
                                             │
                                    WebSocket Connection
                                             │
┌────────────────────────────────────────────│───────────────┐
│                         SERVER             │               │
│  ┌──────────────────────┐    ┌────────────▼─────────────┐ │
│  │    RoomManager       │◄──►│    Socket Handlers       │ │
│  │  (rooms/RoomMgr.js)  │    │  (handlers/socket.js)    │ │
│  └──────────────────────┘    └──────────────────────────┘ │
│           │                              │                 │
│           ▼                              ▼                 │
│  ┌──────────────────────┐    ┌──────────────────────────┐ │
│  │     RoomState        │    │      RateLimiter         │ │
│  │  - UserState         │    │  (utils/TokenBucket.js)  │ │
│  │  - PieceState        │    └──────────────────────────┘ │
│  │  - OccupancyGrid     │                                 │
│  └──────────────────────┘                                 │
└───────────────────────────────────────────────────────────┘
```

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client → Server | Join a room with roomId and optional userName |
| `leave_room` | Client → Server | Leave current room |
| `spawn_piece` | Client → Server | Spawn a new piece of given type |
| `grab_piece` | Client → Server | Request lock on a piece |
| `release_piece` | Client → Server | Release lock and finalize position |
| `transform_update` | Client → Server | Stream position/rotation while dragging |
| `cursor_update` | Client → Server | Update cursor position |
| `delete_piece` | Client → Server | Delete a piece (spawner only) |
| `undo` | Client → Server | Undo last action |
| `user_joined` | Server → Clients | New user joined the room |
| `user_left` | Server → Clients | User left the room |
| `piece_spawned` | Server → Clients | New piece created |
| `piece_grabbed` | Server → Clients | Piece locked by user |
| `piece_released` | Server → Clients | Piece released with final position |
| `piece_moved` | Server → Clients | Piece position updated |
| `piece_deleted` | Server → Clients | Piece removed |
| `cursor_moved` | Server → Clients | User cursor position updated |

## Configuration

### Server Configuration (`server/src/constants/config.js`)

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_USERS_PER_ROOM` | 6 | Maximum concurrent users |
| `MAX_PIECES_PER_ROOM` | 50 | Maximum pieces per room |
| `ROOM_CODE_LENGTH` | 6 | Characters in room code |
| `EMPTY_ROOM_TIMEOUT_MS` | 60000 | Delete empty room after 60s |
| `BUILD_SURFACE.WIDTH` | 10 | Build surface width (world units) |
| `BUILD_SURFACE.CELL_SIZE` | 0.25 | Occupancy grid cell size |
| `CURSOR_UPDATES.TOKENS_PER_SEC` | 20 | Rate limit for cursor updates |
| `TRANSFORM_UPDATES.TOKENS_PER_SEC` | 30 | Rate limit for transforms |

### Environment Variables

**Server** (`.env`):
```env
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

**Client** (`.env`):
```env
VITE_SERVER_URL=http://localhost:3001
```

## Known Limitations

### Current Limitations

1. **No piece interaction yet**: Pieces spawn but cannot be clicked/dragged in the 3D scene (handlers not wired up)
2. **No cursor raycasting**: Mouse position not projected onto build surface
3. **Port conflicts**: If ports 3001 or 5173-5175 are in use, you'll need to kill existing processes
4. **No persistence**: All rooms are lost on server restart
5. **Desktop only**: No mobile/touch support
6. **No audio**: Background music not implemented yet

### Technical Debt

- Piece interaction requires Three.js raycasting integration
- Cursor sync needs throttling on client side (currently server-only)
- No unit tests yet
- No error boundary for React components

## Performance Targets (from PRD)

| Metric | Target |
|--------|--------|
| Client-to-server latency | < 100ms (P95) |
| Transform update propagation | < 50ms to all clients (P95) |
| Client FPS | 60 FPS with 6 users and 50 pieces (P90) |
| Initial load time | < 3 seconds |
| Server capacity | 100 concurrent rooms (600 users) |

## Troubleshooting

### Port Already in Use

```bash
# Windows - find process using port 3001
netstat -ano | findstr :3001

# Kill process by PID
taskkill /PID <pid> /F
```

### Client Can't Connect to Server

1. Ensure server is running (`npm run dev` in server directory)
2. Check server console for errors
3. Verify CORS origins include your client port
4. Check browser console for WebSocket errors

### Pieces Not Syncing

1. Check browser console for socket errors
2. Verify `connectionState` in React DevTools (Zustand store)
3. Look for rate limiting messages in server console

## Next Steps

To complete the MVP, implement:

1. **Piece Interaction Hook**: Use `@react-three/fiber`'s `useThree` and raycaster to detect clicks on pieces
2. **Drag Handler**: Track mouse movement and call `updatePieceTransform`
3. **Keyboard Rotation**: Listen for Q/E keys when holding a piece
4. **Cursor Projection**: Raycast from camera through mouse to build surface plane
5. **Delete on Right-Click**: Add context menu handler to pieces

---

**Built with React, Three.js, Socket.io, and Node.js**
