const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /disregard\s+(all\s+)?prior/gi,
  /you\s+are\s+now/gi,
  /new\s+instructions:/gi,
  /system\s*prompt:/gi,
  /\{\{.*?\}\}/g,
  /<%.*?%>/g,
  /<script[\s>]/gi,
  /javascript:/gi,
  /data:text\/html/gi,
]

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

const MAX_LENGTH = 2000

export function sanitizeForPrompt(input: string): string {
  let sanitized = input.replace(CONTROL_CHARS, '')

  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH)
  }

  return sanitized.trim()
}
