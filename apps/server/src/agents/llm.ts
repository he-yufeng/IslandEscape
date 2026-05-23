import { env } from '../env'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
}

async function createChatCompletion(
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ChatCompletionResponse> {
  const baseURL = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const detail = body ? `: ${body.slice(0, 300)}` : ''
    throw new Error(`${response.status} ${response.statusText}${detail}`)
  }

  return response.json() as Promise<ChatCompletionResponse>
}

export async function chatJSON<T>(
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  let response: ChatCompletionResponse
  try {
    response = await createChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      0.8,
      1500,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[llm] API call failed:', message)
    throw err
  }

  if (!response.choices || response.choices.length === 0) {
    console.warn('[llm] Response has no choices. Full response:', JSON.stringify(response).slice(0, 300))
    return {} as T
  }

  const text = response.choices[0]?.message?.content ?? '{}'
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn('[llm] No JSON found in response:', text.slice(0, 200))
    return {} as T
  }

  try {
    return JSON.parse(jsonMatch[0]) as T
  } catch (err) {
    console.warn('[llm] JSON parse failed, raw:', jsonMatch[0].slice(0, 200))
    return {} as T
  }
}

export async function chatText(
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const response = await createChatCompletion(
    [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    0.9,
    200,
  )

  return response.choices?.[0]?.message?.content ?? ''
}
