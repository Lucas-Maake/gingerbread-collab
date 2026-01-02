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
    // Map<socketId, { cursor: TokenBucket, transform: TokenBucket }>
    this.buckets = new Map()
  }

  /**
   * Initialize buckets for a new connection
   */
  addConnection(socketId, config) {
    this.buckets.set(socketId, {
      cursor: new TokenBucket(
        config.cursor.TOKENS_PER_SECOND,
        config.cursor.BURST_CAPACITY
      ),
      transform: new TokenBucket(
        config.transform.TOKENS_PER_SECOND,
        config.transform.BURST_CAPACITY
      )
    })
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
    const bucket = this.buckets.get(socketId)
    if (!bucket) return false
    return bucket.cursor.consume()
  }

  /**
   * Check if transform update is allowed
   */
  allowTransformUpdate(socketId) {
    const bucket = this.buckets.get(socketId)
    if (!bucket) return false
    return bucket.transform.consume()
  }

  /**
   * Get rate limit status for debugging
   */
  getStatus(socketId) {
    const bucket = this.buckets.get(socketId)
    if (!bucket) return null
    return {
      cursorTokens: bucket.cursor.getTokens(),
      transformTokens: bucket.transform.getTokens()
    }
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
