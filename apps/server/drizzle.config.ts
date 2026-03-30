import { defineConfig } from 'drizzle-kit'

const dbFileName = process.env.DB_FILE_NAME ?? 'file:local.db'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbFileName,
  },
})
