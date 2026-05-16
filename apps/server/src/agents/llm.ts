import OpenAI from 'openai'
import { env } from '../env'

let client: OpenAI | null = null

export function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      baseURL: env.OPENAI_BASE_URL || undefined,
    })
  }
  return client
}

export async function chatJSON<T>(
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const openai = getClient()

  let response: OpenAI.Chat.Completions.ChatCompletion
  try {
    response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    })
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
  const openai = getClient()
  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.9,
    max_tokens: 200,
  })

  return response.choices?.[0]?.message?.content ?? ''
}
