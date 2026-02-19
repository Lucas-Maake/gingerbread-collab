/**
 * TokenBucket - Rate limiter using token bucket algorithm
 *
 * Tokens are added at a fixed rate up to a maximum capacity.
 * Each operation consumes one token. If no tokens available, operation is rejected.
 */
export class TokenBucket {
  constructor(tokensPerSecond, burstCapacity) {
    this.tokensPerSecond = tokensPerSecond
    this.burstCapacity = burstCapacity
    this.tokens = burstCapacity
    this.lastRefill = Date.now()
  }

  /**
   * Refill tokens based on elapsed time
   */
  refill() {
    const now = Date.now()
    const elapsed = (now - this.lastRefill) / 1000 // seconds
    const tokensToAdd = elapsed * this.tokensPerSecond

    this.tokens = Math.min(this.burstCapacity, this.tokens + tokensToAdd)
    this.lastRefill = now
  }

  /**
   * Try to consume a token
   * @returns {boolean} true if token consumed, false if rate limited
   */
  consume() {
    this.refill()

    if (this.tokens >= 1) {
      this.tokens -= 1
      return true
    }

    return false
  }

  /**
   * Check if a token is available without consuming
   * @returns {boolean}
   */
  canConsume() {
    this.refill()
    return this.tokens >= 1
  }

  /**
   * Get current token count
   * @returns {number}
   */
  getTokens() {
    this.refill()
    return this.tokens
  }
}

/**
 * RateLimiter - Manages multiple token buckets per connection
 */
export class RateLimiter {
  constructor() {
    // Map<socketId, Record<string, TokenBucket>>
    this.buckets = new Map()
  }

  /**
   * Initialize buckets for a new connection
   */
  addConnection(socketId, config) {
    const eventBuckets = {}

    for (const [eventKey, eventConfig] of Object.entries(config || {})) {
      if (!eventConfig ||
        !Number.isFinite(eventConfig.TOKENS_PER_SECOND) ||
        !Number.isFinite(eventConfig.BURST_CAPACITY)) {
        continue
      }

      eventBuckets[eventKey] = new TokenBucket(
        eventConfig.TOKENS_PER_SECOND,
        eventConfig.BURST_CAPACITY
      )
    }

    this.buckets.set(socketId, eventBuckets)
  }

  /**
   * Remove buckets for a disconnected connection
   */
  removeConnection(socketId) {
    this.buckets.delete(socketId)
  }

  /**
   * Check if cursor update is allowed
   */
  allowCursorUpdate(socketId) {
    return this.allow(socketId, 'cursor')
  }

  /**
   * Check if transform update is allowed
   */
  allowTransformUpdate(socketId) {
    return this.allow(socketId, 'transform')
  }

  /**
   * Check if a named event is allowed
   */
  allow(socketId, eventKey) {
    const connectionBuckets = this.buckets.get(socketId)
    if (!connectionBuckets) return false

    const bucket = connectionBuckets[eventKey]
    if (!bucket) {
      return true
    }

    return bucket.consume()
  }

  /**
   * Get rate limit status for debugging
   */
  getStatus(socketId) {
    const connectionBuckets = this.buckets.get(socketId)
    if (!connectionBuckets) return null

    const status = {}
    for (const [eventKey, bucket] of Object.entries(connectionBuckets)) {
      status[`${eventKey}Tokens`] = bucket.getTokens()
    }

    return status
  }
}

/**
 * BroadcastThrottler - Limits how often a piece's transform is broadcast
 */
export class BroadcastThrottler {
  constructor(maxHz = 20) {
    this.minInterval = 1000 / maxHz // milliseconds between broadcasts
    this.lastBroadcast = new Map() // Map<pieceId, timestamp>
  }

  /**
   * Check if a broadcast is allowed for this piece
   */
  canBroadcast(pieceId) {
    const now = Date.now()
    const lastTime = this.lastBroadcast.get(pieceId) || 0

    if (now - lastTime >= this.minInterval) {
      this.lastBroadcast.set(pieceId, now)
      return true
    }

    return false
  }

  /**
   * Force a broadcast (for important events like release)
   */
  forceBroadcast(pieceId) {
    this.lastBroadcast.set(pieceId, Date.now())
  }

  /**
   * Clean up old entries
   */
  cleanup(activePieceIds) {
    for (const pieceId of this.lastBroadcast.keys()) {
      if (!activePieceIds.has(pieceId)) {
        this.lastBroadcast.delete(pieceId)
      }
    }
  }
}
