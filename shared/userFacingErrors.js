export const SERVER_OFFLINE_MESSAGE = 'Server is offline. Start the backend and try again.'

function isFetchConnectionError(error) {
  if (!(error instanceof TypeError)) {
    return false
  }

  return /failed to fetch|networkerror|load failed|fetch/i.test(error.message)
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return ''
}

export function getCreateRoomErrorMessage(error) {
  if (isFetchConnectionError(error)) {
    return SERVER_OFFLINE_MESSAGE
  }

  const message = getErrorMessage(error)
  if (message) {
    return message
  }

  return 'Failed to create room'
}

export function getJoinRoomErrorMessage(error) {
  if (isFetchConnectionError(error)) {
    return SERVER_OFFLINE_MESSAGE
  }

  const message = getErrorMessage(error)

  switch (message) {
    case 'ROOM_FULL':
      return 'This room is full (6/6 users). Try creating your own room!'
    case 'INVALID_ROOM_CODE':
      return 'Invalid room code. Room codes are 6 characters.'
    case 'ROOM_NOT_FOUND':
      return 'Room not found or expired. Ask the host to create a new one.'
    case 'Connection timeout':
      return 'Could not connect to server. Please check your connection.'
    default:
      return message || 'An unexpected error occurred.'
  }
}
