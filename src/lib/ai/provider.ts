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

async function tryOllama(
  prompt: string,
  options: CompletionOptions
): Promise<CompletionResult> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
  const model = 'llama3.2'

  const body: Record<string, unknown> = {
    model,
    prompt: options.systemPrompt
      ? `${options.systemPrompt}\n\n${prompt}`
      : prompt,
    stream: false,
    options: {
      num_predict: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
    },
  }

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}`)
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
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.3,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'Unknown error')
    throw new Error(`OpenRouter returned ${res.status}: ${errorText}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]

  return {
    text: choice?.message?.content ?? '',
    provider: 'openrouter',
    tokensUsed: data.usage?.total_tokens ?? 0,
  }
}

function isConnectionRefused(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('econnrefused') ||
      msg.includes('fetch failed') ||
      msg.includes('connect') ||
      msg.includes('timeout') ||
      msg.includes('abort')
    )
  }
  return false
}

export async function generateCompletion(
  prompt: string,
  options: CompletionOptions = {}
): Promise<CompletionResult> {
  try {
    return await tryOllama(prompt, options)
  } catch (ollamaError) {
    if (isConnectionRefused(ollamaError)) {
      return await tryOpenRouter(prompt, options)
    }
    try {
      return await tryOpenRouter(prompt, options)
    } catch {
      throw ollamaError
    }
  }
}
