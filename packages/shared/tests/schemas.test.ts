import { describe, expect, it } from 'vitest'

import { AgentStreamEventSchema, GameCommandSchema } from '../src/index'

describe('shared schemas', () => {
  it('validates command payload', () => {
    const result = GameCommandSchema.safeParse({
      saveId: 'slot-1',
      turn: 1,
      input: 'look around',
    })

    expect(result.success).toBe(true)
  })

  it('rejects invalid stream event type', () => {
    const result = AgentStreamEventSchema.safeParse({
      runId: 'run-1',
      type: 'unknown',
      ts: new Date().toISOString(),
      payload: {},
    })

    expect(result.success).toBe(false)
  })
})
