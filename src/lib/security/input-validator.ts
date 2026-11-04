const SQL_PATTERNS = /\b(DROP|INSERT|UPDATE|DELETE|UNION|SELECT)\b/gi
const SQL_CHARS = /--|;/g
const XSS_PATTERNS = /<script[\s>]|javascript:|on\w+\s*=/gi

export function validateSearchInput(input: string): string {
  let cleaned = input
    .replace(SQL_PATTERNS, '')
    .replace(SQL_CHARS, '')
    .replace(XSS_PATTERNS, '')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validateUUID(id: string): void {
  if (!UUID_V4_REGEX.test(id)) {
    throw Object.assign(new Error(`Invalid ID format: ${id}`), {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    })
  }
}

export function validatePagination(
  page: unknown,
  limit: unknown
): { page: number; limit: number; offset: number } {
  const p = Math.max(1, Math.floor(Number(page) || 1))
  const l = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)))
  return { page: p, limit: l, offset: (p - 1) * l }
}
