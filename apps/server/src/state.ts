import type { AgentStreamEvent, SaveSlotSummary } from '@game/shared'

export type RunState = {
  id: string
  events: AgentStreamEvent[]
  done: boolean
}

export const runs = new Map<string, RunState>()

export function toSaveSummary(input: {
  id: string
  label: string
  turn: number
  updatedAt: string
}): SaveSlotSummary {
  return {
    id: input.id,
    label: input.label,
    turn: input.turn,
    updatedAt: input.updatedAt,
  }
}
