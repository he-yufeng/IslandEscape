import { config } from 'dotenv'
import { z } from 'zod'

config({ path: '../../.env' })

export const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().default('deepseek/deepseek-chat'),
  DB_FILE_NAME: z.string().default('file:local.db'),
  LOG_LEVEL: z.string().default('info'),
})

export const env = EnvSchema.parse(process.env)
console.log('[env] OPENAI_MODEL =', env.OPENAI_MODEL)
console.log('[env] OPENAI_BASE_URL =', env.OPENAI_BASE_URL)
