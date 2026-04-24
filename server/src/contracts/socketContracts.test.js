import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCreateIcingStrokePayload,
  validateCreateWallSegmentPayload,
  validateJoinRoomPayload,
  validateUpdatePiecePropertiesPayload,
  validateSendChatMessagePayload
} from '../../../shared/socketContracts.js'

test('validateJoinRoomPayload normalizes room code and optional strings', () => {
  const result = validateJoinRoomPayload({
    roomId: 'abc123',
    userName: '  Builder  ',
    previousUserId: 'user-1'
  })

  assert.equal(result.error, undefined)
  assert.deepEqual(result.value, {
    roomId: 'ABC123',
    userName: 'Builder',
    previousUserId: 'user-1'
  })
})

test('validateCreateWallSegmentPayload rejects invalid geometry and normalizes height', () => {
  const valid = validateCreateWallSegmentPayload({
    start: [0, 0],
    end: [1, 0],
    height: undefined
  })

  assert.equal(valid.error, undefined)
  assert.deepEqual(valid.value, {
    start: [0, 0],
    end: [1, 0],
    height: 1.5
  })

  assert.equal(
    validateCreateWallSegmentPayload({ start: [0, Number.NaN], end: [1, 0], height: 1.5 }).error,
    'INVALID_WALL_DATA'
  )
  assert.equal(
    validateCreateWallSegmentPayload({ start: [0, 0], end: [1, 0], height: 6 }).error,
    'INVALID_WALL_DATA'
  )
})

test('validateCreateIcingStrokePayload validates points, radius, surface type, and surface id', () => {
  const valid = validateCreateIcingStrokePayload({
    points: [[0, 0, 0], [0.5, 0.25, 0]],
    radius: undefined,
    surfaceType: undefined,
    surfaceId: undefined
  })

  assert.equal(valid.error, undefined)
  assert.deepEqual(valid.value, {
    points: [[0, 0, 0], [0.5, 0.25, 0]],
    radius: 0.05,
    surfaceType: 'ground',
    surfaceId: null
  })

  assert.equal(
    validateCreateIcingStrokePayload({ points: [[0, 0, 0]], radius: 0.05, surfaceType: 'ground', surfaceId: null }).error,
    'INVALID_ICING_DATA'
  )
  assert.equal(
    validateCreateIcingStrokePayload({ points: [[0, 0, 0], [1, 0, 0]], radius: 2, surfaceType: 'ground', surfaceId: null }).error,
    'INVALID_ICING_DATA'
  )
  assert.equal(
    validateCreateIcingStrokePayload({ points: [[0, 0, 0], [1, 0, 0]], radius: 0.05, surfaceType: 'ceiling', surfaceId: null }).error,
    'INVALID_ICING_DATA'
  )
  assert.equal(
    validateCreateIcingStrokePayload({ points: [[0, 0, 0], [1, 0, 0]], radius: 0.05, surfaceType: 'wall', surfaceId: 123 }).error,
    'INVALID_ICING_DATA'
  )
})

test('validateSendChatMessagePayload trims, caps, and rejects empty messages', () => {
  const result = validateSendChatMessagePayload({
    message: `  ${'x'.repeat(600)}  `
  })

  assert.equal(result.error, undefined)
  assert.equal(result.value.message.length, 500)
  assert.equal(result.value.message, 'x'.repeat(500))

  assert.equal(validateSendChatMessagePayload({ message: '' }).error, 'INVALID_MESSAGE')
  assert.equal(validateSendChatMessagePayload({ message: '    ' }).error, 'EMPTY_MESSAGE')
  assert.equal(validateSendChatMessagePayload({ message: 123 }).error, 'INVALID_MESSAGE')
})

test('validateUpdatePiecePropertiesPayload validates editable piece properties', () => {
  const valid = validateUpdatePiecePropertiesPayload({
    pieceId: 'piece-1',
    properties: {
      colorVariant: 3,
      scale: 'large',
      snapPreference: 'roof'
    }
  })

  assert.equal(valid.error, undefined)
  assert.deepEqual(valid.value, {
    pieceId: 'piece-1',
    properties: {
      colorVariant: 3,
      scale: 'large',
      snapPreference: 'roof'
    }
  })

  assert.deepEqual(
    validateUpdatePiecePropertiesPayload({
      pieceId: 'piece-1',
      properties: { colorVariant: null, scale: 'normal', snapPreference: null }
    }).value,
    {
      pieceId: 'piece-1',
      properties: { colorVariant: null, scale: 'normal', snapPreference: null }
    }
  )

  assert.equal(
    validateUpdatePiecePropertiesPayload({ pieceId: '', properties: { scale: 'small' } }).error,
    'INVALID_PIECE_PROPERTIES'
  )
  assert.equal(
    validateUpdatePiecePropertiesPayload({ pieceId: 'piece-1', properties: { colorVariant: 99 } }).error,
    'INVALID_PIECE_PROPERTIES'
  )
  assert.equal(
    validateUpdatePiecePropertiesPayload({ pieceId: 'piece-1', properties: { scale: 'huge' } }).error,
    'INVALID_PIECE_PROPERTIES'
  )
  assert.equal(
    validateUpdatePiecePropertiesPayload({ pieceId: 'piece-1', properties: { snapPreference: 'ceiling' } }).error,
    'INVALID_PIECE_PROPERTIES'
  )
})
