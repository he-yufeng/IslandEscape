import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const saves = sqliteTable('saves', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  turn: integer('turn').notNull().default(0),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  state: text('state', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
