import { describe, expect, it } from 'vitest'

import type { GameState } from '@game/shared'
import {
  buildPreviewDetails,
  buildPreviewPhaseNodes,
  buildPreviewRuleSections,
} from '@/components/interactionPreviewPanel'

const baseState: GameState = {
  gameId: 'game-1',
  day: 4,
  phase: 'player_trade',
  characters: {
    player: {
      id: 'player',
      resources: { fish: 7, wheat: 5, coins: 12 },
      tradeSlots: 2,
      alive: true,
      escaped: false,
    },
    tom: {
      id: 'tom',
      resources: { fish: 8, wheat: 3, coins: 10 },
      tradeSlots: 1,
      alive: true,
      escaped: false,
    },
    sam: {
      id: 'sam',
      resources: { fish: 3, wheat: 9, coins: 16 },
      tradeSlots: 2,
      alive: true,
      escaped: false,
    },
    lily: {
      id: 'lily',
      resources: { fish: 5, wheat: 11, coins: 7 },
      tradeSlots: 2,
      alive: true,
      escaped: false,
    },
    jack: {
      id: 'jack',
      resources: { fish: 2, wheat: 4, coins: 18 },
      tradeSlots: 0,
      alive: false,
      escaped: false,
    },
  },
  friendship: {
    'player:tom': 12,
    'player:sam': 5,
    'lily:player': 22,
    'jack:player': 1,
    'sam:tom': 0,
    'lily:tom': 0,
    'jack:tom': 0,
    'lily:sam': 0,
    'jack:sam': 0,
    'jack:lily': 0,
  },
  merchantPrices: { fishPrice: 5, wheatPrice: 3 },
  pendingHarvests: [
    { characterId: 'player', plantedOnDay: 2, harvestOnDay: 5, amount: 8 },
    { characterId: 'lily', plantedOnDay: 3, harvestOnDay: 6, amount: 8 },
  ],
  log: [],
  eliminatedIds: ['jack'],
  escapedIds: [],
  winnerId: null,
  aiTurnOrder: ['tom', 'sam', 'lily', 'jack'],
  currentAiIndex: 0,
  playerNpcTradedToday: ['sam'],
  dungeonState: null,
  playerDungeonUsedToday: false,
  dailyEvent: 'none',
  updatedAt: '2026-05-24T00:00:00.000Z',
}

describe('interaction preview panel data', () => {
  it('highlights exactly one active phase node', () => {
    const nodes = buildPreviewPhaseNodes('player_trade')
    const active = nodes.filter((node) => node.active)

    expect(nodes).toHaveLength(4)
    expect(active).toHaveLength(1)
    expect(active[0]?.label).toBe('Trade')
  })

  it('merges ai and later phases into resolve', () => {
    const nodes = buildPreviewPhaseNodes('ai_turns')
    const active = nodes.find((node) => node.active)

    expect(active?.label).toBe('Resolve')
  })

  it('includes current market values in the rules popover data', () => {
    const rules = buildPreviewRuleSections(baseState)
    const market = rules.find((section) => section.title === 'Current Market')

    expect(market?.lines).toContain('Fish price: 5 coins.')
    expect(market?.lines).toContain('Wheat price: 3 coins.')
  })

  it('builds detailed npc stats from current state', () => {
    const details = buildPreviewDetails({
      state: baseState,
      phase: 'player_trade',
      interaction: { kind: 'npc', characterId: 'lily', characterName: 'Lily' },
      playerTradeSlots: 2,
      getFriendship: () => 22,
      canTradeWithNpc: () => true,
    })

    expect(details.kindLabel).toBe('Islander')
    expect(details.sections[0]?.stats.some((stat) => stat.label === 'Friendship' && stat.value === '22')).toBe(true)
    expect(details.sections[1]?.stats.some((stat) => stat.label === 'Wheat' && stat.value === '11')).toBe(true)
    expect(details.sections[2]?.stats.some((stat) => stat.label === 'Next Harvest' && stat.value === 'Day 6')).toBe(true)
  })

  it('shows production specifics for farmland', () => {
    const details = buildPreviewDetails({
      state: baseState,
      phase: 'player_labor',
      interaction: { kind: 'farm' },
      playerTradeSlots: 2,
      getFriendship: () => 0,
      canTradeWithNpc: () => false,
    })

    expect(details.title).toBe('Farmland')
    expect(details.sections[0]?.stats.some((stat) => stat.label === 'Output' && stat.value === '+8 wheat')).toBe(true)
    expect(details.sections[0]?.stats.some((stat) => stat.label === 'Next Harvest' && stat.value === 'Day 5')).toBe(true)
  })
})
