import {
  type GameState,
  type CharacterId,
  type NegotiationMessage,
  friendshipKey,
  GAME_CONFIG,
} from '@game/shared'
import { getPersonality } from './personalities'
import { chatJSON } from './llm'

interface NegotiationReply {
  text: string
  offer?: { fish: number; wheat: number; coins: number }
  request?: { fish: number; wheat: number; coins: number }
  accept?: boolean
  reject?: boolean
}

function buildNegotiationContext(
  state: GameState,
  charId: CharacterId,
  partnerId: CharacterId,
  history: NegotiationMessage[],
): string {
  const me = state.characters[charId]
  const partner = state.characters[partnerId]
  if (!me || !partner) return 'Invalid negotiation.'

  const fKey = friendshipKey(charId, partnerId)
  const friendship = state.friendship[fKey] || 0

  const lines: string[] = []
  lines.push(`You are negotiating a trade with ${partnerId}.`)
  lines.push(`Your resources: fish=${me.resources.fish}, wheat=${me.resources.wheat}, coins=${me.resources.coins}`)
  lines.push(`${partnerId}'s resources: fish=${partner.resources.fish}, wheat=${partner.resources.wheat}, coins=${partner.resources.coins}`)
  lines.push(`Friendship with ${partnerId}: ${friendship}`)
  lines.push(`Merchant prices today: fish=${state.merchantPrices.fishPrice}c, wheat=${state.merchantPrices.wheatPrice}c`)
  lines.push(`You need at least 2 fish and 2 wheat to survive tonight safely.`)
  lines.push('')

  if (history.length > 0) {
    lines.push('Conversation so far:')
    for (const msg of history) {
      const proposalSuffix = msg.proposal
        ? `  [proposal: ${msg.speaker} gives ${describeOffer(msg.proposal.offer)} and wants ${describeOffer(msg.proposal.request)}]`
        : ''
      lines.push(`  ${msg.speaker}: "${msg.text}"${proposalSuffix}`)
    }
    lines.push('')
  }

  // Highlight the player's most recent structured proposal so the LLM knows
  // exactly what it would be accepting / countering / rejecting.
  const lastPartnerProposal = [...history].reverse().find(m => m.speaker === partnerId && m.proposal)?.proposal
  if (lastPartnerProposal) {
    lines.push(`${partnerId}'s latest concrete offer:`)
    lines.push(`  - ${partnerId} would give: ${describeOffer(lastPartnerProposal.offer)}`)
    lines.push(`  - ${partnerId} wants in return: ${describeOffer(lastPartnerProposal.request)}`)
    lines.push(`  → To accept these exact terms, set "accept": true.`)
    lines.push(`  → To counter, set new offer/request values.`)
    lines.push(`  → If the deal is bad for you, set "reject": true.`)
    lines.push('')
  } else {
    lines.push(`${partnerId} has not put concrete numbers on the table yet — counter with your own offer/request, or reject if you do not want to trade.`)
    lines.push('')
  }

  lines.push(`Exchange ${history.length + 1} of ${GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES}.`)
  if (history.length >= GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES - 1) {
    lines.push('This is the LAST exchange. You must accept or reject — do not counter again.')
  }

  return lines.join('\n')
}

function describeOffer(o: { fish: number; wheat: number; coins: number }): string {
  const parts: string[] = []
  if (o.fish) parts.push(`${o.fish} fish`)
  if (o.wheat) parts.push(`${o.wheat} wheat`)
  if (o.coins) parts.push(`${o.coins} coins`)
  return parts.length === 0 ? 'nothing' : parts.join(', ')
}

const NEGOTIATION_SYSTEM_PROMPT = `You are an AI character in a trading game negotiating a deal.

{PERSONALITY}

Respond with a JSON object:
{
  "text": "your dialogue line (1-2 sentences, stay in character, be natural and expressive)",
  "offer": { "fish": 0, "wheat": 0, "coins": 0 },    // what YOU are giving (set when countering)
  "request": { "fish": 0, "wheat": 0, "coins": 0 },  // what YOU want in return (set when countering)
  "accept": false,   // true to agree to the partner's most recent concrete offer EXACTLY
  "reject": false    // true to walk away with no deal
}

Critical rules — every reply MUST be one of three actions:
1. ACCEPT: set "accept": true. Use ONLY when the partner has put concrete numbers on the table that you are willing to take as-is. The partner's exact terms will execute — do NOT also fill offer/request with different numbers.
2. COUNTER: provide your own offer/request with values DIFFERENT from the partner's last proposal. This signals you want to negotiate further.
3. REJECT: set "reject": true. Use when the deal is clearly bad, when you have nothing useful to trade, or when you want to end the conversation.

Do NOT mirror the partner's proposal back at them with offer/request equal to what they just asked for — that is meaningless. Either accept it (set accept=true) or counter with different terms.

Guidelines:
- Be in character! Use your personality in dialogue.
- Reference your friendship level — friends get better deals.
- Don't agree to trades that would leave you with less than 1 fish or 1 wheat.
- High friendship (>20) should make you more generous. Low friendship (<5) means you drive harder bargains.
- If the partner's offer is unfair, counter with terms that favor YOU — don't just agree.
- After 3 exchanges with no progress, lean toward accept (if reasonable) or reject. Don't endlessly chat.`

export async function getNegotiationReply(
  state: GameState,
  charId: CharacterId,
  partnerId: CharacterId,
  history: NegotiationMessage[],
): Promise<NegotiationReply> {
  const personality = getPersonality(charId)
  const context = buildNegotiationContext(state, charId, partnerId, history)
  const systemPrompt = NEGOTIATION_SYSTEM_PROMPT.replace('{PERSONALITY}', personality.systemPrompt)

  try {
    const raw = await chatJSON<NegotiationReply>(systemPrompt, context)
    // Defensive: if the LLM both "accepts" and provides a counter that mirrors
    // the partner's last proposal, treat it as an accept (caller will execute
    // the partner's structured terms, not the mirrored offer).
    return {
      text: raw.text || `${personality.name} thinks about it...`,
      offer: raw.offer,
      request: raw.request,
      accept: raw.accept === true,
      reject: raw.reject === true,
    }
  } catch (err) {
    console.error(`[negotiation] AI reply failed for ${charId}:`, err instanceof Error ? err.message : err)
    return {
      text: `${personality.name} looks uncertain and walks away.`,
      reject: true,
    }
  }
}

export async function getAITradeInitiation(
  state: GameState,
  charId: CharacterId,
  targetId: CharacterId,
): Promise<NegotiationReply> {
  const personality = getPersonality(charId)
  const context = buildNegotiationContext(state, charId, targetId, [])
  const systemPrompt = NEGOTIATION_SYSTEM_PROMPT.replace('{PERSONALITY}', personality.systemPrompt)
  const initPrompt = `${context}\n\nYou are starting this negotiation. Make an opening offer.`

  try {
    const raw = await chatJSON<NegotiationReply>(systemPrompt, initPrompt)
    return {
      text: raw.text || `${personality.name} wants to trade with you.`,
      offer: raw.offer || { fish: 0, wheat: 0, coins: 0 },
      request: raw.request || { fish: 0, wheat: 0, coins: 0 },
      accept: false,
      reject: false,
    }
  } catch (err) {
    console.error(`[negotiation] AI initiation failed for ${charId}:`, err instanceof Error ? err.message : err)
    return {
      text: `${personality.name} decides not to trade right now.`,
      reject: true,
    }
  }
}
