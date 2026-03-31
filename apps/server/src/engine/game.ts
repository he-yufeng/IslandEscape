import {
  type GameState,
  type CharacterId,
  type CharacterState,
  type PlayerAction,
  type AIDecision,
  type AITradeDecision,
  type MerchantPrices,
  ALL_CHARACTERS,
  AI_CHARACTERS,
  GAME_CONFIG,
  friendshipKey,
} from '@game/shared'

function nowIso(): string {
  return new Date().toISOString()
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
    updatedAt: nowIso(),
  }
}

// ---- Day start ----

export function startDay(state: GameState): GameState {
  const merchantPrices = generateMerchantPrices()

  const characters = { ...state.characters }
  for (const id of ALL_CHARACTERS) {
    const c = characters[id]
    if (c && c.alive && !c.escaped) {
      characters[id] = { ...c, tradeSlots: GAME_CONFIG.TRADE_SLOTS_PER_DAY }
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

  return {
    ...state,
    characters,
    merchantPrices,
    pendingHarvests: remainingHarvests,
    phase: 'player_labor',  // Player must labor first
    aiTurnOrder,
    currentAiIndex: 0,
    log: [`--- Day ${state.day} ---`, `Merchant ship: fish ${merchantPrices.fishPrice}c, wheat ${merchantPrices.wheatPrice}c`, ...harvestLog],
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

    // Check escape first
    if (c.resources.coins >= GAME_CONFIG.WIN_COINS) {
      characters[id] = { ...c, escaped: true }
      escapedIds.push(id)
      log.push(`${id} reached ${c.resources.coins} coins and escaped the island!`)
      if (id === 'player' && !winnerId) {
        winnerId = id
      }
      continue
    }

    // Consume daily resources
    const newFish = c.resources.fish - GAME_CONFIG.DAILY_FISH_COST
    const newWheat = c.resources.wheat - GAME_CONFIG.DAILY_WHEAT_COST

    if (newFish <= 0 || newWheat <= 0) {
      characters[id] = {
        ...c,
        resources: { ...c.resources, fish: newFish, wheat: newWheat },
        alive: false,
      }
      eliminatedIds.push(id)
      const reason = newFish <= 0 ? 'fish depleted' : 'wheat depleted'
      log.push(`${id} was eliminated (${reason}).`)
    } else {
      characters[id] = {
        ...c,
        resources: { ...c.resources, fish: newFish, wheat: newWheat },
      }
      log.push(`${id}: fish ${newFish}, wheat ${newWheat}, coins ${c.resources.coins}`)
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

// ---- Advance day ----

export function advanceDay(state: GameState): GameState {
  if (state.phase === 'game_over') return state
  return startDay({ ...state, day: state.day + 1, log: [] })
}

// ---- Helpers ----

export function applyFish(state: GameState, charId: CharacterId): GameState {
  const c = state.characters[charId]
  if (!c) return state

  const newState = updateCharacter(state, charId, {
    resources: { ...c.resources, fish: c.resources.fish + GAME_CONFIG.FISH_PER_LABOR },
  })
  return addLog(newState, `${charId} went fishing. +${GAME_CONFIG.FISH_PER_LABOR} fish.`)
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
  if (sell.fish > c.resources.fish || sell.wheat > c.resources.wheat) {
    return addLog(state, `${charId} does not have enough resources to sell.`)
  }
  if (sell.fish === 0 && sell.wheat === 0) {
    return addLog(state, `${charId} tried to sell nothing to the merchant.`)
  }

  const coinsGained = sell.fish * state.merchantPrices.fishPrice + sell.wheat * state.merchantPrices.wheatPrice

  const newState = updateCharacter(state, charId, {
    resources: {
      fish: c.resources.fish - sell.fish,
      wheat: c.resources.wheat - sell.wheat,
      coins: c.resources.coins + coinsGained,
    },
    tradeSlots: c.tradeSlots - 1,
  })

  const parts = []
  if (sell.fish > 0) parts.push(`${sell.fish} fish`)
  if (sell.wheat > 0) parts.push(`${sell.wheat} wheat`)

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

  const newFrom = {
    ...cFrom,
    resources: {
      fish: cFrom.resources.fish - offer.fish + request.fish,
      wheat: cFrom.resources.wheat - offer.wheat + request.wheat,
      coins: cFrom.resources.coins - offer.coins + request.coins,
    },
  }
  const newTo = {
    ...cTo,
    resources: {
      fish: cTo.resources.fish + offer.fish - request.fish,
      wheat: cTo.resources.wheat + offer.wheat - request.wheat,
      coins: cTo.resources.coins + offer.coins - request.coins,
    },
  }

  const fKey = friendshipKey(from, to)
  const newFriendship = { ...state.friendship }
  newFriendship[fKey] = (newFriendship[fKey] || 0) + GAME_CONFIG.FRIENDSHIP_TRADE_BONUS

  const characters = { ...state.characters, [from]: newFrom, [to]: newTo }
  const newState = { ...state, characters, friendship: newFriendship, updatedAt: nowIso() }
  return addLog(newState, `${from} traded with ${to}. Friendship +${GAME_CONFIG.FRIENDSHIP_TRADE_BONUS}.`)
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
