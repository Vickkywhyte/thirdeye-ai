import { z } from 'zod'

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OLLAMA_BASE_URL: z.url().optional().default('http://localhost:11434'),
  OPENROUTER_API_KEY: z.string().optional(),
  COMPANIES_HOUSE_API_KEY: z.string().optional(),
  NEWSAPI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.url().optional().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  FEATURE_AI_ANALYSIS: z.string().optional().default('true'),
  FEATURE_PDF_EXPORT: z.string().optional().default('true'),
  FEATURE_OWNERSHIP_GRAPH: z.string().optional().default('true'),
  FEATURE_ADVERSE_MEDIA: z.string().optional().default('true'),
})

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().optional().default('http://localhost:3000'),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type PublicEnv = z.infer<typeof publicSchema>

let cachedServerEnv: ServerEnv | null = null
let cachedPublicEnv: PublicEnv | null = null

export function getEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid server environment variables: ${missing}`)
  }
  cachedServerEnv = parsed.data
  return cachedServerEnv
}

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv
  const parsed = publicSchema.safeParse(process.env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid public environment variables: ${missing}`)
  }
  cachedPublicEnv = parsed.data
  return cachedPublicEnv
}
