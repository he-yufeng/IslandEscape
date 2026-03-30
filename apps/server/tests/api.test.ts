import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app'

let app: Awaited<ReturnType<typeof createApp>>

describe('server api', () => {
  beforeAll(async () => {
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates a run and streams events', async () => {
    const runRes = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: {
        command: { saveId: 'slot-1', turn: 1, input: 'go north' },
        sessionId: 'session-1',
      },
    })

    expect(runRes.statusCode).toBe(200)
    const { runId } = runRes.json() as { runId: string }

    const streamRes = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}/stream`,
    })

    expect(streamRes.statusCode).toBe(200)
    expect(streamRes.body).toContain('event: token')
    expect(streamRes.body).toContain('event: completed')
  })

  it('rejects invalid run commands', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: {
        command: { saveId: '', turn: 0, input: '' },
        sessionId: '',
      },
    })

    expect(res.statusCode).toBe(400)
  })
})
