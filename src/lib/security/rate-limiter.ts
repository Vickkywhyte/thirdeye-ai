// In-memory sliding window rate limiter.
// Replace with Redis (e.g. Upstash @upstash/ratelimit) for multi-instance production deployments.

interface WindowEntry {
  timestamps: number[]
  lastCleanup: number
}

const windows = new Map<string, WindowEntry>()

const CLEANUP_INTERVAL = 60_000

export function createRateLimiter(limit: number, windowMs: number) {
  return function checkRateLimit(key: string): {
    allowed: boolean
    remaining: number
    resetAt: number
  } {
    const now = Date.now()
    const windowStart = now - windowMs

    let entry = windows.get(key)
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now }
      windows.set(key, entry)
    }

    if (now - entry.lastCleanup > CLEANUP_INTERVAL) {
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart)
      entry.lastCleanup = now

      for (const [k, v] of windows) {
        if (v.timestamps.length === 0 && now - v.lastCleanup > windowMs * 2) {
          windows.delete(k)
        }
      }
    }

    entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

    if (entry.timestamps.length >= limit) {
      const oldestInWindow = entry.timestamps[0]
      return {
        allowed: false,
        remaining: 0,
        resetAt: oldestInWindow + windowMs,
      }
    }

    entry.timestamps.push(now)

    return {
      allowed: true,
      remaining: limit - entry.timestamps.length,
      resetAt: now + windowMs,
    }
  }
}

export const screeningRateLimiter = createRateLimiter(10, 60_000)
export const aiAnalysisRateLimiter = createRateLimiter(5, 60_000)
