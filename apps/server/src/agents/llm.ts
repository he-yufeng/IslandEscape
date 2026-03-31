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
  const response = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.8,
    max_tokens: 500,
  })

  const text = response.choices[0]?.message?.content ?? '{}'
  // Extract JSON from response (may have markdown fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn('[llm] No JSON found in response:', text.slice(0, 200))
    return {} as T
  }
  return JSON.parse(jsonMatch[0]) as T
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

  return response.choices[0]?.message?.content ?? ''
}
