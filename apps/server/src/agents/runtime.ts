import type {
  GameState,
  CharacterId,
  GameSSEEvent,
  NegotiationMessage,
} from '@game/shared'
import { GAME_CONFIG } from '@game/shared'
import { getAIDecision } from './decision-agent'
import { getNegotiationReply, getAITradeInitiation } from './negotiation-agent'
import {
  applyAILabor,
  applyAITrade,
  executePeerTrade,
  settle,
  advanceDay,
} from '../engine/game'

export type SSEBroadcaster = (event: GameSSEEvent) => void

export async function runAITurns(
  state: GameState,
  broadcast: SSEBroadcaster,
): Promise<GameState> {
  let current = state

  for (let i = current.currentAiIndex; i < current.aiTurnOrder.length; i++) {
    const charId = current.aiTurnOrder[i]
    const character = current.characters[charId]
    if (!character || !character.alive || character.escaped) {
      continue
    }

    broadcast({ type: 'ai_thinking', characterId: charId })
    broadcast({ type: 'log', message: `${charId}'s turn...` })

    try {
      // Get full decision: labor + trades
      const decision = await getAIDecision(current, charId)

      // Step 1: Labor (mandatory)
      broadcast({ type: 'log', message: `${charId} chose to ${decision.labor.labor}. (${decision.labor.reasoning})` })
      current = applyAILabor(current, charId, decision.labor.labor)
      broadcast({ type: 'state_update', state: current })

      // Step 2: Trades (up to 2 slots)
      for (const trade of decision.trades) {
        if (trade.action === 'skip') continue

        const char = current.characters[charId]
        if (!char || char.tradeSlots <= 0) break

        if (trade.action === 'trade_merchant' && trade.merchantSell) {
          broadcast({ type: 'log', message: `${charId} trades with merchant. (${trade.reasoning})` })
          current = applyAITrade(current, charId, trade)
        }

        if (trade.action === 'trade_peer' && trade.tradeTarget) {
          broadcast({ type: 'log', message: `${charId} wants to trade with ${trade.tradeTarget}. (${trade.reasoning})` })
          current = await runAINegotiation(current, charId, trade.tradeTarget, broadcast)
          // Deduct trade slot
          current = applyAITrade(current, charId, trade)
        }

        broadcast({ type: 'state_update', state: current })
      }

    } catch (err) {
      console.error(`AI turn failed for ${charId}:`, err)
      // Fallback: just fish
      current = applyAILabor(current, charId, 'fish')
      broadcast({ type: 'log', message: `${charId} went fishing (error fallback).` })
    }

    broadcast({ type: 'state_update', state: current })
  }

  // All AI turns done, move to settlement
  current = { ...current, phase: 'settlement' as const }

  // Settlement
  current = settle(current)
  const recentLogs = current.log.slice(-10)
  broadcast({ type: 'settlement', results: recentLogs })

  for (const id of current.eliminatedIds) {
    if (!state.eliminatedIds.includes(id)) {
      broadcast({ type: 'elimination', characterId: id })
    }
  }
  for (const id of current.escapedIds) {
    if (!state.escapedIds.includes(id)) {
      broadcast({ type: 'escape', characterId: id })
    }
  }

  if (current.phase === 'game_over') {
    broadcast({
      type: 'game_over',
      winnerId: current.winnerId,
      reason: current.winnerId ? `${current.winnerId} escaped the island!` : 'All hope is lost.',
    })
    return current
  }

  current = advanceDay(current)
  broadcast({ type: 'day_start', day: current.day, merchantPrices: current.merchantPrices })
  broadcast({ type: 'state_update', state: current })

  return current
}

async function runAINegotiation(
  current: GameState,
  initiator: CharacterId,
  target: CharacterId,
  broadcast: SSEBroadcaster,
): Promise<GameState> {
  const targetChar = current.characters[target]
  if (!targetChar || !targetChar.alive || targetChar.escaped) return current

  const history: NegotiationMessage[] = []

  const opening = await getAITradeInitiation(current, initiator, target)
  const openingMsg: NegotiationMessage = {
    speaker: initiator,
    text: opening.text,
    proposal: opening.offer && opening.request
      ? { from: initiator, to: target, offer: opening.offer, request: opening.request }
      : undefined,
  }
  history.push(openingMsg)
  broadcast({ type: 'negotiation', message: openingMsg })

  let currentSpeaker = target
  let tradeAccepted = false

  for (let exchange = 1; exchange < GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES; exchange++) {
    const partner = currentSpeaker === target ? initiator : target
    const reply = await getNegotiationReply(current, currentSpeaker, partner, history)

    const replyMsg: NegotiationMessage = {
      speaker: currentSpeaker,
      text: reply.text,
      proposal: reply.offer && reply.request
        ? { from: currentSpeaker, to: partner, offer: reply.offer, request: reply.request }
        : undefined,
      accept: reply.accept,
    }
    history.push(replyMsg)
    broadcast({ type: 'negotiation', message: replyMsg })

    if (reply.accept) { tradeAccepted = true; break }
    if (reply.reject) break

    currentSpeaker = currentSpeaker === target ? initiator : target
  }

  if (tradeAccepted) {
    const lastProposal = [...history].reverse().find(m => m.proposal)?.proposal
    if (lastProposal) {
      const newState = executePeerTrade(current, lastProposal.from, lastProposal.to, lastProposal.offer, lastProposal.request)
      broadcast({ type: 'trade_result', success: true, from: lastProposal.from, to: lastProposal.to, summary: `Trade completed between ${lastProposal.from} and ${lastProposal.to}` })
      return newState
    }
  }

  broadcast({ type: 'trade_result', success: false, from: initiator, to: target, summary: `Negotiation between ${initiator} and ${target} failed.` })
  return current
}
