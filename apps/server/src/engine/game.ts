import {
  type GameState,
  type CharacterId,
  type CharacterState,
  type PlayerAction,
  type AIDecision,
  type AITradeDecision,
  type MerchantPrices,
  type DungeonResult,
  type Resources,
  type DailyEvent,
  ALL_CHARACTERS,
  AI_CHARACTERS,
  GAME_CONFIG,
  friendshipKey,
} from '@game/shared'

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Coerce arbitrary values into a finite integer. Defends every resource
 * arithmetic site against null/undefined/NaN — without this, `JSON.stringify`
 * turns NaN into null on persistence, which then breaks elimination checks
 * (NaN/null comparisons are always false, so eliminated characters stay
 * "alive" with bogus resources).
 */
function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

function safeResources(r: Partial<Resources> | undefined | null): Resources {
  return {
    fish: safeNum(r?.fish),
    wheat: safeNum(r?.wheat),
    coins: safeNum(r?.coins),
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateMerchantPrices(): MerchantPrices {
  return {
    fishPrice: randInt(GAME_CONFIG.MERCHANT_FISH_PRICE_RANGE[0], GAME_CONFIG.MERCHANT_FISH_PRICE_RANGE[1]),
    wheatPrice: randInt(GAME_CONFIG.MERCHANT_WHEAT_PRICE_RANGE[0], GAME_CONFIG.MERCHANT_WHEAT_PRICE_RANGE[1]),
  }
}

/**
 * Roll a fresh daily event. Roughly a third of days have a non-trivial twist.
 * Calm days dominate the early game so new players have time to learn the
 * basics; drought (the most punishing event) is suppressed for the first
 * few days because new players don't yet have wheat buffers.
 */
function rollDailyEvent(day: number): DailyEvent {
  // Day 1-2 are always calm so first-time players can find their feet.
  if (day <= 2) return 'none'
  const r = Math.random()
  if (r < 0.65) return 'none'
  if (r < 0.73) return 'storm'
  if (r < 0.81) return 'festival'
  if (r < 0.88) return 'lucky_catch'
  if (r < 0.95) return 'bumper_crop'
  // Drought is the deadliest event — only allow it once players have a couple
  // of harvest cycles under their belt (Day 4+).
  if (day < 4) return 'bumper_crop'
  return 'drought'
}

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

// ---- Initialization ----

export function createNewGame(gameId: string): GameState {
  const characters: Record<string, CharacterState> = {}
  for (const id of ALL_CHARACTERS) {
    characters[id] = makeCharacter(id)
  }

  const friendship: Record<string, number> = {}
  for (let i = 0; i < ALL_CHARACTERS.length; i++) {
    for (let j = i + 1; j < ALL_CHARACTERS.length; j++) {
      friendship[friendshipKey(ALL_CHARACTERS[i], ALL_CHARACTERS[j])] = 0
    }
  }

  return {
    gameId,
    day: 1,
    phase: 'day_start',
    characters,
    friendship,
    merchantPrices: generateMerchantPrices(),
    pendingHarvests: [],
    log: [],
    eliminatedIds: [],
    escapedIds: [],
    winnerId: null,
    aiTurnOrder: [],
    currentAiIndex: 0,
    dungeonState: null,
    playerNpcTradedToday: [],
    playerDungeonUsedToday: false,
    dailyEvent: 'none',
    updatedAt: nowIso(),
  }
}

// ---- Day start ----

export function startDay(state: GameState): GameState {
  const merchantPrices = generateMerchantPrices()
  const dailyEvent = rollDailyEvent(state.day)

  let characters = { ...state.characters }
  for (const id of ALL_CHARACTERS) {
    const c = characters[id]
    if (c && c.alive && !c.escaped) {
      characters[id] = { ...c, tradeSlots: GAME_CONFIG.TRADE_SLOTS_PER_DAY }
    }
  }

  // Lucky Catch event — every alive character receives +2 fish at dawn.
  if (dailyEvent === 'lucky_catch') {
    for (const id of ALL_CHARACTERS) {
      const c = characters[id]
      if (c && c.alive && !c.escaped) {
        const res = safeResources(c.resources)
        characters[id] = { ...c, resources: { ...res, fish: res.fish + 2 } }
      }
    }
  }

  // Bumper Crop event — the farming counterpart of Lucky Catch: every alive
  // character receives +2 wheat at dawn.
  if (dailyEvent === 'bumper_crop') {
    for (const id of ALL_CHARACTERS) {
      const c = characters[id]
      if (c && c.alive && !c.escaped) {
        const res = safeResources(c.resources)
        characters[id] = { ...c, resources: { ...res, wheat: res.wheat + 2 } }
      }
    }
  }

  // Deliver pending harvests
  const remainingHarvests = []
  const harvestLog: string[] = []
  for (const h of state.pendingHarvests) {
    if (h.harvestOnDay <= state.day) {
      const c = characters[h.characterId]
      if (c && c.alive && !c.escaped) {
        characters[h.characterId] = {
          ...c,
          resources: { ...c.resources, wheat: c.resources.wheat + h.amount },
        }
        harvestLog.push(`${h.characterId} harvested +${h.amount} wheat.`)
      }
    } else {
      remainingHarvests.push(h)
    }
  }

  const aliveAI = AI_CHARACTERS.filter(id => {
    const c = characters[id]
    return c && c.alive && !c.escaped
  })
  const aiTurnOrder = shuffleArray(aliveAI)

  const eventLogLines: string[] = []
  if (dailyEvent === 'storm') eventLogLines.push('⛈️ Storm — fishing yields only 1 fish today.')
  else if (dailyEvent === 'festival') eventLogLines.push('🎉 Festival — friendship gains doubled today.')
  else if (dailyEvent === 'lucky_catch') eventLogLines.push('🎣 Lucky Catch — everyone alive received +2 fish at dawn.')
  else if (dailyEvent === 'bumper_crop') eventLogLines.push('🌾 Bumper Crop — everyone alive received +2 wheat at dawn.')
  else if (dailyEvent === 'drought') eventLogLines.push('🏜️ Drought — tonight\'s upkeep costs 2 wheat.')

  return {
    ...state,
    characters,
    merchantPrices,
    pendingHarvests: remainingHarvests,
    phase: 'player_labor',  // Player must labor first
    aiTurnOrder,
    currentAiIndex: 0,
    playerNpcTradedToday: [],
    playerDungeonUsedToday: false,
    dailyEvent,
    log: [
      `--- Day ${state.day} ---`,
      `Merchant ship: fish ${merchantPrices.fishPrice}c, wheat ${merchantPrices.wheatPrice}c`,
      ...eventLogLines,
      ...harvestLog,
    ],
    updatedAt: nowIso(),
  }
}

// ---- Player actions ----

export function applyPlayerAction(state: GameState, action: PlayerAction): GameState {
  const player = state.characters.player
  if (!player || !player.alive || player.escaped) {
    throw new Error('Player is not active')
  }

  // Phase: player_labor — must fish or farm
  if (state.phase === 'player_labor') {
    if (action.type === 'fish') {
      const newState = applyFish(state, 'player')
      return { ...newState, phase: 'player_trade', updatedAt: nowIso() }
    }
    if (action.type === 'farm') {
      const newState = applyFarm(state, 'player')
      return { ...newState, phase: 'player_trade', updatedAt: nowIso() }
    }
    throw new Error('During labor phase, you must fish or farm.')
  }

  // Phase: player_trade — use trade slots or end turn
  if (state.phase === 'player_trade') {
    switch (action.type) {
      case 'trade_merchant':
        return applyMerchantTrade(state, 'player', action.sell)
      case 'trade_peer':
      case 'negotiate_reply':
        // Handled at route level
        return state
      case 'enter_dungeon':
        return enterDungeon(state)
      case 'dungeon_result':
        return resolveDungeon(state, action.result)
      case 'leave_dungeon':
        return leaveDungeon(state)
      case 'end_turn':
        return { ...state, phase: 'ai_turns', updatedAt: nowIso() }
      default:
        throw new Error('During trade phase, you can trade or end turn.')
    }
  }

  throw new Error(`Cannot act in phase: ${state.phase}`)
}

// ---- AI decision (labor + trades) ----

export function applyAILabor(state: GameState, charId: CharacterId, labor: 'fish' | 'farm'): GameState {
  if (labor === 'fish') {
    return applyFish(state, charId)
  }
  return applyFarm(state, charId)
}

export function applyAITrade(state: GameState, charId: CharacterId, trade: AITradeDecision): GameState {
  const character = state.characters[charId]
  if (!character || !character.alive || character.escaped) return state

  if (trade.action === 'skip') return state

  if (trade.action === 'trade_merchant' && trade.merchantSell) {
    return applyMerchantTrade(state, charId, trade.merchantSell)
  }

  if (trade.action === 'trade_peer') {
    // LOGIC 3: Verify target is alive and not escaped
    const target = trade.tradeTarget ? state.characters[trade.tradeTarget] : null
    if (!target || !target.alive || target.escaped) return state
    // Deduct trade slot; actual negotiation handled in runtime
    if (character.tradeSlots > 0) {
      return updateCharacter(state, charId, { tradeSlots: character.tradeSlots - 1 })
    }
  }

  return state
}

export function advanceAIIndex(state: GameState): GameState {
  const nextIndex = state.currentAiIndex + 1
  const allDone = nextIndex >= state.aiTurnOrder.length

  return {
    ...state,
    currentAiIndex: nextIndex,
    phase: allDone ? 'settlement' : 'ai_turns',
    updatedAt: nowIso(),
  }
}

// ---- Settlement ----

export function settle(state: GameState): GameState {
  const characters = { ...state.characters }
  const log = [...state.log]
  const eliminatedIds = [...state.eliminatedIds]
  const escapedIds = [...state.escapedIds]
  let winnerId = state.winnerId

  log.push('--- Settlement ---')

  for (const id of ALL_CHARACTERS) {
    const c = characters[id]
    if (!c || !c.alive || c.escaped) continue

    // Coerce defensively — if persistence ever round-tripped a NaN through
    // JSON it'd come back as `null`, and `null - 1 === -1` here would be
    // misleading; better to canonicalize before any arithmetic.
    const safeRes = safeResources(c.resources)
    const safeChar = { ...c, resources: safeRes }

    // Check escape first
    if (safeRes.coins >= GAME_CONFIG.WIN_COINS) {
      characters[id] = { ...safeChar, escaped: true }
      escapedIds.push(id)
      log.push(`${id} reached ${safeRes.coins} coins and escaped the island!`)
      if (id === 'player' && !winnerId) {
        winnerId = id
      }
      continue
    }

    // Consume daily resources — drought event doubles the wheat cost.
    const wheatCost = state.dailyEvent === 'drought'
      ? GAME_CONFIG.DAILY_WHEAT_COST * 2
      : GAME_CONFIG.DAILY_WHEAT_COST
    const newFish = safeRes.fish - GAME_CONFIG.DAILY_FISH_COST
    const newWheat = safeRes.wheat - wheatCost

    if (newFish <= 0 || newWheat <= 0) {
      characters[id] = {
        ...safeChar,
        resources: { ...safeRes, fish: newFish, wheat: newWheat },
        alive: false,
      }
      eliminatedIds.push(id)
      const reasons = []
      if (newFish <= 0) reasons.push('fish')
      if (newWheat <= 0) reasons.push('wheat')
      log.push(`${id} was eliminated (${reasons.join(' and ')} depleted).`)
    } else {
      characters[id] = {
        ...safeChar,
        resources: { ...safeRes, fish: newFish, wheat: newWheat },
      }
      log.push(`${id}: fish ${newFish}, wheat ${newWheat}, coins ${safeRes.coins}`)
    }
  }

  const playerChar = characters.player
  const isGameOver = !playerChar || !playerChar.alive || playerChar.escaped

  return {
    ...state,
    characters,
    log,
    eliminatedIds,
    escapedIds,
    winnerId,
    phase: isGameOver ? 'game_over' : 'day_end',
    updatedAt: nowIso(),
  }
}

// ---- Dungeon ----

export function enterDungeon(state: GameState): GameState {
  const player = state.characters.player
  if (!player) throw new Error('Player not found')
  if (state.dungeonState?.active) throw new Error('Already in dungeon')
  if (state.playerDungeonUsedToday) throw new Error('You have already entered the dungeon today.')
  if (player.tradeSlots <= 0) throw new Error('No trade slots remaining')

  const newState: GameState = {
    ...state,
    characters: {
      ...state.characters,
      player: { ...player, tradeSlots: player.tradeSlots - 1 },
    },
    dungeonState: { active: true },
    playerDungeonUsedToday: true,
    updatedAt: nowIso(),
  }
  return addLog(newState, 'Player entered the dungeon!')
}

export function resolveDungeon(state: GameState, result: DungeonResult): GameState {
  const player = state.characters.player
  if (!player) return state

  let newState: GameState = {
    ...state,
    dungeonState: null,
    updatedAt: nowIso(),
  }

  if (result.win) {
    // Scale coin reward by day so later, harder runs feel worth it.
    // Day 1 → 20 / Day 5 → 36 / Day 10 → 56 / capped at 80.
    const coinReward = Math.min(80, GAME_CONFIG.DUNGEON_COIN_REWARD + Math.max(0, state.day - 1) * 4)
    const updatedPlayer = {
      ...player,
      resources: {
        ...player.resources,
        coins: player.resources.coins + coinReward,
      },
    }
    newState = {
      ...newState,
      characters: { ...newState.characters, player: updatedPlayer },
    }
    newState = addLog(newState, `Player defeated the boss! +${coinReward} coins.`)
  } else {
    // Losing the dungeon used to be an instant kill on early days (lose 5 fish
    // and 5 wheat from a starting pool of 6). Cap the loss so the player keeps
    // at least 1 of each, ensuring they can still survive the upcoming
    // settlement that costs 1 fish + 1 wheat.
    const fishLoss = Math.min(Math.max(0, player.resources.fish - 1), GAME_CONFIG.DUNGEON_RESOURCE_PENALTY)
    const wheatLoss = Math.min(Math.max(0, player.resources.wheat - 1), GAME_CONFIG.DUNGEON_RESOURCE_PENALTY)
    const updatedPlayer = {
      ...player,
      resources: {
        ...player.resources,
        fish: player.resources.fish - fishLoss,
        wheat: player.resources.wheat - wheatLoss,
      },
    }
    newState = {
      ...newState,
      characters: { ...newState.characters, player: updatedPlayer },
    }
    newState = addLog(newState, `Player was defeated! Lost ${fishLoss} fish and ${wheatLoss} wheat.`)
  }

  return newState
}

export function leaveDungeon(state: GameState): GameState {
  return {
    ...state,
    dungeonState: null,
    updatedAt: nowIso(),
  }
}

// ---- Advance day ----

export function advanceDay(state: GameState): GameState {
  if (state.phase === 'game_over') return state
  return startDay({ ...state, day: state.day + 1, log: [] })
}

// ---- Helpers ----

export function applyFish(state: GameState, charId: CharacterId): GameState {
  const c = state.characters[charId]
  if (!c) return state

  const res = safeResources(c.resources)
  // Storm: fishing yields cut in half (rounded up) — painful but not deadly.
  const yieldFish = state.dailyEvent === 'storm' ? 2 : GAME_CONFIG.FISH_PER_LABOR
  const newState = updateCharacter(state, charId, {
    resources: { ...res, fish: res.fish + yieldFish },
  })
  const note = state.dailyEvent === 'storm' ? ' (storm — only +2)' : ''
  return addLog(newState, `${charId} went fishing. +${yieldFish} fish${note}.`)
}

export function applyFarm(state: GameState, charId: CharacterId): GameState {
  const harvest = {
    characterId: charId,
    plantedOnDay: state.day,
    harvestOnDay: state.day + GAME_CONFIG.HARVEST_DELAY_DAYS,
    amount: GAME_CONFIG.WHEAT_PER_HARVEST,
  }
  const newState = {
    ...state,
    pendingHarvests: [...state.pendingHarvests, harvest],
  }
  return addLog(newState, `${charId} planted wheat. Harvest on day ${harvest.harvestOnDay}.`)
}

export function applyMerchantTrade(
  state: GameState,
  charId: CharacterId,
  sell: { fish: number; wheat: number },
): GameState {
  const c = state.characters[charId]
  if (!c) return state
  if (c.tradeSlots <= 0) {
    return addLog(state, `${charId} has no trade slots remaining.`)
  }
  // Coerce: AI decision JSON occasionally arrives with null/undefined fields.
  const res = safeResources(c.resources)
  const sellFish = safeNum(sell.fish)
  const sellWheat = safeNum(sell.wheat)
  if (sellFish > res.fish || sellWheat > res.wheat) {
    return addLog(state, `${charId} does not have enough resources to sell.`)
  }
  if (sellFish === 0 && sellWheat === 0) {
    return addLog(state, `${charId} tried to sell nothing to the merchant.`)
  }

  const coinsGained = sellFish * state.merchantPrices.fishPrice + sellWheat * state.merchantPrices.wheatPrice

  const newState = updateCharacter(state, charId, {
    resources: {
      fish: res.fish - sellFish,
      wheat: res.wheat - sellWheat,
      coins: res.coins + coinsGained,
    },
    tradeSlots: c.tradeSlots - 1,
  })

  const parts = []
  if (sellFish > 0) parts.push(`${sellFish} fish`)
  if (sellWheat > 0) parts.push(`${sellWheat} wheat`)

  return addLog(newState, `${charId} sold ${parts.join(' and ')} to the merchant for ${coinsGained} coins.`)
}

export function executePeerTrade(
  state: GameState,
  from: CharacterId,
  to: CharacterId,
  offer: { fish: number; wheat: number; coins: number },
  request: { fish: number; wheat: number; coins: number },
): GameState {
  const cFrom = state.characters[from]
  const cTo = state.characters[to]
  if (!cFrom || !cTo) return state

  // Coerce in case persistence or LLM output ever introduced null/NaN.
  const fromRes = safeResources(cFrom.resources)
  const toRes = safeResources(cTo.resources)
  const o = {
    fish: safeNum(offer.fish),
    wheat: safeNum(offer.wheat),
    coins: safeNum(offer.coins),
  }
  const r = {
    fish: safeNum(request.fish),
    wheat: safeNum(request.wheat),
    coins: safeNum(request.coins),
  }

  // Validate that both parties have enough resources
  if (fromRes.fish < o.fish ||
      fromRes.wheat < o.wheat ||
      fromRes.coins < o.coins ||
      toRes.fish < r.fish ||
      toRes.wheat < r.wheat ||
      toRes.coins < r.coins) {
    return addLog(state, `Trade rejected: insufficient resources.`)
  }

  // Validate that resulting resources are non-negative
  const newFromFish = fromRes.fish - o.fish + r.fish
  const newFromWheat = fromRes.wheat - o.wheat + r.wheat
  const newFromCoins = fromRes.coins - o.coins + r.coins
  const newToFish = toRes.fish + o.fish - r.fish
  const newToWheat = toRes.wheat + o.wheat - r.wheat
  const newToCoins = toRes.coins + o.coins - r.coins

  if (newFromFish < 0 || newFromWheat < 0 || newFromCoins < 0 ||
      newToFish < 0 || newToWheat < 0 || newToCoins < 0) {
    return addLog(state, `Trade rejected: would result in negative resources.`)
  }

  const newFrom = {
    ...cFrom,
    resources: {
      fish: newFromFish,
      wheat: newFromWheat,
      coins: newFromCoins,
    },
  }
  const newTo = {
    ...cTo,
    resources: {
      fish: newToFish,
      wheat: newToWheat,
      coins: newToCoins,
    },
  }

  const fKey = friendshipKey(from, to)
  const newFriendship = { ...state.friendship }
  // Festival event: peer trades give double friendship bonus today.
  const friendshipMul = state.dailyEvent === 'festival' ? 2 : 1
  const bonus = GAME_CONFIG.FRIENDSHIP_TRADE_BONUS * friendshipMul
  newFriendship[fKey] = (newFriendship[fKey] || 0) + bonus

  const characters = { ...state.characters, [from]: newFrom, [to]: newTo }
  const newState = { ...state, characters, friendship: newFriendship, updatedAt: nowIso() }
  const festivalNote = state.dailyEvent === 'festival' ? ' (festival 2×)' : ''
  return addLog(newState, `${from} traded with ${to}. Friendship +${bonus}${festivalNote}.`)
}

function updateCharacter(state: GameState, charId: CharacterId, patch: Partial<CharacterState>): GameState {
  const c = state.characters[charId]
  if (!c) return state
  return {
    ...state,
    characters: { ...state.characters, [charId]: { ...c, ...patch } },
    updatedAt: nowIso(),
  }
}

function addLog(state: GameState, message: string): GameState {
  return { ...state, log: [...state.log, message] }
}
