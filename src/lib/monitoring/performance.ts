import { createLogger } from './logger'

const logger = createLogger('performance')

export interface TimerResult {
  durationMs: number
}

export function createTimer(): { stop: () => TimerResult } {
  const start = performance.now()
  return {
    stop() {
      const durationMs = Math.round(performance.now() - start)
      return { durationMs }
    },
  }
}

export async function measureAsync<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = createTimer()
  try {
    const result = await fn()
    const { durationMs } = timer.stop()
    logger.info(`${label} completed`, { durationMs })
    return result
  } catch (error) {
    const { durationMs } = timer.stop()
    logger.error(`${label} failed`, {
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
