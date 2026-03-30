import { z } from 'zod'

export const GameCommandSchema = z.object({
  saveId: z.string().min(1),
  turn: z.number().int().min(1),
  input: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
})
export type GameCommand = z.infer<typeof GameCommandSchema>

export const AgentRunRequestSchema = z.object({
  command: GameCommandSchema,
  sessionId: z.string().min(1),
})
export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>

export const AgentStreamEventTypeSchema = z.enum([
  'token',
  'agent_step',
  'state_patch',
  'log',
  'completed',
  'error',
])

export const AgentStreamEventSchema = z.object({
  runId: z.string().min(1),
  type: AgentStreamEventTypeSchema,
  ts: z.string().datetime(),
  payload: z.unknown(),
})
export type AgentStreamEvent = z.infer<typeof AgentStreamEventSchema>

export const GameEventSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  ts: z.string().datetime(),
  data: z.record(z.string(), z.unknown()).default({}),
})
export type GameEvent = z.infer<typeof GameEventSchema>

export const GameStateSnapshotSchema = z.object({
  saveId: z.string().min(1),
  turn: z.number().int().min(0),
  stats: z.record(z.string(), z.number()),
  inventory: z.array(z.string()),
  flags: z.record(z.string(), z.boolean()),
  updatedAt: z.string().datetime(),
})
export type GameStateSnapshot = z.infer<typeof GameStateSnapshotSchema>

export const SaveSlotSummarySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  turn: z.number().int().min(0),
  updatedAt: z.string().datetime(),
})
export type SaveSlotSummary = z.infer<typeof SaveSlotSummarySchema>

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
})
export type ApiError = z.infer<typeof ApiErrorSchema>
