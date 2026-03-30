import type { AgentRunRequest, AgentStreamEvent } from '@game/shared'

function nowIso() {
  return new Date().toISOString()
}

export async function runTurn(request: AgentRunRequest, runId: string): Promise<AgentStreamEvent[]> {
  const base = {
    runId,
    ts: nowIso(),
  }

  // Keep a deterministic local fallback stream so API + SSE remains testable without model keys.
  return [
    {
      ...base,
      type: 'log',
      payload: { message: 'run accepted', turn: request.command.turn },
    },
    {
      ...base,
      type: 'agent_step',
      payload: { name: 'narrator', status: 'thinking' },
    },
    {
      ...base,
      type: 'token',
      payload: { chunk: `You said: ${request.command.input}` },
    },
    {
      ...base,
      type: 'state_patch',
      payload: {
        turn: request.command.turn,
        stats: { morale: 1 },
      },
    },
    {
      ...base,
      type: 'completed',
      payload: { ok: true },
    },
  ]
}
