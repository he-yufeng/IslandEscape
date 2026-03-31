import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { PlayerActionSchema, type GameState, type CharacterId, type NegotiationMessage, GAME_CONFIG } from '@game/shared'

import { createNewGame, startDay, applyPlayerAction, executePeerTrade } from '../engine/game'
import { runAITurns, type SSEBroadcaster } from '../agents/runtime'
import { getNegotiationReply } from '../agents/negotiation-agent'
import { sessions, broadcastSSE } from '../state'
import { db } from '../db/client'
import { games } from '../db/schema'
import { eq } from 'drizzle-orm'

// Active negotiations: gameId -> negotiation state
interface ActiveNegotiation {
  conversationId: string
  target: CharacterId
  messages: NegotiationMessage[]
}
const negotiations = new Map<string, ActiveNegotiation>()

async function persistGame(gameId: string, state: GameState): Promise<void> {
  const now = new Date().toISOString()
  await db
    .insert(games)
    .values({ id: gameId, state: state as unknown as string, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: games.id,
      set: { state: state as unknown as string, updatedAt: now },
    })
}

function updateCharacterTradeSlot(state: GameState, charId: CharacterId): GameState {
  const c = state.characters[charId]
  if (!c || c.tradeSlots <= 0) return state
  return {
    ...state,
    characters: {
      ...state.characters,
      [charId]: { ...c, tradeSlots: c.tradeSlots - 1 },
    },
    updatedAt: new Date().toISOString(),
  }
}

const routes: FastifyPluginAsync = async (fastify) => {
  // Create new game
  fastify.post('/api/games', async (_request, reply) => {
    const gameId = randomUUID()
    let state = createNewGame(gameId)
    state = startDay(state)

    sessions.set(gameId, { gameId, state, sseClients: new Set() })
    await persistGame(gameId, state)

    return reply.send({ gameId, state })
  })

  // Get current game state
  fastify.get('/api/games/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const session = sessions.get(id)
    if (session) {
      return reply.send({ state: session.state })
    }

    const row = await db.query.games.findFirst({ where: eq(games.id, id) })
    if (!row) {
      return reply.status(404).send({ code: 'GAME_NOT_FOUND', message: 'Game not found' })
    }

    const state = row.state as unknown as GameState
    sessions.set(id, { gameId: id, state, sseClients: new Set() })
    return reply.send({ state })
  })

  // Player action
  fastify.post('/api/games/:id/action', async (request, reply) => {
    const { id } = request.params as { id: string }
    const session = sessions.get(id)
    if (!session) {
      return reply.status(404).send({ code: 'GAME_NOT_FOUND', message: 'Game not found' })
    }

    const parsed = PlayerActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        code: 'INVALID_ACTION',
        message: 'Invalid player action',
        details: parsed.error.flatten(),
      })
    }

    const action = parsed.data

    try {
      // Handle trade_peer: start negotiation with NPC
      if (action.type === 'trade_peer') {
        const player = session.state.characters.player
        if (!player || player.tradeSlots <= 0) {
          return reply.status(400).send({ code: 'NO_TRADE_SLOTS', message: 'No trade slots remaining' })
        }

        // Deduct trade slot
        session.state = updateCharacterTradeSlot(session.state, 'player')

        const convId = randomUUID()
        const playerMsg: NegotiationMessage = {
          speaker: 'player',
          text: action.message,
        }

        const negotiation: ActiveNegotiation = {
          conversationId: convId,
          target: action.target,
          messages: [playerMsg],
        }
        negotiations.set(id, negotiation)

        // Get NPC reply from LLM
        const npcReply = await getNegotiationReply(
          session.state,
          action.target,
          'player',
          negotiation.messages,
        )

        const npcMsg: NegotiationMessage = {
          speaker: action.target,
          text: npcReply.text,
          proposal: npcReply.offer && npcReply.request
            ? { from: action.target, to: 'player', offer: npcReply.offer, request: npcReply.request }
            : undefined,
          accept: npcReply.accept,
        }
        negotiation.messages.push(npcMsg)

        // Broadcast both messages
        broadcastSSE(id, { type: 'negotiation', message: playerMsg })
        broadcastSSE(id, { type: 'negotiation', message: npcMsg })

        // If NPC immediately accepted
        if (npcReply.accept && npcMsg.proposal) {
          session.state = executePeerTrade(
            session.state, npcMsg.proposal.from, npcMsg.proposal.to,
            npcMsg.proposal.offer, npcMsg.proposal.request,
          )
          negotiations.delete(id)
          broadcastSSE(id, { type: 'trade_result', success: true, from: 'player', to: action.target, summary: `Trade completed with ${action.target}!` })
        }

        broadcastSSE(id, { type: 'state_update', state: session.state })
        await persistGame(id, session.state)

        return reply.send({
          state: session.state,
          negotiation: {
            conversationId: convId,
            messages: negotiation.messages,
          },
        })
      }

      // Handle negotiate_reply: continue conversation
      if (action.type === 'negotiate_reply') {
        const negotiation = negotiations.get(id)
        if (!negotiation) {
          return reply.status(400).send({ code: 'NO_NEGOTIATION', message: 'No active negotiation' })
        }

        const playerMsg: NegotiationMessage = {
          speaker: 'player',
          text: action.message,
          accept: action.accept,
        }
        negotiation.messages.push(playerMsg)
        broadcastSSE(id, { type: 'negotiation', message: playerMsg })

        // If player accepted, find the last proposal and execute
        if (action.accept) {
          const lastProposal = [...negotiation.messages].reverse().find(m => m.proposal)?.proposal
          if (lastProposal) {
            session.state = executePeerTrade(
              session.state, lastProposal.from, lastProposal.to,
              lastProposal.offer, lastProposal.request,
            )
            broadcastSSE(id, { type: 'trade_result', success: true, from: 'player', to: negotiation.target, summary: `Trade completed with ${negotiation.target}!` })
          }
          negotiations.delete(id)
          broadcastSSE(id, { type: 'state_update', state: session.state })
          await persistGame(id, session.state)
          return reply.send({ state: session.state, negotiationDone: true })
        }

        // Check if max exchanges reached
        if (negotiation.messages.length >= GAME_CONFIG.MAX_NEGOTIATION_EXCHANGES * 2) {
          negotiations.delete(id)
          broadcastSSE(id, { type: 'trade_result', success: false, from: 'player', to: negotiation.target, summary: 'Negotiation failed - too many exchanges.' })
          return reply.send({ state: session.state, negotiationDone: true })
        }

        // Get NPC reply
        const npcReply = await getNegotiationReply(
          session.state,
          negotiation.target,
          'player',
          negotiation.messages,
        )

        const npcMsg: NegotiationMessage = {
          speaker: negotiation.target,
          text: npcReply.text,
          proposal: npcReply.offer && npcReply.request
            ? { from: negotiation.target, to: 'player', offer: npcReply.offer, request: npcReply.request }
            : undefined,
          accept: npcReply.accept,
        }
        negotiation.messages.push(npcMsg)
        broadcastSSE(id, { type: 'negotiation', message: npcMsg })

        // If NPC accepted
        if (npcReply.accept) {
          const lastProposal = [...negotiation.messages].reverse().find(m => m.proposal)?.proposal
          if (lastProposal) {
            session.state = executePeerTrade(
              session.state, lastProposal.from, lastProposal.to,
              lastProposal.offer, lastProposal.request,
            )
            broadcastSSE(id, { type: 'trade_result', success: true, from: 'player', to: negotiation.target, summary: `Trade completed with ${negotiation.target}!` })
          }
          negotiations.delete(id)
        }

        // If NPC rejected
        if (npcReply.reject) {
          negotiations.delete(id)
          broadcastSSE(id, { type: 'trade_result', success: false, from: 'player', to: negotiation.target, summary: `${negotiation.target} rejected the deal.` })
        }

        broadcastSSE(id, { type: 'state_update', state: session.state })
        await persistGame(id, session.state)

        return reply.send({
          state: session.state,
          negotiation: {
            conversationId: negotiation.conversationId,
            messages: negotiation.messages,
          },
          negotiationDone: !negotiations.has(id),
        })
      }

      // Handle other actions (fish, farm, trade_merchant, end_turn)
      session.state = applyPlayerAction(session.state, action)
      broadcastSSE(id, { type: 'state_update', state: session.state })

      if (action.type === 'end_turn') {
        const broadcast: SSEBroadcaster = (event) => broadcastSSE(id, event)
        runAITurns(session.state, broadcast).then(async (newState) => {
          session.state = newState
          await persistGame(id, newState)
        }).catch((err) => {
          console.error('AI turns error:', err)
          broadcastSSE(id, { type: 'error', message: 'AI turns failed' })
        })
      }

      await persistGame(id, session.state)
      return reply.send({ state: session.state })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return reply.status(400).send({ code: 'ACTION_FAILED', message })
    }
  })

  // SSE stream
  fastify.get('/api/games/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string }
    const session = sessions.get(id)
    if (!session) {
      return reply.status(404).send({ code: 'GAME_NOT_FOUND', message: 'Game not found' })
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    })

    const stateEvent = JSON.stringify({ type: 'state_update', state: session.state })
    reply.raw.write(`data: ${stateEvent}\n\n`)

    session.sseClients.add(reply.raw)

    request.raw.on('close', () => {
      session.sseClients.delete(reply.raw)
    })
  })
}

export default routes
