import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getCreateRoomErrorMessage,
  getJoinRoomErrorMessage,
} from './userFacingErrors.js'

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

test('getJoinRoomErrorMessage explains backend connection failures', () => {
  assert.equal(
    getJoinRoomErrorMessage(new TypeError('Failed to fetch')),
    'Server is offline. Start the backend and try again.'
  )
})

test('getJoinRoomErrorMessage maps known room join failures', () => {
  assert.equal(
    getJoinRoomErrorMessage(new Error('ROOM_NOT_FOUND')),
    'Room not found or expired. Ask the host to create a new one.'
  )
  assert.equal(
    getJoinRoomErrorMessage('Connection timeout'),
    'Could not connect to server. Please check your connection.'
  )
})
