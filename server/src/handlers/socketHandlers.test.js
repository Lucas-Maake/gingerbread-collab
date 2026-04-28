import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerSocketHandlers } from './socketHandlers.js'
import { roomManager } from '../rooms/RoomManager.js'
import { PieceState } from '../rooms/RoomState.js'

after(() => {
  roomManager.stopCleanupTimer()
})

function createSocketHarness(roomId) {
  const handlers = new Map()
  const emitted = []
  const socket = {
    id: `socket-${roomId}`,
    on(event, handler) {
      handlers.set(event, handler)
    },
    to(targetRoomId) {
      return {
        emit(event, payload) {
          emitted.push({ targetRoomId, event, payload })
        }
      }
    },
    join: async () => {}
  }
  const io = {
    to(targetRoomId) {
      return {
        emit(event, payload) {
          emitted.push({ targetRoomId, event, payload })
        }
      }
    }
  }

  registerSocketHandlers(io, socket)

  const createResult = roomManager.createRoom(roomId)
  assert.equal(createResult.error, undefined)

  const joinResult = roomManager.joinRoom(roomId, socket.id, 'Tester')
  assert.equal(joinResult.error, undefined)

  return {
    handlers,
    emitted,
    room: joinResult.room,
    user: joinResult.user,
    cleanup() {
      roomManager.deleteRoom(roomId)
    }
  }
}

test('registerSocketHandlers is importable by the server runtime', () => {
  assert.equal(typeof registerSocketHandlers, 'function')
})

test('release_piece rejects malformed transform payloads without throwing', () => {
  const harness = createSocketHarness('REL001')
  try {
    const piece = harness.room.spawnPiece('PRESENT', harness.user.userId).piece
    let response = null

    assert.doesNotThrow(() => {
      harness.handlers.get('release_piece')({ pieceId: piece.pieceId, yaw: 0 }, (result) => {
        response = result
      })
    })

    assert.deepEqual(response, { error: 'INVALID_RELEASE_DATA' })
    assert.equal(harness.room.pieces.get(piece.pieceId).heldBy, harness.user.userId)
  } finally {
    harness.cleanup()
  }
})

test('undo delete restores cascaded pieces with their original identities and attachments', () => {
  const harness = createSocketHarness('UND001')
  try {
    const parent = new PieceState('WALL_FRONT', harness.user.userId, [0, 0.75, 0])
    parent.yaw = 0.25
    harness.room.pieces.set(parent.pieceId, parent)
    harness.room.setOccupancy(parent)

    const child = new PieceState('WINDOW_SMALL', harness.user.userId, [0, 0.9, 0.09])
    child.yaw = 0.5
    child.setAttachedTo(parent.pieceId)
    child.setSnapNormal([0, 0, 1])
    harness.room.pieces.set(child.pieceId, child)

    let deleteResponse = null
    harness.handlers.get('delete_piece')({ pieceId: parent.pieceId }, (result) => {
      deleteResponse = result
    })

    assert.equal(deleteResponse.success, true)
    assert.equal(harness.room.pieces.has(parent.pieceId), false)
    assert.equal(harness.room.pieces.has(child.pieceId), false)

    let undoResponse = null
    harness.handlers.get('undo')((result) => {
      undoResponse = result
    })

    assert.equal(undoResponse.success, true)

    const restoredParent = harness.room.pieces.get(parent.pieceId)
    const restoredChild = harness.room.pieces.get(child.pieceId)
    assert.ok(restoredParent)
    assert.ok(restoredChild)
    assert.equal(restoredParent.yaw, parent.yaw)
    assert.equal(restoredChild.attachedTo, parent.pieceId)
    assert.deepEqual(restoredChild.snapNormal, [0, 0, 1])
  } finally {
    harness.cleanup()
  }
})
