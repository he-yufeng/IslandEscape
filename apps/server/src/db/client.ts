import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

import { env } from '../env'
import * as schema from './schema'

const client = createClient({
  url: env.DB_FILE_NAME,
})

export const db = drizzle(client, { schema })

export async function ensureSchema() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      turn INTEGER NOT NULL DEFAULT 0,
      snapshot TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}
