import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { registerSocketHandlers } from './socketHandlers.js'
import { roomManager } from '../rooms/RoomManager.js'

after(() => {
  roomManager.stopCleanupTimer()
})

test('registerSocketHandlers is importable by the server runtime', () => {
  assert.equal(typeof registerSocketHandlers, 'function')
})
