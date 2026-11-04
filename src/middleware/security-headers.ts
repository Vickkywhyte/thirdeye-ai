import { NextResponse } from 'next/server'

export function withSecurityHeaders(
  response: NextResponse,
  startTime?: number
): NextResponse {
  response.headers.set('X-Request-ID', crypto.randomUUID())

  if (startTime) {
    const elapsed = Date.now() - startTime
    response.headers.set('X-Response-Time', `${elapsed}ms`)
  }

  if (!response.headers.has('Content-Security-Policy')) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.in"
    )
  }

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}
