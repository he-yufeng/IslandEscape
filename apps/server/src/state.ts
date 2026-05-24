import type { GameState, GameSSEEvent, CharacterId, NegotiationMessage } from '@game/shared'
import type { ServerResponse } from 'node:http'

export type GameSession = {
  gameId: string
  state: GameState
  sseClients: Set<ServerResponse>
}

export const sessions = new Map<string, GameSession>()

/** Live negotiation state shared between routes (player-initiated) and runtime (AI-initiated). */
export interface ActiveNegotiation {
  conversationId: string
  /** The NPC partner from the player's perspective. */
  target: CharacterId
  messages: NegotiationMessage[]
}

export const negotiations = new Map<string, ActiveNegotiation>()

export function broadcastSSE(gameId: string, event: GameSSEEvent): void {
  const session = sessions.get(gameId)
  if (!session) return

  const data = JSON.stringify(event)
  for (const client of session.sseClients) {
    try {
      client.write(`data: ${data}\n\n`)
    } catch {
      session.sseClients.delete(client)
    }
  }
}
