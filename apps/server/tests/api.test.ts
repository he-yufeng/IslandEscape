import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { GameState } from '@game/shared'

let app: FastifyInstance

interface GameResponse {
  gameId: string
  state: GameState
}

interface StateResponse {
  state: GameState
}

describe('server api', () => {
  beforeAll(async () => {
    process.env.OPENAI_API_KEY ||= 'test-key'
    process.env.OPENAI_MODEL ||= 'deepseek/deepseek-chat'
    process.env.DB_FILE_NAME = `file:${join(tmpdir(), `islandescape-api-${Date.now()}.db`).replace(/\\/g, '/')}`
    process.env.LOG_LEVEL ||= 'silent'

    const { createApp } = await import('../src/app')
    app = await createApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates a game with the current Island Escape state contract', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games',
    })

    expect(res.statusCode).toBe(200)
    const body = res.json<GameResponse>()

    expect(body.gameId).toEqual(expect.any(String))
    expect(body.state.gameId).toBe(body.gameId)
    expect(body.state.phase).toBe('player_labor')
    expect(body.state.characters.player.resources).toMatchObject({
      fish: 5,
      wheat: 5,
      coins: 0,
    })
  })

  it('returns the current game state by id', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
    })
    const { gameId } = created.json<GameResponse>()

    const res = await app.inject({
      method: 'GET',
      url: `/api/games/${gameId}`,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json<StateResponse>().state.gameId).toBe(gameId)
  })

  it('applies a player labor action without invoking AI turns', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
    })
    const { gameId } = created.json<GameResponse>()

    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${gameId}/action`,
      payload: { type: 'fish' },
    })

    expect(res.statusCode).toBe(200)
    const { state } = res.json<StateResponse>()
    expect(state.phase).toBe('player_trade')
    expect(state.characters.player.resources.fish).toBe(8)
  })

  it('rejects invalid player actions', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/games',
    })
    const { gameId } = created.json<GameResponse>()

    const res = await app.inject({
      method: 'POST',
      url: `/api/games/${gameId}/action`,
      payload: { type: 'trade_merchant', sell: { fish: -1, wheat: 0 } },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json<{ code: string }>().code).toBe('INVALID_ACTION')
  })

  it('returns 404 for actions against an unknown game', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/games/missing/action',
      payload: { type: 'fish' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json<{ code: string }>().code).toBe('GAME_NOT_FOUND')
  })
})
