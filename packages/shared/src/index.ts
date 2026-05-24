import { z } from 'zod'

// ============================================================
// Island Escape — Shared Types
// ============================================================

// ----- Game configuration constants -----

export const GAME_CONFIG = {
  STARTING_FISH: 5,
  STARTING_WHEAT: 5,
  STARTING_COINS: 0,
  FISH_PER_LABOR: 3,
  WHEAT_PER_HARVEST: 8,
  HARVEST_DELAY_DAYS: 3,
  DAILY_FISH_COST: 1,
  DAILY_WHEAT_COST: 1,
  WIN_COINS: 100,
  TRADE_SLOTS_PER_DAY: 2,
  MAX_NEGOTIATION_EXCHANGES: 5,
  FRIENDSHIP_TRADE_BONUS: 5,
  MERCHANT_FISH_PRICE_RANGE: [2, 6] as const,
  MERCHANT_WHEAT_PRICE_RANGE: [1, 4] as const,
  // Dungeon
  PLAYER_MAX_HP: 15,
  BOSS_MAX_HP: 60,
  BASE_BULLET_DAMAGE: 2,
  BASE_BULLET_COOLDOWN: 400,
  BASE_MOVE_SPEED: 160,
  BOSS_BULLET_DAMAGE: 3,
  BOSS_CHARGE_DAMAGE: 5,
  BOSS_CHARGE_SPEED: 300,
  DUNGEON_COIN_REWARD: 20,
  DUNGEON_RESOURCE_PENALTY: 5,
  XP_PER_ORB: 10,
  XP_THRESHOLDS: [30, 60, 100, 150, 210, 280, 360] as readonly number[],
} as const

// ----- Character & resource types -----

export const CharacterIdSchema = z.enum(['player', 'tom', 'sam', 'lily', 'jack'])
export type CharacterId = z.infer<typeof CharacterIdSchema>

export const ALL_CHARACTERS: CharacterId[] = ['player', 'tom', 'sam', 'lily', 'jack']
export const AI_CHARACTERS: CharacterId[] = ['tom', 'sam', 'lily', 'jack']

export const ResourcesSchema = z.object({
  fish: z.number().int(),
  wheat: z.number().int(),
  coins: z.number().int(),
})
export type Resources = z.infer<typeof ResourcesSchema>

// ----- Pending harvest tracker -----

export const PendingHarvestSchema = z.object({
  characterId: CharacterIdSchema,
  plantedOnDay: z.number().int(),
  harvestOnDay: z.number().int(),
  amount: z.number().int().default(GAME_CONFIG.WHEAT_PER_HARVEST),
})
export type PendingHarvest = z.infer<typeof PendingHarvestSchema>

// ----- Friendship -----

export function friendshipKey(a: CharacterId, b: CharacterId): string {
  return [a, b].sort().join(':')
}

// ----- Merchant ship -----

export const MerchantPricesSchema = z.object({
  fishPrice: z.number().int().min(1),
  wheatPrice: z.number().int().min(1),
})
export type MerchantPrices = z.infer<typeof MerchantPricesSchema>

// ----- Character state -----

export const CharacterStateSchema = z.object({
  id: CharacterIdSchema,
  resources: ResourcesSchema,
  tradeSlots: z.number().int().min(0).max(GAME_CONFIG.TRADE_SLOTS_PER_DAY),
  alive: z.boolean(),
  escaped: z.boolean(),
})
export type CharacterState = z.infer<typeof CharacterStateSchema>

// ----- Trade proposal -----

export const TradeOfferSchema = z.object({
  fish: z.number().int().min(0).default(0),
  wheat: z.number().int().min(0).default(0),
  coins: z.number().int().min(0).default(0),
})
export type TradeOffer = z.infer<typeof TradeOfferSchema>

export const TradeProposalSchema = z.object({
  from: CharacterIdSchema,
  to: CharacterIdSchema,
  offer: TradeOfferSchema,
  request: TradeOfferSchema,
})
export type TradeProposal = z.infer<typeof TradeProposalSchema>

// ----- AI decision (structured output from LLM) -----

// AI labor choice (step 1: mandatory)
export const AILaborDecisionSchema = z.object({
  labor: z.enum(['fish', 'farm']),
  reasoning: z.string(),
})
export type AILaborDecision = z.infer<typeof AILaborDecisionSchema>

// AI trade action (step 2: per trade slot, optional)
export const AITradeDecisionSchema = z.object({
  action: z.enum(['trade_merchant', 'trade_peer', 'skip']),
  merchantSell: z.object({
    fish: z.number().int().min(0).default(0),
    wheat: z.number().int().min(0).default(0),
  }).optional(),
  tradeTarget: CharacterIdSchema.optional(),
  reasoning: z.string(),
})
export type AITradeDecision = z.infer<typeof AITradeDecisionSchema>

// Combined AI turn (labor + up to 2 trades)
export const AIDecisionSchema = z.object({
  labor: AILaborDecisionSchema,
  trades: z.array(AITradeDecisionSchema).max(2),
})
export type AIDecision = z.infer<typeof AIDecisionSchema>

// ----- Negotiation message -----

export const NegotiationMessageSchema = z.object({
  speaker: CharacterIdSchema,
  text: z.string(),
  proposal: TradeProposalSchema.optional(),
  accept: z.boolean().optional(),
})
export type NegotiationMessage = z.infer<typeof NegotiationMessageSchema>

// ----- Dungeon -----

export const DungeonResultSchema = z.object({
  win: z.boolean(),
  damageDealt: z.number().int(),
  damageTaken: z.number().int(),
  cardsCollected: z.number().int(),
})
export type DungeonResult = z.infer<typeof DungeonResultSchema>

export const DungeonStateSchema = z.object({
  active: z.boolean(),
})
export type DungeonState = z.infer<typeof DungeonStateSchema>

// ----- Day phase -----

export const DayPhaseSchema = z.enum([
  'day_start',
  'player_labor',      // player must choose fish or farm
  'player_trade',      // player uses 2 trade slots (optional, can end early)
  'ai_turns',          // each AI: labor first, then trade
  'settlement',
  'day_end',
  'game_over',
])
export type DayPhase = z.infer<typeof DayPhaseSchema>

// ----- Full game state -----

export const GameStateSchema = z.object({
  gameId: z.string(),
  day: z.number().int().min(1),
  phase: DayPhaseSchema,
  characters: z.record(CharacterIdSchema, CharacterStateSchema),
  friendship: z.record(z.string(), z.number()),
  merchantPrices: MerchantPricesSchema,
  pendingHarvests: z.array(PendingHarvestSchema),
  log: z.array(z.string()),
  eliminatedIds: z.array(CharacterIdSchema),
  escapedIds: z.array(CharacterIdSchema),
  winnerId: CharacterIdSchema.nullable(),
  aiTurnOrder: z.array(CharacterIdSchema),
  currentAiIndex: z.number().int(),
  dungeonState: DungeonStateSchema.nullable().default(null),
  /** NPCs the player has traded with today (prevents duplicate trades) */
  playerNpcTradedToday: z.array(CharacterIdSchema),
  updatedAt: z.string().datetime(),
})
export type GameState = z.infer<typeof GameStateSchema>

// ----- Player action (what the frontend sends) -----

export const PlayerActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('fish') }),
  z.object({ type: z.literal('farm') }),
  z.object({
    type: z.literal('trade_merchant'),
    sell: z.object({
      fish: z.number().int().min(0),
      wheat: z.number().int().min(0),
    }),
  }),
  z.object({
    type: z.literal('trade_peer'),
    target: CharacterIdSchema,
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal('negotiate_reply'),
    conversationId: z.string(),
    message: z.string().min(1),
    accept: z.boolean().optional(),
  }),
  z.object({ type: z.literal('end_turn') }),
  z.object({ type: z.literal('enter_dungeon') }),
  z.object({ type: z.literal('dungeon_result'), result: DungeonResultSchema }),
  z.object({ type: z.literal('leave_dungeon') }),
])
export type PlayerAction = z.infer<typeof PlayerActionSchema>

// ----- SSE event types -----

export const GameSSEEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('state_update'), state: GameStateSchema }),
  z.object({ type: z.literal('ai_thinking'), characterId: CharacterIdSchema }),
  z.object({ type: z.literal('ai_decision'), characterId: CharacterIdSchema, decision: z.unknown() }),
  z.object({ type: z.literal('negotiation'), message: NegotiationMessageSchema }),
  z.object({ type: z.literal('trade_result'), success: z.boolean(), from: CharacterIdSchema, to: CharacterIdSchema, summary: z.string() }),
  z.object({ type: z.literal('settlement'), results: z.array(z.string()) }),
  z.object({ type: z.literal('elimination'), characterId: CharacterIdSchema }),
  z.object({ type: z.literal('escape'), characterId: CharacterIdSchema }),
  z.object({ type: z.literal('game_over'), winnerId: CharacterIdSchema.nullable(), reason: z.string() }),
  z.object({ type: z.literal('day_start'), day: z.number(), merchantPrices: MerchantPricesSchema }),
  z.object({ type: z.literal('log'), message: z.string() }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('dungeon_event'), message: z.string() }),
])
export type GameSSEEvent = z.infer<typeof GameSSEEventSchema>

// ----- Save slot (reused from existing pattern) -----

export const SaveSlotSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  day: z.number().int().min(0),
  updatedAt: z.string().datetime(),
})
export type SaveSlotSummary = z.infer<typeof SaveSlotSummarySchema>

// ----- API error (keep existing) -----

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>
