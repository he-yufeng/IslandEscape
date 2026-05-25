import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const shouldOverrideEnv = process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true'
const rootEnvPath = fileURLToPath(new URL('../../../.env', import.meta.url))
config({ path: rootEnvPath, override: shouldOverrideEnv })

export const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().default('deepseek/deepseek-chat'),
  DB_FILE_NAME: z.string().default('file:local.db'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.string().default('info'),
})

export const env = EnvSchema.parse(process.env)
console.log('[env] OPENAI_MODEL =', env.OPENAI_MODEL)
console.log('[env] OPENAI_BASE_URL =', env.OPENAI_BASE_URL)
