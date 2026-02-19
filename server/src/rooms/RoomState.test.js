import test from 'node:test'
import assert from 'node:assert/strict'
import { RoomState, PieceState, IcingState } from './RoomState.js'

function createRoomWithHost() {
  const room = new RoomState('ABC123')
  const { user } = room.addUser('socket-1', 'Host')
  return { room, userId: user.userId }
}

function createSquareWalls(room, userId, minX, maxX, minZ, maxZ) {
  const walls = []
  walls.push(room.createWall([minX, minZ], [maxX, minZ], 1.5, userId).wall)
  walls.push(room.createWall([maxX, minZ], [maxX, maxZ], 1.5, userId).wall)
  walls.push(room.createWall([maxX, maxZ], [minX, maxZ], 1.5, userId).wall)
  walls.push(room.createWall([minX, maxZ], [minX, minZ], 1.5, userId).wall)
  return walls
}

test('deleteWall cascades wall-attached and unsupported roof-attached pieces', () => {
  const { room, userId } = createRoomWithHost()
  const [deletedWall] = createSquareWalls(room, userId, -1, 1, -1, 1)

  const wallAttachedPiece = new PieceState('WINDOW_SMALL', userId, [0, 0.8, -0.95])
  wallAttachedPiece.setAttachedTo(deletedWall.wallId)
  room.pieces.set(wallAttachedPiece.pieceId, wallAttachedPiece)

  const roofAttachedPiece = new PieceState('CHIMNEY', userId, [0, 1.9, 0])
  roofAttachedPiece.setAttachedTo('roof')
  room.pieces.set(roofAttachedPiece.pieceId, roofAttachedPiece)

  const roofIcing = new IcingState([[0, 1.7, 0], [0.25, 1.72, 0.25]], 0.05, 'roof', null, userId)
  room.icing.set(roofIcing.icingId, roofIcing)

  const result = room.deleteWall(deletedWall.wallId, userId)

  assert.equal(result.success, true)
  assert.ok(result.deletedPieces.includes(wallAttachedPiece.pieceId))
  assert.ok(result.deletedPieces.includes(roofAttachedPiece.pieceId))
  assert.ok(result.deletedRoofPieces.includes(roofAttachedPiece.pieceId))
  assert.ok(result.deletedIcing.includes(roofIcing.icingId))
  assert.ok(result.deletedRoofIcing.includes(roofIcing.icingId))
  assert.equal(room.pieces.has(wallAttachedPiece.pieceId), false)
  assert.equal(room.pieces.has(roofAttachedPiece.pieceId), false)
  assert.equal(room.icing.has(roofIcing.icingId), false)
})

test('deleteWall preserves roof-attached pieces still supported by another roof polygon', () => {
  const { room, userId } = createRoomWithHost()

  const [deletedWall] = createSquareWalls(room, userId, -4, -2, -1, 1)
  createSquareWalls(room, userId, 2, 4, -1, 1)

  const unsupportedRoofPiece = new PieceState('CHIMNEY', userId, [-3, 1.9, 0])
  unsupportedRoofPiece.setAttachedTo('roof')
  room.pieces.set(unsupportedRoofPiece.pieceId, unsupportedRoofPiece)

  const stillSupportedRoofPiece = new PieceState('CHIMNEY', userId, [3, 1.9, 0])
  stillSupportedRoofPiece.setAttachedTo('roof')
  room.pieces.set(stillSupportedRoofPiece.pieceId, stillSupportedRoofPiece)

  const result = room.deleteWall(deletedWall.wallId, userId)

  assert.equal(result.success, true)
  assert.ok(result.deletedRoofPieces.includes(unsupportedRoofPiece.pieceId))
  assert.equal(room.pieces.has(unsupportedRoofPiece.pieceId), false)
  assert.equal(room.pieces.has(stillSupportedRoofPiece.pieceId), true)
})

test('deletePiece cascades pieces attached to deleted parent piece', () => {
  const { room, userId } = createRoomWithHost()

  const parent = new PieceState('WALL_FRONT', userId, [0, 0.75, 0])
  room.pieces.set(parent.pieceId, parent)

  const child = new PieceState('WINDOW_SMALL', userId, [0, 0.85, 0.09])
  child.setAttachedTo(parent.pieceId)
  room.pieces.set(child.pieceId, child)

  const unaffected = new PieceState('PRESENT', userId, [2, 0.11, 2])
  room.pieces.set(unaffected.pieceId, unaffected)

  const result = room.deletePiece(parent.pieceId, userId)

  assert.equal(result.success, true)
  assert.ok(result.deletedAttachedPieces.includes(child.pieceId))
  assert.equal(room.pieces.has(parent.pieceId), false)
  assert.equal(room.pieces.has(child.pieceId), false)
  assert.equal(room.pieces.has(unaffected.pieceId), true)
})

test('createFenceLine creates one fence post per snapped grid node', () => {
  const { room, userId } = createRoomWithHost()

  const result = room.createFenceLine([0, 0], [1, 0], 0.5, userId)

  assert.equal(result.error, undefined)
  assert.equal(result.pieces.length, 3)
  assert.equal(room.pieceCount, 3)

  const positions = result.pieces
    .map((piece) => `${piece.pos[0]},${piece.pos[2]}`)
    .sort()

  assert.deepEqual(positions, ['0,0', '0.5,0', '1,0'])

  for (const piece of result.pieces) {
    assert.equal(piece.type, 'FENCE_POST')
    assert.equal(piece.heldBy, null)
    assert.equal(room.pieces.has(piece.pieceId), true)
  }
})

test('createFenceLine reuses existing fence posts and rejects conflicting occupied cells', () => {
  const { room, userId } = createRoomWithHost()

  const first = room.createFenceLine([0, 0], [0.5, 0], 0.5, userId)
  assert.equal(first.error, undefined)
  assert.equal(first.pieces.length, 2)

  const second = room.createFenceLine([0, 0], [1, 0], 0.5, userId)
  assert.equal(second.error, undefined)
  assert.equal(second.pieces.length, 1)
  assert.equal(room.pieceCount, 3)

  const blockingPiece = new PieceState('PRESENT', userId, [1.5, 0, 0])
  room.pieces.set(blockingPiece.pieceId, blockingPiece)
  room.setOccupancy(blockingPiece)

  const pieceCountBeforeConflict = room.pieceCount
  const conflicting = room.createFenceLine([1, 0], [2, 0], 0.5, userId)

  assert.equal(conflicting.error, 'CELL_OCCUPIED')
  assert.equal(room.pieceCount, pieceCountBeforeConflict)
})

test('createWall rejects invalid coordinates and invalid height', () => {
  const { room, userId } = createRoomWithHost()

  const invalidCoords = room.createWall([0, Number.NaN], [1, 0], 1.5, userId)
  assert.equal(invalidCoords.error, 'INVALID_WALL_DATA')

  const invalidHeight = room.createWall([0, 0], [1, 0], Number.POSITIVE_INFINITY, userId)
  assert.equal(invalidHeight.error, 'INVALID_WALL_DATA')

  const tooTall = room.createWall([0, 0], [1, 0], 99, userId)
  assert.equal(tooTall.error, 'INVALID_WALL_DATA')
})

test('createIcing rejects malformed points, radius, surface type, and surface id', () => {
  const { room, userId } = createRoomWithHost()

  const invalidPoints = room.createIcing([[0, 0, 0], [1, 'x', 0]], 0.05, 'ground', null, userId)
  assert.equal(invalidPoints.error, 'INVALID_ICING_DATA')

  const invalidRadius = room.createIcing([[0, 0, 0], [1, 0, 0]], -1, 'ground', null, userId)
  assert.equal(invalidRadius.error, 'INVALID_ICING_DATA')

  const invalidSurfaceType = room.createIcing([[0, 0, 0], [1, 0, 0]], 0.05, 'ceiling', null, userId)
  assert.equal(invalidSurfaceType.error, 'INVALID_ICING_DATA')

  const invalidSurfaceId = room.createIcing([[0, 0, 0], [1, 0, 0]], 0.05, 'wall', 123, userId)
  assert.equal(invalidSurfaceId.error, 'INVALID_ICING_DATA')
})

test('fromSnapshot restores geometry/chat state while clearing user locks', () => {
  const snapshot = {
    roomId: 'ABC123',
    hostUserId: 'host-1',
    users: [{ userId: 'host-1', name: 'Host', color: '#fff', cursor: { x: 0, y: 0, z: 0, t: Date.now() }, isActive: true }],
    pieces: [{
      pieceId: 'piece-1',
      type: 'PRESENT',
      pos: [1, 0.11, 1],
      yaw: 0,
      heldBy: 'host-1',
      spawnedBy: 'host-1',
      attachedTo: null,
      snapNormal: null,
      version: 1
    }],
    walls: [{
      wallId: 'wall-1',
      start: [0, 0],
      end: [1, 0],
      height: 1.5,
      thickness: 0.15,
      createdBy: 'host-1',
      version: 1
    }],
    icing: [{
      icingId: 'icing-1',
      points: [[0, 1, 0], [0.5, 1, 0]],
      radius: 0.05,
      surfaceType: 'wall',
      surfaceId: 'wall-1',
      createdBy: 'host-1',
      version: 1
    }],
    chatMessages: [{ id: 'msg-1', userId: 'host-1', userName: 'Host', userColor: '#fff', message: 'hello', timestamp: Date.now() }],
    pieceCount: 1,
    maxPieces: 150
  }

  const room = RoomState.fromSnapshot(snapshot)

  assert.equal(room.roomId, 'ABC123')
  assert.equal(room.userCount, 0)
  assert.equal(room.hostUserId, null)
  assert.equal(room.pieceCount, 1)
  assert.equal(room.walls.size, 1)
  assert.equal(room.icing.size, 1)
  assert.equal(room.chatMessages.length, 1)
  assert.equal(room.pieces.get('piece-1').heldBy, null)
})
