export const SERVER_OFFLINE_MESSAGE = 'Server is offline. Start the backend and try again.'

function isFetchConnectionError(error) {
  if (!(error instanceof TypeError)) {
    return false
  }

  return /failed to fetch|networkerror|load failed|fetch/i.test(error.message)
}

export function getCreateRoomErrorMessage(error) {
  if (isFetchConnectionError(error)) {
    return SERVER_OFFLINE_MESSAGE
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Failed to create room'
}
