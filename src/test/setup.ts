import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}))

// Mock next/headers
vi.mock('next/headers', () => {
  const cookieMap = new Map<string, string>()
  return {
    cookies: vi.fn(() => ({
      get: (name: string) => {
        const value = cookieMap.get(name)
        return value ? { name, value } : undefined
      },
      set: (name: string, value: string) => cookieMap.set(name, value),
      delete: (name: string) => cookieMap.delete(name),
      has: (name: string) => cookieMap.has(name),
      getAll: () =>
        Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value })),
    })),
    headers: vi.fn(() => new Headers()),
  }
})

// Helper to create a mock Supabase query builder
export function mockSupabase(data: unknown = null, error: unknown = null) {
  const builder: Record<string, unknown> = {}
  const terminal = () => Promise.resolve({ data, error, count: Array.isArray(data) ? data.length : null })

  const chainMethods = [
    'from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'not', 'is', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'single', 'maybeSingle',
  ]

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }

  builder.single = vi.fn(terminal)
  builder.then = vi.fn((resolve: (v: unknown) => void) => terminal().then(resolve))

  return builder
}
