import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  spotifyId: varchar('spotify_id', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  avatarUrl: text('avatar_url'),
  country: varchar('country', { length: 10 }),
  spotifyProduct: varchar('spotify_product', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const tokens = pgTable(
  'tokens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token').notNull(), // AES-256-GCM encrypted
    refreshToken: text('refresh_token').notNull(), // AES-256-GCM encrypted
    expiresAt: timestamp('expires_at').notNull(),
    scope: text('scope'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: uniqueIndex('tokens_user_id_unique').on(table.userId),
  })
)

export const spotifyCache = pgTable(
  'spotify_cache',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cacheKey: varchar('cache_key', { length: 200 }).notNull(),
    data: jsonb('data').notNull(),
    cachedAt: timestamp('cached_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    lookupIdx: index('spotify_cache_lookup_idx').on(table.userId, table.cacheKey, table.expiresAt),
    uniqueEntry: uniqueIndex('spotify_cache_user_key_unique').on(table.userId, table.cacheKey),
  })
)

export const aiCache = pgTable(
  'ai_cache',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cacheType: varchar('cache_type', { length: 100 }).notNull(),
    content: text('content').notNull(),
    model: varchar('model', { length: 100 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => ({
    uniqueEntry: uniqueIndex('ai_cache_user_type_unique').on(table.userId, table.cacheType),
  })
)

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Token = typeof tokens.$inferSelect
export type SpotifyCache = typeof spotifyCache.$inferSelect
export type AiCache = typeof aiCache.$inferSelect
