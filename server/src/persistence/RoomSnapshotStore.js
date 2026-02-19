import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_FILE_PATH = path.join(__dirname, '../../data/room-snapshots.json')
const DEFAULT_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000
const SNAPSHOT_INDEX_KEY = 'gingerbread:rooms:index'

function shouldPersistRoom(room) {
  if (!room) return false
  return room.userCount > 0 ||
    room.pieceCount > 0 ||
    room.walls.size > 0 ||
    room.icing.size > 0 ||
    room.chatMessages.length > 0
}

function toPersistedSnapshot(room) {
  const snapshot = room.getSnapshot()
  return {
    ...snapshot,
    hostUserId: null,
    users: []
  }
}

export class RoomSnapshotStore {
  constructor({ redisClient = null, filePath = DEFAULT_FILE_PATH, ttlMs = DEFAULT_SNAPSHOT_TTL_MS } = {}) {
    this.redisClient = redisClient
    this.filePath = filePath
    this.ttlMs = ttlMs
  }

  buildSnapshotMap(rooms) {
    const snapshotsById = new Map()

    for (const [roomId, room] of rooms.entries()) {
      if (!shouldPersistRoom(room)) {
        continue
      }
      snapshotsById.set(roomId, toPersistedSnapshot(room))
    }

    return snapshotsById
  }

  async loadSnapshots() {
    if (this.redisClient) {
      return this.loadSnapshotsFromRedis()
    }

    return this.loadSnapshotsFromFile()
  }

  async saveSnapshots(rooms) {
    if (this.redisClient) {
      await this.saveSnapshotsToRedis(rooms)
      return
    }

    await this.saveSnapshotsToFile(rooms)
  }

  async loadSnapshotsFromRedis() {
    const snapshotsById = new Map()
    const roomIds = await this.redisClient.sMembers(SNAPSHOT_INDEX_KEY)

    for (const roomId of roomIds) {
      const raw = await this.redisClient.get(this.getRedisSnapshotKey(roomId))
      if (!raw) continue

      try {
        const snapshot = JSON.parse(raw)
        if (snapshot?.roomId) {
          snapshotsById.set(snapshot.roomId, snapshot)
        }
      } catch {
        // Ignore malformed snapshot entries
      }
    }

    return snapshotsById
  }

  async saveSnapshotsToRedis(rooms) {
    const snapshotsById = this.buildSnapshotMap(rooms)
    const nextRoomIds = new Set(snapshotsById.keys())
    const existingRoomIds = await this.redisClient.sMembers(SNAPSHOT_INDEX_KEY)

    const multi = this.redisClient.multi()

    for (const roomId of existingRoomIds) {
      if (!nextRoomIds.has(roomId)) {
        multi.del(this.getRedisSnapshotKey(roomId))
      }
    }

    multi.del(SNAPSHOT_INDEX_KEY)

    if (nextRoomIds.size > 0) {
      multi.sAdd(SNAPSHOT_INDEX_KEY, Array.from(nextRoomIds))
    }

    for (const [roomId, snapshot] of snapshotsById.entries()) {
      multi.set(this.getRedisSnapshotKey(roomId), JSON.stringify(snapshot), { PX: this.ttlMs })
    }

    await multi.exec()
  }

  async loadSnapshotsFromFile() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw)
      const snapshotsById = new Map()

      const roomEntries = parsed?.rooms ? Object.entries(parsed.rooms) : []
      for (const [, snapshot] of roomEntries) {
        if (snapshot?.roomId) {
          snapshotsById.set(snapshot.roomId, snapshot)
        }
      }

      return snapshotsById
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return new Map()
      }
      throw error
    }
  }

  async saveSnapshotsToFile(rooms) {
    const snapshotsById = this.buildSnapshotMap(rooms)
    const roomsJson = {}

    for (const [roomId, snapshot] of snapshotsById.entries()) {
      roomsJson[roomId] = snapshot
    }

    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    await fs.writeFile(
      this.filePath,
      JSON.stringify({
        updatedAt: Date.now(),
        rooms: roomsJson
      }, null, 2),
      'utf8'
    )
  }

  getRedisSnapshotKey(roomId) {
    return `gingerbread:room:snapshot:${roomId}`
  }
}
