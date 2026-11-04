export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  context: string
  timestamp: string
  [key: string]: unknown
}

const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL as LogLevel | undefined
  return env && env in LOG_PRIORITY ? env : 'info'
}

function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITY[level] >= LOG_PRIORITY[getMinLevel()]
}

function emit(entry: LogEntry): void {
  const json = JSON.stringify(entry)
  if (entry.level === 'error') {
    console.error(json)
  } else if (entry.level === 'warn') {
    console.warn(json)
  } else {
    console.log(json)
  }
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export function createLogger(context: string): Logger {
  function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!shouldLog(level)) return
    emit({
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      ...meta,
    })
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  }
}
