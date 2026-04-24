import assert from 'node:assert/strict'
import test from 'node:test'

import { getCreateRoomErrorMessage } from './userFacingErrors.js'

test('getCreateRoomErrorMessage explains backend connection failures', () => {
  assert.equal(
    getCreateRoomErrorMessage(new TypeError('Failed to fetch')),
    'Server is offline. Start the backend and try again.'
  )
})

test('getCreateRoomErrorMessage preserves known create-room errors', () => {
  assert.equal(
    getCreateRoomErrorMessage(new Error('Room limit reached')),
    'Room limit reached'
  )
})

test('getCreateRoomErrorMessage falls back for unknown errors', () => {
  assert.equal(
    getCreateRoomErrorMessage(null),
    'Failed to create room'
  )
})
