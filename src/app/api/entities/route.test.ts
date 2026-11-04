import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from './route'
import { NextRequest } from 'next/server'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'analyst' as const,
  orgId: 'org-1',
  fullName: 'Test User',
}

const mockEntities = [
  {
    id: 'ent-1',
    org_id: 'org-1',
    name: 'Test Corp',
    type: 'company',
    jurisdiction: 'GB',
    registration_number: '12345',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

vi.mock('@/lib/auth/session', () => ({
  getUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function createMockQuery(data: unknown, error: unknown = null, count: number | null = null) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const terminal = { data, error, count }

  const methods = [
    'select', 'eq', 'ilike', 'order', 'range', 'insert', 'single',
  ]

  for (const m of methods) {
    builder[m] = vi.fn(() => builder)
  }

  builder.single = vi.fn(() => Promise.resolve(terminal))

  Object.defineProperty(builder, 'then', {
    value: (resolve: (v: unknown) => void) => Promise.resolve(terminal).then(resolve),
    writable: true,
    enumerable: false,
  })

  return builder
}

function createRequest(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

describe('GET /api/entities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 for unauthenticated request', async () => {
    const { getUser } = await import('@/lib/auth/session')
    vi.mocked(getUser).mockResolvedValue(null)

    const res = await GET(createRequest('/api/entities'))
    expect(res.status).toBe(401)
  })

  it('returns 200 with paginated entities', async () => {
    const { getUser } = await import('@/lib/auth/session')
    vi.mocked(getUser).mockResolvedValue(mockUser)

    const query = createMockQuery(mockEntities, null, 1)
    const mockClient = { from: vi.fn(() => query) }
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const res = await GET(createRequest('/api/entities'))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.entities).toEqual(mockEntities)
    expect(json.data.pagination).toBeDefined()
    expect(json.data.pagination.page).toBe(1)
  })

  it('returns 403 for viewer on POST', async () => {
    const { getUser } = await import('@/lib/auth/session')
    vi.mocked(getUser).mockResolvedValue({ ...mockUser, role: 'viewer' as const })

    const res = await POST(
      createRequest('/api/entities', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', type: 'company' }),
      })
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/entities', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 401 for unauthenticated request', async () => {
    const { getUser } = await import('@/lib/auth/session')
    vi.mocked(getUser).mockResolvedValue(null)

    const res = await POST(
      createRequest('/api/entities', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', type: 'company' }),
      })
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    const { getUser } = await import('@/lib/auth/session')
    vi.mocked(getUser).mockResolvedValue(mockUser)

    const res = await POST(
      createRequest('/api/entities', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
  })

  it('returns 201 for valid entity creation by analyst', async () => {
    const { getUser } = await import('@/lib/auth/session')
    vi.mocked(getUser).mockResolvedValue(mockUser)

    const created = { ...mockEntities[0], id: 'ent-new' }
    const query = createMockQuery(created)
    const mockClient = { from: vi.fn(() => query) }
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue(mockClient as never)

    const res = await POST(
      createRequest('/api/entities', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Corp', type: 'company' }),
      })
    )
    expect(res.status).toBe(201)
  })
})
