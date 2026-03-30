import { randomUUID } from 'node:crypto'

import type { FastifyPluginAsync } from 'fastify'
import {
  AgentRunRequestSchema,
  AgentStreamEventSchema,
  type AgentStreamEvent,
  type GameStateSnapshot,
} from '@game/shared'

import { runTurn } from '../agents/runtime'
import { runs } from '../state'

const defaultSnapshot = (saveId: string): GameStateSnapshot => ({
  saveId,
  turn: 0,
  stats: {},
  inventory: [],
  flags: {},
  updatedAt: new Date().toISOString(),
})

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/runs', async (request, reply) => {
    const parsed = AgentRunRequestSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        message: 'Invalid run request payload',
        details: parsed.error.flatten(),
      })
    }

    const runId = randomUUID()
    runs.set(runId, { id: runId, events: [], done: false })

    const producedEvents = await runTurn(parsed.data, runId)
    const state = runs.get(runId)
    if (state) {
      state.events.push(...producedEvents)
      state.done = true
    }

    return reply.send({ runId })
  })

  fastify.get('/api/runs/:runId/stream', async (request, reply) => {
    const { runId } = request.params as { runId: string }
    const state = runs.get(runId)

    if (!state) {
      return reply.status(404).send({ code: 'RUN_NOT_FOUND', message: 'Run not found' })
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })

    const sourceEvents: AgentStreamEvent[] =
      state.events.length > 0
        ? state.events
        : [
            {
              runId,
              type: 'state_patch',
              ts: new Date().toISOString(),
              payload: defaultSnapshot('default-save'),
            },
          ]

    for (const event of sourceEvents) {
      const parsed = AgentStreamEventSchema.safeParse(event)
      if (!parsed.success) {
        continue
      }
      reply.raw.write(`event: ${event.type}\n`)
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    reply.raw.end()
    return reply
  })
}

export default routes
