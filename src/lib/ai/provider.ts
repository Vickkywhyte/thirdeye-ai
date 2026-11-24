import { createLogger } from '@/lib/monitoring/logger'
import { measureAsync } from '@/lib/monitoring/performance'

const logger = createLogger('ai-provider')

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
// Model names are env-configurable: hardcoding them caused a silent 404 when
// the installed Ollama model didn't match, and when an OpenRouter free-tier
// slug was retired upstream.
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3'
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.2-3b-instruct'

export interface CompletionOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface CompletionResult {
  text: string
  provider: 'ollama' | 'openrouter'
  tokensUsed: number
}

/** Thrown when every configured AI provider fails. Carries an actionable message. */
export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly ollamaError: string,
    public readonly openRouterError: string
  ) {
    super(message)
    this.name = 'AiProviderError'
  }
}

async function tryOllama(
  prompt: string,
  options: CompletionOptions
): Promise<CompletionResult> {
  const body: Record<string, unknown> = {
    model: OLLAMA_MODEL,
    prompt: options.systemPrompt
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt,
    stream: false,
    options: {
      num_predict: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
    },
  }

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    // Surface the body: Ollama reports "model 'x' not found" here, which is
    // far more useful than the bare status code.
    const detail = await res.text().catch(() => '')
    throw new Error(
      `Ollama returned ${res.status}${detail ? `: ${detail.trim()}` : ''}`
    )
  }

  const data = await res.json()

  return {
    text: data.response ?? '',
    provider: 'ollama',
    tokensUsed: (data.eval_count ?? 0) + (data.prompt_eval_count ?? 0),
  }
}

async function tryOpenRouter(
  prompt: string,
  options: CompletionOptions
): Promise<CompletionResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  const messages: Array<{ role: string; content: string }> = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content: prompt })

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    throw new Error(`OpenRouter returned ${res.status}: ${errorText.trim()}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]

  return {
    text: choice?.message?.content ?? '',
    provider: 'openrouter',
    tokensUsed: data.usage?.total_tokens ?? 0,
  }
}

function looksLikeConnectionFailure(message: string): boolean {
  const msg = message.toLowerCase()
  return (
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('abort')
  )
}

function describeFailure(
  ollamaError: string,
  openRouterError: string
): string {
  const ollamaPart = looksLikeConnectionFailure(ollamaError)
    ? `Ollama is not reachable at ${OLLAMA_BASE_URL} — is it running?`
    : `Ollama model "${OLLAMA_MODEL}" failed (${ollamaError})`

  return `AI analysis unavailable. ${ollamaPart} OpenRouter fallback model "${OPENROUTER_MODEL}" also failed: ${openRouterError}`
}

export async function generateCompletion(
  prompt: string,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  return measureAsync('ai.generateCompletion', async () => {
    let ollamaError: string

    try {
      logger.info('Attempting Ollama completion', { model: OLLAMA_MODEL })
      const result = await tryOllama(prompt, options)
      logger.info('Ollama completion succeeded', {
        provider: result.provider,
        tokensUsed: result.tokensUsed,
      })
      return result
    } catch (err) {
      ollamaError = err instanceof Error ? err.message : String(err)
      logger.warn('Ollama failed, falling back to OpenRouter', {
        error: ollamaError,
      })
    }

    try {
      logger.info('Attempting OpenRouter completion', {
        model: OPENROUTER_MODEL,
      })
      const result = await tryOpenRouter(prompt, options)
      logger.info('OpenRouter completion succeeded', {
        provider: result.provider,
        tokensUsed: result.tokensUsed,
      })
      return result
    } catch (err) {
      const openRouterError = err instanceof Error ? err.message : String(err)
      logger.error('All AI providers failed', {
        ollamaError,
        openRouterError,
      })
      throw new AiProviderError(
        describeFailure(ollamaError, openRouterError),
        ollamaError,
        openRouterError
      )
    }
  })
}
