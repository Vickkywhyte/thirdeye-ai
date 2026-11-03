import { NextResponse } from 'next/server'

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status })
}

export function apiCreated<T>(data: T): NextResponse {
  return NextResponse.json({ data }, { status: 201 })
}

export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function apiError(
  message: string,
  status = 400,
  code = 'BAD_REQUEST',
): NextResponse {
  return NextResponse.json({ error: message, code }, { status })
}

export function apiNotFound(message = 'Resource not found'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'NOT_FOUND' },
    { status: 404 },
  )
}

export function apiUnauthorized(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { status: 401 },
  )
}

export function apiForbidden(message = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'FORBIDDEN' },
    { status: 403 },
  )
}
