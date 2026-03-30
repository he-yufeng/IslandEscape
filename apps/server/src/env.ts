import { config } from 'dotenv'
import { z } from 'zod'

config({ path: '../../.env' })

export const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  DB_FILE_NAME: z.string().default('file:local.db'),
  LOG_LEVEL: z.string().default('info'),
})

export const env = EnvSchema.parse(process.env)
