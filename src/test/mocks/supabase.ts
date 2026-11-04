import { vi } from 'vitest'

interface MockResponse {
  data: unknown
  error: unknown
  count?: number | null
}

function createChainableBuilder(defaultResponse: MockResponse) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}

  const terminal = vi.fn(() => Promise.resolve(defaultResponse))

  const chainMethods = [
    'from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike',
    'in', 'not', 'is', 'or', 'and', 'filter',
    'order', 'limit', 'range', 'maybeSingle', 'csv',
    'textSearch', 'match', 'contains', 'containedBy',
    'overlaps', 'throwOnError',
  ]

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder)
  }

  builder.single = terminal
  builder.rpc = vi.fn(() => Promise.resolve(defaultResponse))

  return builder
}

export function createMockSupabaseClient(
  defaultData: unknown = null,
  defaultError: unknown = null
) {
  const defaultResponse: MockResponse = {
    data: defaultData,
    error: defaultError,
    count: Array.isArray(defaultData) ? defaultData.length : null,
  }

  const builder = createChainableBuilder(defaultResponse)

  return {
    ...builder,
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: 'test.pdf' }, error: null })),
        download: vi.fn(() => Promise.resolve({ data: new Blob(), error: null })),
        createSignedUrl: vi.fn(() =>
          Promise.resolve({ data: { signedUrl: 'https://example.com/signed' }, error: null })
        ),
        remove: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    },
  }
}

export function mockData<T>(data: T): MockResponse {
  return { data, error: null, count: Array.isArray(data) ? data.length : null }
}

export function mockError(message: string, code = 'PGRST116'): MockResponse {
  return { data: null, error: { message, code } }
}
