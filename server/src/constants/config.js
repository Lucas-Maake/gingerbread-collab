// Room Configuration (from PRD)
export const ROOM_CONFIG = {
  MAX_USERS_PER_ROOM: 6,
  MAX_PIECES_PER_ROOM: 50,
  ROOM_CODE_LENGTH: 6,
  EMPTY_ROOM_TIMEOUT_MS: 60000, // 60 seconds
  IDLE_ROOM_WARNING_MS: 1800000, // 30 minutes
  IDLE_ROOM_TIMEOUT_MS: 300000, // 5 minutes after warning
  RECONNECT_GRACE_PERIOD_MS: 30000, // 30 seconds
}

// Build Surface Configuration
export const BUILD_SURFACE = {
  WIDTH: 10,
  DEPTH: 10,
  CELL_SIZE: 0.25,
}

// Rate Limiting Configuration
export const RATE_LIMITS = {
  CURSOR_UPDATES: {
    TOKENS_PER_SECOND: 20,
    BURST_CAPACITY: 10,
  },
  TRANSFORM_UPDATES: {
    TOKENS_PER_SECOND: 30,
    BURST_CAPACITY: 15,
  },
  MAX_BROADCAST_HZ: 20, // Max 20 broadcasts per second per piece
}

// User Presence Colors (from PRD)
export const USER_COLORS = [
  '#FF5252', // Red
  '#448AFF', // Blue
  '#69F0AE', // Green
  '#FFD740', // Yellow
  '#E040FB', // Purple
  '#FF6E40', // Orange
]

// Piece Types (MVP Set from PRD)
export const PIECE_TYPES = {
  BASE_PLATFORM: 'BASE_PLATFORM',
  WALL_FRONT: 'WALL_FRONT',
  WALL_BACK: 'WALL_BACK',
  WALL_LEFT: 'WALL_LEFT',
  WALL_RIGHT: 'WALL_RIGHT',
  ROOF_LEFT: 'ROOF_LEFT',
  ROOF_RIGHT: 'ROOF_RIGHT',
  DOOR: 'DOOR',
  WINDOW_SMALL: 'WINDOW_SMALL',
  WINDOW_LARGE: 'WINDOW_LARGE',
  CANDY_CANE: 'CANDY_CANE',
  GUMDROP: 'GUMDROP',
  PEPPERMINT: 'PEPPERMINT',
}

// Camera Configuration
export const CAMERA_CONFIG = {
  MIN_ZOOM: 5,
  MAX_ZOOM: 20,
  DEFAULT_ZOOM: 12,
  ISOMETRIC_ANGLE: Math.PI / 4, // 45 degrees
  PAN_BOUNDS: 2, // World units
}

// Update Thresholds
export const UPDATE_THRESHOLDS = {
  MIN_POSITION_DELTA: 0.005, // World units
  MIN_ROTATION_DELTA: 0.5 * (Math.PI / 180), // 0.5 degrees in radians
}

// Reconnection Configuration
export const RECONNECT_CONFIG = {
  MAX_ATTEMPTS_IN_WINDOW: 5,
  WINDOW_MS: 10000, // 10 seconds
  COOLDOWN_MS: 30000, // 30 seconds
}
