import { describe, expect, it } from 'vitest'

import {
  GAME_CONFIG,
  GameSSEEventSchema,
  GameStateSchema,
  PlayerActionSchema,
  friendshipKey,
  type CharacterId,
  type CharacterState,
  type GameState,
} from '../src/index'

const now = '2026-01-01T00:00:00.000Z'

function makeCharacter(id: CharacterId): CharacterState {
  return {
    id,
    resources: {
      fish: GAME_CONFIG.STARTING_FISH,
      wheat: GAME_CONFIG.STARTING_WHEAT,
      coins: GAME_CONFIG.STARTING_COINS,
    },
    tradeSlots: GAME_CONFIG.TRADE_SLOTS_PER_DAY,
    alive: true,
    escaped: false,
  }
}

function makeGameState(): GameState {
  return {
    gameId: 'game-1',
    day: 1,
    phase: 'player_labor',
    characters: {
      player: makeCharacter('player'),
      tom: makeCharacter('tom'),
      sam: makeCharacter('sam'),
      lily: makeCharacter('lily'),
      jack: makeCharacter('jack'),
    },
    friendship: {
      [friendshipKey('player', 'tom')]: 0,
    },
    merchantPrices: {
      fishPrice: 3,
      wheatPrice: 2,
    },
    pendingHarvests: [],
    log: [],
    eliminatedIds: [],
    escapedIds: [],
    winnerId: null,
    aiTurnOrder: ['tom', 'sam', 'lily', 'jack'],
    currentAiIndex: 0,
    playerNpcTradedToday: [],
    updatedAt: now,
  }
}

describe('shared schemas', () => {
  it('validates player actions for the current game API', () => {
    expect(PlayerActionSchema.safeParse({ type: 'fish' }).success).toBe(true)
    expect(PlayerActionSchema.safeParse({ type: 'farm' }).success).toBe(true)
    expect(PlayerActionSchema.safeParse({
      type: 'trade_merchant',
      sell: { fish: 1, wheat: 0 },
    }).success).toBe(true)
  })

  it('rejects invalid player action payloads', () => {
    const result = PlayerActionSchema.safeParse({
      type: 'trade_merchant',
      sell: { fish: -1, wheat: 0 },
    })

    expect(result.success).toBe(false)
  })

  it('validates the game state and SSE state update contract', () => {
    const state = makeGameState()

    expect(GameStateSchema.safeParse(state).success).toBe(true)
    expect(GameSSEEventSchema.safeParse({
      type: 'state_update',
      state,
    }).success).toBe(true)
  })

  it('rejects invalid stream event type', () => {
    const result = GameSSEEventSchema.safeParse({
      type: 'unknown',
    })

    expect(result.success).toBe(false)
  })

  it('normalizes friendship keys regardless of argument order', () => {
    expect(friendshipKey('tom', 'player')).toBe('player:tom')
  })
})
