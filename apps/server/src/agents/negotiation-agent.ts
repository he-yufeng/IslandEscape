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
      lines.push(`  ${msg.speaker}: "${msg.text}"`)
    }
    lines.push('')
  }

  lines.push(`Exchange ${history.length + 1} of ${GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES}.`)
  if (history.length >= GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES - 1) {
    lines.push('This is the LAST exchange. You must accept or reject.')
  }

  return lines.join('\n')
}

const NEGOTIATION_SYSTEM_PROMPT = `You are an AI character in a trading game negotiating a deal.

{PERSONALITY}

Respond with a JSON object:
{
  "text": "your dialogue line (1-2 sentences, stay in character, be natural and expressive)",
  "offer": { "fish": 0, "wheat": 0, "coins": 0 },    // what you are giving
  "request": { "fish": 0, "wheat": 0, "coins": 0 },  // what you want in return
  "accept": false,   // true to accept the last proposal as-is
  "reject": false    // true to walk away with no deal
}

Guidelines:
- Be in character! Use your personality in dialogue.
- Reference your friendship level — friends get better deals.
- You can counter-offer by changing offer/request values.
- Set "accept": true to agree to the last proposed deal.
- Set "reject": true if the deal is clearly bad for you, or if you want to end the conversation.
- Don't agree to trades that would leave you with less than 1 fish or 1 wheat.
- High friendship (>20) should make you more generous. Low friendship (<5) means you drive harder bargains.
- If someone has been unfair before, feel free to mention it.`

export async function getNegotiationReply(
  state: GameState,
  charId: CharacterId,
  partnerId: CharacterId,
  history: NegotiationMessage[],
): Promise<NegotiationReply> {
  const personality = getPersonality(charId)
  const context = buildNegotiationContext(state, charId, partnerId, history)
  const systemPrompt = NEGOTIATION_SYSTEM_PROMPT.replace('{PERSONALITY}', personality.systemPrompt)

  const raw = await chatJSON<NegotiationReply>(systemPrompt, context)

  return {
    text: raw.text || `${personality.name} thinks about it...`,
    offer: raw.offer,
    request: raw.request,
    accept: raw.accept === true,
    reject: raw.reject === true,
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

  const raw = await chatJSON<NegotiationReply>(systemPrompt, initPrompt)

  return {
    text: raw.text || `${personality.name} wants to trade with you.`,
    offer: raw.offer || { fish: 0, wheat: 0, coins: 0 },
    request: raw.request || { fish: 0, wheat: 0, coins: 0 },
    accept: false,
    reject: false,
  }
}
