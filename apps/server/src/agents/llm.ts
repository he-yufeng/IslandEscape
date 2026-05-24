import { env } from '../env'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string | null
      /**
       * DeepSeek's reasoning models (deepseek-v4-flash, deepseek-r1, …) emit
       * the chain-of-thought in this separate field; `content` only fills in
       * AFTER reasoning completes. If max_tokens is too low we get reasoning
       * with empty content.
       */
      reasoning_content?: string | null
    }
  }>
}

interface ChatRequestOptions {
  temperature: number
  maxTokens: number
  /** Ask the API to enforce JSON output. Falls back gracefully if rejected. */
  jsonMode?: boolean
}

async function createChatCompletion(
  messages: ChatMessage[],
  opts: ChatRequestOptions,
): Promise<ChatCompletionResponse> {
  console.log('\n[llm] === LLM API REQUEST ===')
  console.log(`[llm] Model: ${env.OPENAI_MODEL}`)
  console.log(`[llm] Messages:\n${JSON.stringify(messages, null, 2)}`)

  const baseURL = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const body: Record<string, unknown> = {
    model: env.OPENAI_MODEL,
    messages,
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  }
  if (opts.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    const detail = errBody ? `: ${errBody.slice(0, 300)}` : ''
    // Some providers reject `response_format`. If that's the cause, retry once
    // without JSON mode rather than bubbling the error up.
    if (
      opts.jsonMode &&
      (errBody.toLowerCase().includes('response_format') ||
        errBody.toLowerCase().includes('json_object') ||
        response.status === 400)
    ) {
      console.warn('[llm] Provider rejected json_object response_format; retrying without it.')
      return createChatCompletion(messages, { ...opts, jsonMode: false })
    }
    console.error(`\n[llm] === LLM API ERROR ===\nStatus: ${response.status} ${response.statusText}\nDetails: ${detail}\n`)
    throw new Error(`${response.status} ${response.statusText}${detail}`)
  }

  const jsonResponse = await response.json() as ChatCompletionResponse
  console.log('\n[llm] === LLM API RESPONSE ===')
  console.log(`[llm] Response:\n${JSON.stringify(jsonResponse, null, 2)}\n`)

  return jsonResponse
}

/**
 * Pull a JSON object out of a model response. Handles three common cases:
 *   1. Pure JSON   `{ ... }`
 *   2. Markdown fence  ```json\n{ ... }\n```
 *   3. JSON embedded after preamble text — finds the first `{` and walks the
 *      braces (string-aware) to a balanced match instead of greedy regex.
 */
function extractJsonObject(text: string): string | null {
  // 1. Fenced code block — pick the inner body if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1]!.trim() : text

  // 2. Find first '{' and balance braces, ignoring braces inside strings.
  const start = candidate.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }
  return null
}

export async function chatJSON<T>(
  systemPrompt: string,
  userMessage: string,
): Promise<T> {
  const baseMessages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]

  // Two attempts: first with full prompt + JSON mode, second with stricter
  // re-prompt if the first response can't be parsed. Burning one extra
  // round-trip beats falling back to an empty `{}` and breaking AI decisions.
  //
  // 8000 baseline because DeepSeek-V4 / R1 reasoning models can burn 3-5K
  // tokens just on `reasoning_content` before the final answer starts.
  // Non-reasoning models cap themselves earlier so this isn't wasted there.
  const baseMaxTokens = 8000
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: ChatCompletionResponse
    try {
      const messages: ChatMessage[] = attempt === 0
        ? baseMessages
        : [
            ...baseMessages,
            {
              role: 'user',
              content:
                'Your previous response could not be parsed (likely truncated or malformed). Reply ONLY with a single valid JSON object that matches the schema in the system prompt. Keep every "reasoning" field to a single short sentence. No prose before or after the JSON, no markdown fences.',
            },
          ]

      response = await createChatCompletion(messages, {
        // Bump max_tokens on retry in case the first response was clipped.
        temperature: attempt === 0 ? 0.8 : 0.5,
        maxTokens: attempt === 0 ? baseMaxTokens : Math.floor(baseMaxTokens * 1.5),
        jsonMode: true,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[llm] API call failed:', message)
      throw err
    }

    const choice = response.choices?.[0]
    const text = choice?.message?.content ?? ''
    const reasoningText = choice?.message?.reasoning_content ?? ''
    const finishReason = choice?.finish_reason

    if (!text) {
      if (reasoningText) {
        console.warn(
          `[llm] Empty content but reasoning_content present (attempt ${attempt + 1}, finish=${finishReason ?? 'unknown'}). ` +
          `This is a REASONING model (e.g. deepseek-v4-flash, deepseek-r1) that ran out of tokens before emitting the final answer. ` +
          `Either raise OPENAI_MODEL maxTokens further, or switch to a non-reasoning model like 'deepseek/deepseek-chat'. ` +
          `Reasoning preview: ${reasoningText.slice(0, 200)}`,
        )
      } else {
        console.warn(`[llm] Empty content (attempt ${attempt + 1}). Full response:`, JSON.stringify(response).slice(0, 300))
      }
      continue
    }

    const candidate = extractJsonObject(text)
    if (!candidate) {
      // Distinguish truncation (response runs out mid-object) from junk so
      // the cause shows up in logs.
      const looksTruncated = text.trimStart().startsWith('{') && !text.trimEnd().endsWith('}')
      console.warn(
        `[llm] No JSON found in response (attempt ${attempt + 1}, ${looksTruncated ? 'looks truncated' : 'no object found'}, finish=${finishReason ?? 'unknown'}):`,
        text.slice(0, 300),
      )
      continue
    }

    try {
      return JSON.parse(candidate) as T
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[llm] JSON.parse failed (attempt ${attempt + 1}): ${message}\nRaw:`, candidate.slice(0, 300))
      continue
    }
  }

  console.warn('[llm] Falling back to empty object after 2 attempts.')
  return {} as T
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
    {
      temperature: 0.9,
      maxTokens: 200,
    },
  )

  return response.choices?.[0]?.message?.content ?? ''
}
