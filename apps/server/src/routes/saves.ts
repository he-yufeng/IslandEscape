import type { FastifyPluginAsync } from 'fastify'
import { eq } from 'drizzle-orm'
import {
  GameStateSnapshotSchema,
  SaveSlotSummarySchema,
  type GameStateSnapshot,
} from '@game/shared'

import { db } from '../db/client'
import { saves } from '../db/schema'
import { toSaveSummary } from '../state'

type SaveRow = {
  id: string
  label: string
  turn: number
  snapshot: GameStateSnapshot
  updatedAt: string
}

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/saves', async () => {
    const rows = await db.select().from(saves)

    return rows
      .map((row) =>
        toSaveSummary({
          id: row.id,
          label: row.label,
          turn: row.turn,
          updatedAt: row.updatedAt,
        }),
      )
      .map((item) => SaveSlotSummarySchema.parse(item))
  })

  fastify.post('/api/saves', async (request, reply) => {
    const body = request.body as Partial<{ id: string; label: string; snapshot: GameStateSnapshot }>
    const snapshot = GameStateSnapshotSchema.safeParse(body.snapshot)

    if (!body.id || !body.label || !snapshot.success) {
      return reply.status(400).send({
        code: 'INVALID_SAVE',
        message: 'Invalid save payload',
      })
    }

    const updatedAt = new Date().toISOString()
    await db
      .insert(saves)
      .values({
        id: body.id,
        label: body.label,
        turn: snapshot.data.turn,
        snapshot: snapshot.data,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: saves.id,
        set: {
          label: body.label,
          turn: snapshot.data.turn,
          snapshot: snapshot.data,
          updatedAt,
        },
      })

    return reply.status(201).send({ id: body.id })
  })

  fastify.get('/api/saves/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await db.query.saves.findFirst({ where: eq(saves.id, id) })

    if (!row) {
      return reply.status(404).send({ code: 'SAVE_NOT_FOUND', message: 'Save not found' })
    }

    return row
  })

  fastify.post('/api/saves/:id/load', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = await db.query.saves.findFirst({ where: eq(saves.id, id) }) as SaveRow | undefined

    if (!row) {
      return reply.status(404).send({ code: 'SAVE_NOT_FOUND', message: 'Save not found' })
    }

    return reply.send({
      id: row.id,
      label: row.label,
      snapshot: GameStateSnapshotSchema.parse(row.snapshot),
    })
  })
}

export default routes
