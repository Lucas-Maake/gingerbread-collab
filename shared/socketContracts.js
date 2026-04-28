export const SOCKET_EVENTS = Object.freeze({
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  RESET_ROOM: 'reset_room',
  REQUEST_SNAPSHOT: 'request_snapshot',
  SPAWN_PIECE: 'spawn_piece',
  GRAB_PIECE: 'grab_piece',
  RELEASE_PIECE: 'release_piece',
  TRANSFORM_UPDATE: 'transform_update',
  UPDATE_PIECE_PROPERTIES: 'update_piece_properties',
  DELETE_PIECE: 'delete_piece',
  CURSOR_UPDATE: 'cursor_update',
  UNDO: 'undo',
  CREATE_WALL_SEGMENT: 'create_wall_segment',
  DELETE_WALL_SEGMENT: 'delete_wall_segment',
  CREATE_FENCE_LINE: 'create_fence_line',
  CREATE_ICING_STROKE: 'create_icing_stroke',
  DELETE_ICING_STROKE: 'delete_icing_stroke',
  SEND_CHAT_MESSAGE: 'send_chat_message',
  GET_CHAT_HISTORY: 'get_chat_history',
  PING: 'ping'
})

export const SERVER_EVENTS = Object.freeze({
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  HOST_CHANGED: 'host_changed',
  CURSOR_MOVED: 'cursor_moved',
  PIECE_SPAWNED: 'piece_spawned',
  PIECE_GRABBED: 'piece_grabbed',
  PIECE_RELEASED: 'piece_released',
  PIECE_MOVED: 'piece_moved',
  PIECE_PROPERTIES_UPDATED: 'piece_properties_updated',
  PIECE_DELETED: 'piece_deleted',
  WALL_SEGMENT_CREATED: 'wall_segment_created',
  WALL_SEGMENT_DELETED: 'wall_segment_deleted',
  ICING_STROKE_CREATED: 'icing_stroke_created',
  ICING_STROKE_DELETED: 'icing_stroke_deleted',
  HISTORY_ENTRY_ADDED: 'history_entry_added',
  CHAT_MESSAGE: 'chat_message',
  ROOM_RESET: 'room_reset'
})

export const PIECE_TYPES = Object.freeze([
  'BASE_PLATFORM',
  'WALL_FRONT',
  'WALL_BACK',
  'WALL_LEFT',
  'WALL_RIGHT',
  'ROOF_LEFT',
  'ROOF_RIGHT',
  'DOOR',
  'WINDOW_SMALL',
  'WINDOW_LARGE',
  'CANDY_CANE',
  'GUMDROP',
  'PEPPERMINT',
  'GINGERBREAD_MAN',
  'COOKIE_STAR',
  'COOKIE_HEART',
  'MINI_TREE',
  'SNOWFLAKE',
  'CANDY_BUTTON',
  'LICORICE',
  'FROSTING_DOLLOP',
  'CHIMNEY',
  'FENCE_POST',
  'PRESENT'
])

const PIECE_TYPE_SET = new Set(PIECE_TYPES)
const VALID_SURFACE_TYPES = new Set(['ground', 'wall', 'roof'])
const VALID_PIECE_SCALES = new Set(['small', 'normal', 'large'])
const VALID_SNAP_PREFERENCES = new Set(['ground', 'wall', 'roof'])
const DEFAULT_WALL_HEIGHT = 1.5
const MAX_WALL_HEIGHT = 5
const DEFAULT_FENCE_SPACING = 0.5
const DEFAULT_ICING_RADIUS = 0.05
const MAX_ICING_RADIUS = 1
const MAX_CHAT_MESSAGE_LENGTH = 500

function ok(value) {
  return { value }
}

function fail(error) {
  return { error }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteVector2(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
}

function isFiniteVector3(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
}

function normalizeOptionalString(value, maxLength = 100) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLength)
}

export function validateJoinRoomPayload(payload) {
  if (!isRecord(payload) || typeof payload.roomId !== 'string') {
    return fail('INVALID_ROOM_CODE')
  }

  const roomId = payload.roomId.trim().toUpperCase()
  if (roomId.length !== 6) {
    return fail('INVALID_ROOM_CODE')
  }

  return ok({
    roomId,
    userName: normalizeOptionalString(payload.userName, 20),
    previousUserId: normalizeOptionalString(payload.previousUserId, 64)
  })
}

export function validateSpawnPiecePayload(payload) {
  if (!isRecord(payload) || !PIECE_TYPE_SET.has(payload.type)) {
    return fail('INVALID_PIECE_TYPE')
  }

  return ok({ type: payload.type })
}

export function validatePieceIdPayload(payload, error = 'INVALID_PIECE_ID') {
  if (!isRecord(payload) || typeof payload.pieceId !== 'string' || payload.pieceId.trim().length === 0) {
    return fail(error)
  }

  return ok({ pieceId: payload.pieceId })
}

export function validateWallIdPayload(payload) {
  if (!isRecord(payload) || typeof payload.wallId !== 'string' || payload.wallId.trim().length === 0) {
    return fail('INVALID_WALL_ID')
  }

  return ok({ wallId: payload.wallId })
}

export function validateIcingIdPayload(payload) {
  if (!isRecord(payload) || typeof payload.icingId !== 'string' || payload.icingId.trim().length === 0) {
    return fail('INVALID_ICING_ID')
  }

  return ok({ icingId: payload.icingId })
}

export function validateCursorUpdatePayload(payload) {
  if (!isRecord(payload) ||
    !Number.isFinite(payload.x) ||
    !Number.isFinite(payload.y) ||
    !Number.isFinite(payload.z)) {
    return fail('INVALID_CURSOR_DATA')
  }

  return ok({ x: payload.x, y: payload.y, z: payload.z })
}

export function validateTransformUpdatePayload(payload) {
  if (!isRecord(payload) ||
    typeof payload.pieceId !== 'string' ||
    !isFiniteVector3(payload.pos) ||
    !Number.isFinite(payload.yaw)) {
    return fail('INVALID_TRANSFORM_DATA')
  }

  return ok({
    pieceId: payload.pieceId,
    pos: payload.pos,
    yaw: payload.yaw
  })
}

export function validateReleasePiecePayload(payload) {
  if (!isRecord(payload) ||
    typeof payload.pieceId !== 'string' ||
    !isFiniteVector3(payload.pos) ||
    !Number.isFinite(payload.yaw)) {
    return fail('INVALID_RELEASE_DATA')
  }

  const attachedTo = payload.attachedTo === undefined ? null : payload.attachedTo
  const snapNormal = payload.snapNormal === undefined ? null : payload.snapNormal

  if (!(attachedTo === null || typeof attachedTo === 'string') ||
    !(snapNormal === null || isFiniteVector3(snapNormal))) {
    return fail('INVALID_RELEASE_DATA')
  }

  return ok({
    pieceId: payload.pieceId,
    pos: payload.pos,
    yaw: payload.yaw,
    attachedTo,
    snapNormal
  })
}

export function validateUpdatePiecePropertiesPayload(payload) {
  if (!isRecord(payload) ||
    typeof payload.pieceId !== 'string' ||
    payload.pieceId.trim().length === 0 ||
    !isRecord(payload.properties)) {
    return fail('INVALID_PIECE_PROPERTIES')
  }

  const properties = {}
  const { colorVariant, scale, snapPreference } = payload.properties

  if (colorVariant !== undefined) {
    if (colorVariant === null) {
      properties.colorVariant = null
    } else if (Number.isInteger(colorVariant) && colorVariant >= 0 && colorVariant <= 7) {
      properties.colorVariant = colorVariant
    } else {
      return fail('INVALID_PIECE_PROPERTIES')
    }
  }

  if (scale !== undefined) {
    if (VALID_PIECE_SCALES.has(scale)) {
      properties.scale = scale
    } else {
      return fail('INVALID_PIECE_PROPERTIES')
    }
  }

  if (snapPreference !== undefined) {
    if (snapPreference === null) {
      properties.snapPreference = null
    } else if (VALID_SNAP_PREFERENCES.has(snapPreference)) {
      properties.snapPreference = snapPreference
    } else {
      return fail('INVALID_PIECE_PROPERTIES')
    }
  }

  if (Object.keys(properties).length === 0) {
    return fail('INVALID_PIECE_PROPERTIES')
  }

  return ok({
    pieceId: payload.pieceId,
    properties
  })
}

export function validateCreateWallSegmentPayload(payload) {
  if (!isRecord(payload)) {
    return fail('INVALID_WALL_DATA')
  }

  const height = payload.height === undefined ? DEFAULT_WALL_HEIGHT : payload.height
  if (!isFiniteVector2(payload.start) ||
    !isFiniteVector2(payload.end) ||
    !Number.isFinite(height) ||
    height <= 0 ||
    height > MAX_WALL_HEIGHT) {
    return fail('INVALID_WALL_DATA')
  }

  return ok({
    start: payload.start,
    end: payload.end,
    height
  })
}

export function validateCreateFenceLinePayload(payload) {
  if (!isRecord(payload)) {
    return fail('INVALID_FENCE_DATA')
  }

  const spacing = payload.spacing === undefined ? DEFAULT_FENCE_SPACING : payload.spacing
  if (!isFiniteVector2(payload.start) ||
    !isFiniteVector2(payload.end) ||
    !Number.isFinite(spacing) ||
    spacing <= 0) {
    return fail('INVALID_FENCE_DATA')
  }

  return ok({
    start: payload.start,
    end: payload.end,
    spacing
  })
}

export function validateCreateIcingStrokePayload(payload) {
  if (!isRecord(payload)) {
    return fail('INVALID_ICING_DATA')
  }

  const points = payload.points
  const radius = payload.radius === undefined ? DEFAULT_ICING_RADIUS : payload.radius
  const surfaceType = payload.surfaceType === undefined ? 'ground' : payload.surfaceType
  const surfaceId = payload.surfaceId === undefined ? null : payload.surfaceId

  const hasInvalidPoint = !Array.isArray(points) ||
    points.length < 2 ||
    !points.every(isFiniteVector3)
  const hasInvalidRadius = !Number.isFinite(radius) || radius <= 0 || radius > MAX_ICING_RADIUS
  const hasInvalidSurfaceType = !VALID_SURFACE_TYPES.has(surfaceType)
  const hasInvalidSurfaceId = !(surfaceId === null || typeof surfaceId === 'string')

  if (hasInvalidPoint || hasInvalidRadius || hasInvalidSurfaceType || hasInvalidSurfaceId) {
    return fail('INVALID_ICING_DATA')
  }

  return ok({
    points,
    radius,
    surfaceType,
    surfaceId
  })
}

export function validateSendChatMessagePayload(payload) {
  if (!isRecord(payload) || typeof payload.message !== 'string') {
    return fail('INVALID_MESSAGE')
  }

  if (payload.message.length === 0) {
    return fail('INVALID_MESSAGE')
  }

  const message = payload.message.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH)
  if (message.length === 0) {
    return fail('EMPTY_MESSAGE')
  }

  return ok({ message })
}
