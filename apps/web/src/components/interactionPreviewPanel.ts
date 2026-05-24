import { GAME_CONFIG, type CharacterId, type CharacterState, type DayPhase, type GameState } from '@game/shared'

import type { InteractionType } from '@/game/GameWorld'
import { CHARACTER_META } from '@/stores/game'
import { getInteractionPreviewMeta } from '@/render3d/interactionPreviewMeta'

export type PreviewPhaseNodeId = 'dawn' | 'labor' | 'trade' | 'resolve'

export interface PreviewPhaseNode {
  id: PreviewPhaseNodeId
  label: string
  summary: string
  details: string[]
  active: boolean
}

export interface PreviewRuleSection {
  title: string
  lines: string[]
}

export interface PreviewStat {
  label: string
  value: string
  tone?: 'neutral' | 'accent' | 'good' | 'warn'
}

export interface PreviewSection {
  title: string
  note?: string
  stats: PreviewStat[]
}

export interface PreviewDetails {
  kindLabel: string
  title: string
  subtitle: string
  sections: PreviewSection[]
}

interface PreviewPanelContext {
  state: GameState | null
  phase: DayPhase
  interaction: InteractionType
  playerTradeSlots: number
  getFriendship: (charId: CharacterId) => number
  canTradeWithNpc: (charId: CharacterId) => boolean
}

const PHASE_FLOW: Array<{
  id: PreviewPhaseNodeId
  label: string
  summary: string
  details: string[]
  phaseIds: DayPhase[]
}> = [
  {
    id: 'dawn',
    label: 'Dawn',
    summary: 'Prices and harvests refresh.',
    details: [
      'Merchant prices roll for the new day.',
      'Queued wheat harvests resolve here.',
      `Everyone resets to ${GAME_CONFIG.TRADE_SLOTS_PER_DAY} trade slots.`,
    ],
    phaseIds: ['day_start'],
  },
  {
    id: 'labor',
    label: 'Labor',
    summary: 'Spend the mandatory gather action.',
    details: [
      `Fishing grants +${GAME_CONFIG.FISH_PER_LABOR} fish immediately.`,
      `Farming queues +${GAME_CONFIG.WHEAT_PER_HARVEST} wheat after ${GAME_CONFIG.HARVEST_DELAY_DAYS} days.`,
      'You must finish labor before trading opens.',
    ],
    phaseIds: ['player_labor'],
  },
  {
    id: 'trade',
    label: 'Trade',
    summary: 'Convert resources into deals or coins.',
    details: [
      `Use up to ${GAME_CONFIG.TRADE_SLOTS_PER_DAY} trade slots.`,
      'Sell to the ship or negotiate with one nearby islander.',
      'End the turn once your deals are done.',
    ],
    phaseIds: ['player_trade'],
  },
  {
    id: 'resolve',
    label: 'Resolve',
    summary: 'AI, upkeep, and rollover happen here.',
    details: [
      'Island AI takes its labor and trade turns.',
      `Night upkeep consumes ${GAME_CONFIG.DAILY_FISH_COST} fish and ${GAME_CONFIG.DAILY_WHEAT_COST} wheat.`,
      'The day either advances to the next dawn or ends the run.',
    ],
    phaseIds: ['ai_turns', 'settlement', 'day_end', 'game_over'],
  },
]

const PHASE_OBJECTIVES: Record<DayPhase, string> = {
  day_start: 'Wait for the new day to finish setting prices and harvesting queued wheat.',
  player_labor: 'Reach a fishing spot or farmland and spend your mandatory labor action.',
  player_trade: 'Trade with the ship or one nearby islander before ending the turn.',
  ai_turns: 'Observe AI labor and trades. Player input is paused until they finish.',
  settlement: 'Night upkeep resolves: everyone spends 1 fish and 1 wheat.',
  day_end: 'Daily cleanup is finishing before the next dawn begins.',
  game_over: 'The run has ended. Review the outcome or start over.',
}

export function buildPreviewPhaseNodes(currentPhase: DayPhase): PreviewPhaseNode[] {
  return PHASE_FLOW.map((phase) => ({
    id: phase.id,
    label: phase.label,
    summary: phase.summary,
    details: phase.details,
    active: phase.phaseIds.includes(currentPhase),
  }))
}

export function buildPreviewRuleSections(state: GameState | null): PreviewRuleSection[] {
  return [
    {
      title: 'Win Condition',
      lines: [
        `Reach ${GAME_CONFIG.WIN_COINS} coins and board the ship before anyone else.`,
        `Current day: ${state?.day ?? 1}.`,
      ],
    },
    {
      title: 'Daily Loop',
      lines: [
        `Labor first: fish +${GAME_CONFIG.FISH_PER_LABOR} instantly or plant +${GAME_CONFIG.WHEAT_PER_HARVEST} wheat.`,
        `Then spend up to ${GAME_CONFIG.TRADE_SLOTS_PER_DAY} trade slots with NPCs or the merchant ship.`,
      ],
    },
    {
      title: 'Survival',
      lines: [
        `Every night costs ${GAME_CONFIG.DAILY_FISH_COST} fish and ${GAME_CONFIG.DAILY_WHEAT_COST} wheat.`,
        `If either resource hits 0 during settlement, that character is eliminated.`,
      ],
    },
    {
      title: 'Current Market',
      lines: [
        `Fish price: ${state?.merchantPrices.fishPrice ?? 3} coins.`,
        `Wheat price: ${state?.merchantPrices.wheatPrice ?? 2} coins.`,
      ],
    },
  ]
}

export function buildPreviewDetails(context: PreviewPanelContext): PreviewDetails {
  const meta = getInteractionPreviewMeta(context.interaction)
  const player = context.state?.characters.player ?? null

  if (!context.interaction) {
    return {
      kindLabel: 'Survey',
      title: meta.title,
      subtitle: meta.subtitle,
      sections: [
        {
          title: 'Current Objective',
          note: PHASE_OBJECTIVES[context.phase],
          stats: [
            { label: 'Phase', value: getPhaseLabel(context.phase), tone: 'accent' },
            { label: 'Trade Slots', value: String(context.playerTradeSlots) },
            { label: 'Coins to Escape', value: formatCoinsToEscape(player), tone: 'good' },
          ],
        },
        {
          title: 'Supplies',
          stats: buildResourceStats(player),
        },
      ],
    }
  }

  switch (context.interaction.kind) {
    case 'fish':
      return {
        kindLabel: 'Resource Node',
        title: meta.title,
        subtitle: meta.subtitle,
        sections: [
          {
            title: 'Yield',
            note: 'Fishing is the immediate labor option. It does not create a delayed queue.',
            stats: [
              {
                label: 'Phase Gate',
                value: context.phase === 'player_labor' ? 'Available now' : 'Labor already spent',
                tone: context.phase === 'player_labor' ? 'good' : 'warn',
              },
              { label: 'Output', value: `+${GAME_CONFIG.FISH_PER_LABOR} fish instantly`, tone: 'good' },
              { label: 'Action Cost', value: 'Uses today\'s labor action' },
              { label: 'Night Upkeep', value: `${GAME_CONFIG.DAILY_FISH_COST} fish + ${GAME_CONFIG.DAILY_WHEAT_COST} wheat`, tone: 'accent' },
            ],
          },
          {
            title: 'Your Supplies',
            stats: buildResourceStats(player),
          },
          ...buildFutureInteractionSections(context.interaction, context.state),
        ],
      }

    case 'farm': {
      const harvests = getHarvestSummary(context.state, 'player')
      return {
        kindLabel: 'Production Node',
        title: meta.title,
        subtitle: meta.subtitle,
        sections: [
          {
            title: 'Yield',
            note: 'Farming delays the payoff, but the wheat burst is larger than fishing.',
            stats: [
              {
                label: 'Phase Gate',
                value: context.phase === 'player_labor' ? 'Available now' : 'Labor already spent',
                tone: context.phase === 'player_labor' ? 'good' : 'warn',
              },
              { label: 'Output', value: `+${GAME_CONFIG.WHEAT_PER_HARVEST} wheat`, tone: 'good' },
              { label: 'Harvest Delay', value: `${GAME_CONFIG.HARVEST_DELAY_DAYS} days` },
              { label: 'Queued Fields', value: String(harvests.count) },
              { label: 'Next Harvest', value: harvests.nextHarvestDay },
            ],
          },
          {
            title: 'Your Supplies',
            stats: buildResourceStats(player),
          },
          ...buildFutureInteractionSections(context.interaction, context.state),
        ],
      }
    }

    case 'merchant': {
      const prices = context.state?.merchantPrices
      const playerFish = player?.resources.fish ?? 0
      const playerWheat = player?.resources.wheat ?? 0
      const projectedCoins = prices
        ? playerFish * prices.fishPrice + playerWheat * prices.wheatPrice
        : 0

      return {
        kindLabel: 'Trader',
        title: meta.title,
        subtitle: meta.subtitle,
        sections: [
          {
            title: 'Market Rates',
            note: 'The ship is the only direct path from resources into coins.',
            stats: [
              {
                label: 'Phase Gate',
                value: context.phase === 'player_trade' ? 'Open now' : 'Trade phase only',
                tone: context.phase === 'player_trade' ? 'good' : 'warn',
              },
              { label: 'Fish Price', value: `${prices?.fishPrice ?? 0} coins` },
              { label: 'Wheat Price', value: `${prices?.wheatPrice ?? 0} coins` },
              { label: 'Trade Slots Left', value: String(context.playerTradeSlots) },
              { label: 'All-In Sale Value', value: `${projectedCoins} coins`, tone: 'accent' },
            ],
          },
          {
            title: 'Your Inventory',
            stats: buildResourceStats(player),
          },
          ...buildFutureInteractionSections(context.interaction, context.state),
        ],
      }
    }

    case 'npc': {
      const target = context.state?.characters[context.interaction.characterId] ?? null
      const personality = CHARACTER_META[context.interaction.characterId]?.personality ?? 'Unknown'
      const harvests = getHarvestSummary(context.state, context.interaction.characterId)
      const canTrade = canTradeWithNpc(context, target, context.interaction.characterId)

      return {
        kindLabel: 'Islander',
        title: meta.title,
        subtitle: meta.subtitle,
        sections: [
          {
            title: 'Profile',
            note: 'All currently known NPC values surface here. Extend future interaction-specific values in the helper.',
            stats: [
              { label: 'Personality', value: personality },
              { label: 'Status', value: formatCharacterStatus(target), tone: statusTone(target) },
              { label: 'Friendship', value: String(context.getFriendship(context.interaction.characterId)), tone: 'accent' },
              {
                label: 'Trade Access',
                value: canTrade.label,
                tone: canTrade.tone,
              },
              { label: 'Trade Slots', value: String(target?.tradeSlots ?? 0) },
            ],
          },
          {
            title: 'Resources',
            stats: buildResourceStats(target),
          },
          {
            title: 'Production Queue',
            stats: [
              { label: 'Queued Harvests', value: String(harvests.count) },
              { label: 'Next Harvest', value: harvests.nextHarvestDay },
            ],
          },
          ...buildFutureInteractionSections(context.interaction, context.state),
        ],
      }
    }
  }
}

function buildResourceStats(character: CharacterState | null): PreviewStat[] {
  return [
    { label: 'Fish', value: String(character?.resources.fish ?? 0) },
    { label: 'Wheat', value: String(character?.resources.wheat ?? 0) },
    { label: 'Coins', value: String(character?.resources.coins ?? 0), tone: 'good' },
  ]
}

function getHarvestSummary(state: GameState | null, charId: CharacterId) {
  const harvests = state?.pendingHarvests.filter((harvest) => harvest.characterId === charId) ?? []
  const nextHarvest = harvests.reduce<number | null>((soonest, harvest) => {
    if (soonest === null) return harvest.harvestOnDay
    return Math.min(soonest, harvest.harvestOnDay)
  }, null)

  return {
    count: harvests.length,
    nextHarvestDay: nextHarvest === null ? 'None queued' : `Day ${nextHarvest}`,
  }
}

function canTradeWithNpc(
  context: PreviewPanelContext,
  target: CharacterState | null,
  npcId: CharacterId,
) {
  if (!target || !target.alive || target.escaped) {
    return { label: 'Unavailable', tone: 'warn' as const }
  }

  if (context.phase !== 'player_trade') {
    return { label: 'Trade phase only', tone: 'warn' as const }
  }

  if (context.playerTradeSlots <= 0) {
    return { label: 'No trade slots left', tone: 'warn' as const }
  }

  if (!context.canTradeWithNpc(npcId)) {
    return { label: 'Already traded today', tone: 'warn' as const }
  }

  return { label: 'Ready to negotiate', tone: 'good' as const }
}

function formatCharacterStatus(character: CharacterState | null): string {
  if (!character) return 'Unknown'
  if (character.escaped) return 'Escaped'
  if (!character.alive) return 'Eliminated'
  return 'Active'
}

function statusTone(character: CharacterState | null): PreviewStat['tone'] {
  if (!character) return 'warn'
  if (character.escaped) return 'accent'
  if (!character.alive) return 'warn'
  return 'good'
}

function formatCoinsToEscape(player: CharacterState | null): string {
  const coins = player?.resources.coins ?? 0
  return `${Math.max(GAME_CONFIG.WIN_COINS - coins, 0)} remaining`
}

function getPhaseLabel(phase: DayPhase): string {
  switch (phase) {
    case 'day_start':
      return 'Dawn'
    case 'player_labor':
      return 'Labor'
    case 'player_trade':
      return 'Trade'
    case 'ai_turns':
    case 'settlement':
    case 'day_end':
      return 'Resolve'
    case 'game_over':
      return 'Game Over'
  }
}

function buildFutureInteractionSections(_interaction: InteractionType, _state: GameState | null): PreviewSection[] {
  // Future interaction-specific hooks belong here so new map objects can add
  // parameter blocks without rewriting the panel component or base switch.
  return []
}
