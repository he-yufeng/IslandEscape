import {
  type GameState,
  type CharacterId,
  type AIDecision,
  type AILaborDecision,
  type AITradeDecision,
  AI_CHARACTERS,
  friendshipKey,
  GAME_CONFIG,
} from '@game/shared'
import { getPersonality } from './personalities'
import { chatJSON } from './llm'

function buildGameContext(state: GameState, charId: CharacterId): string {
  const me = state.characters[charId]
  if (!me) return 'You are eliminated.'

  const lines: string[] = []
  lines.push(`Day ${state.day}. You are ${getPersonality(charId).name}.`)
  lines.push(`Your resources: fish=${me.resources.fish}, wheat=${me.resources.wheat}, coins=${me.resources.coins}`)
  lines.push(`Trade slots remaining today: ${me.tradeSlots}`)
  lines.push(`Merchant ship prices today: fish=${state.merchantPrices.fishPrice} coins each, wheat=${state.merchantPrices.wheatPrice} coins each`)
  lines.push('')

  const myHarvests = state.pendingHarvests.filter(h => h.characterId === charId)
  if (myHarvests.length > 0) {
    lines.push('Your pending harvests:')
    for (const h of myHarvests) {
      lines.push(`  - wheat +${h.amount} arriving on day ${h.harvestOnDay}`)
    }
    lines.push('')
  }

  lines.push('Other characters on the island:')
  for (const otherId of [...AI_CHARACTERS, 'player' as CharacterId]) {
    if (otherId === charId) continue
    const other = state.characters[otherId]
    if (!other || !other.alive || other.escaped) {
      if (other?.escaped) lines.push(`  - ${otherId}: ESCAPED`)
      else if (other && !other.alive) lines.push(`  - ${otherId}: ELIMINATED`)
      continue
    }
    const fKey = friendshipKey(charId, otherId)
    const friendship = state.friendship[fKey] || 0
    lines.push(`  - ${otherId}: fish=${other.resources.fish}, wheat=${other.resources.wheat}, coins=${other.resources.coins} (friendship: ${friendship})`)
  }

  lines.push('')
  lines.push(`Goal: reach ${GAME_CONFIG.WIN_COINS} coins to escape the island.`)
  lines.push('Every night you consume 1 fish and 1 wheat. If either hits 0, you are eliminated.')

  return lines.join('\n')
}

const FULL_DECISION_PROMPT = `You are an AI character in a survival trading game called Island Escape.
Each turn you MUST do two things in order:
1. LABOR: choose either "fish" (+3 fish instantly) or "farm" (plant wheat, +8 wheat in 3 days)
2. TRADE: you have 2 trade slots. For each slot, choose to trade with the merchant ship, negotiate with another character, or skip.

{PERSONALITY}

Respond with a JSON object:
{
  "labor": {
    "labor": "fish" or "farm",
    "reasoning": "why you chose this"
  },
  "trades": [
    {
      "action": "trade_merchant" or "trade_peer" or "skip",
      "merchantSell": { "fish": 0, "wheat": 0 },
      "tradeTarget": "character_id",
      "reasoning": "why"
    },
    {
      "action": "skip",
      "reasoning": "saving slot or no good trades available"
    }
  ]
}

Rules:
- LABOR is mandatory. You must choose fish or farm.
- TRADES array should have exactly 2 entries (one per trade slot).
- You can only sell resources you actually have.
- Don't sell so much that you'll die tonight (keep at least 2 fish and 2 wheat after all trades).
- Consider friendship, market prices, who has what you need.
- If someone is close to escaping (high coins), you might want to avoid helping them.
- High friendship means better deals and more trust.`

export async function getAIDecision(
  state: GameState,
  charId: CharacterId,
): Promise<AIDecision> {
  const personality = getPersonality(charId)
  const context = buildGameContext(state, charId)
  const systemPrompt = FULL_DECISION_PROMPT.replace('{PERSONALITY}', personality.systemPrompt)

  try {
    const raw = await chatJSON<Record<string, unknown>>(systemPrompt, context)

    // Parse labor
    const laborRaw = raw.labor as Record<string, unknown> | undefined
    const labor: AILaborDecision = {
      labor: (laborRaw?.labor === 'farm' ? 'farm' : 'fish') as 'fish' | 'farm',
      reasoning: (laborRaw?.reasoning as string) || 'AI decided.',
    }

    // Parse trades
    const tradesRaw = (raw.trades as Record<string, unknown>[]) || []
    const trades: AITradeDecision[] = tradesRaw.slice(0, 2).map(t => {
      const action = t.action as string
      if (action === 'trade_merchant') {
        return {
          action: 'trade_merchant' as const,
          merchantSell: t.merchantSell as { fish: number; wheat: number } | undefined,
          reasoning: (t.reasoning as string) || '',
        }
      }
      if (action === 'trade_peer') {
        return {
          action: 'trade_peer' as const,
          tradeTarget: t.tradeTarget as CharacterId | undefined,
          reasoning: (t.reasoning as string) || '',
        }
      }
      return {
        action: 'skip' as const,
        reasoning: (t.reasoning as string) || 'No trade this slot.',
      }
    })

    // Pad to 2 trades if needed
    while (trades.length < 2) {
      trades.push({ action: 'skip', reasoning: 'No trade.' })
    }

    return { labor, trades }
  } catch (err) {
    console.error(`AI decision failed for ${charId}:`, err)
    return {
      labor: { labor: 'fish', reasoning: 'Error fallback: fishing.' },
      trades: [
        { action: 'skip', reasoning: 'Error fallback.' },
        { action: 'skip', reasoning: 'Error fallback.' },
      ],
    }
  }
}
