import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Enums ─────────────────────────────────────────

export const cardStateEnum = pgEnum('card_state', [
  'new',
  'learning',
  'review',
  'relearning',
]);

export const importStatusEnum = pgEnum('import_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const importTypeEnum = pgEnum('import_type', [
  'anki_apkg',
  'csv',
  'tsv',
]);

export const apiKeyScopeEnum = pgEnum('api_key_scope', ['read', 'write']);

export const studyOrderEnum = pgEnum('study_order', [
  'due_date',
  'random',
  'added_order',
]);

// ── Tables ────────────────────────────────────────

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  fsrsRequestRetention: real('fsrs_request_retention').default(0.9).notNull(),
  fsrsMaximumInterval: integer('fsrs_maximum_interval')
    .default(36500)
    .notNull(),
  fsrsWeights: jsonb('fsrs_weights'),
  dailyNewCardLimit: integer('daily_new_card_limit').default(20).notNull(),
  dailyReviewLimit: integer('daily_review_limit').default(200).notNull(),
  studyOrder: studyOrderEnum('study_order').default('due_date').notNull(),
  defaultCardsPerGeneration: integer('default_cards_per_generation')
    .default(10)
    .notNull(),
});

export const decks = pgTable('decks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  coverColor: text('cover_color'),
  isPublic: boolean('is_public').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  // Content
  front: text('front').notNull(),
  back: text('back').notNull(),
  tags: text('tags').array(),
  sourceUrl: text('source_url'),
  note: text('note'),
  // FSRS scheduling fields
  due: timestamp('due', { withTimezone: true }).defaultNow().notNull(),
  stability: real('stability').default(0).notNull(),
  difficulty: real('difficulty').default(0).notNull(),
  elapsedDays: integer('elapsed_days').default(0).notNull(),
  scheduledDays: integer('scheduled_days').default(0).notNull(),
  reps: integer('reps').default(0).notNull(),
  lapses: integer('lapses').default(0).notNull(),
  state: cardStateEnum('state').default('new').notNull(),
  lastReview: timestamp('last_review', { withTimezone: true }),
  // Control
  isSuspended: boolean('is_suspended').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const reviewLogs = pgTable('review_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  cardId: uuid('card_id')
    .notNull()
    .references(() => cards.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  studySessionId: uuid('study_session_id').references(() => studySessions.id, {
    onDelete: 'set null',
  }),
  rating: integer('rating').notNull(), // 1-4 (Again, Hard, Good, Easy)
  state: cardStateEnum('state').notNull(), // state before review
  due: timestamp('due', { withTimezone: true }).notNull(),
  stability: real('stability').notNull(),
  difficulty: real('difficulty').notNull(),
  elapsedDays: integer('elapsed_days').notNull(),
  scheduledDays: integer('scheduled_days').notNull(),
  review: timestamp('review', { withTimezone: true }).notNull(),
});

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  newCount: integer('new_count').default(0).notNull(),
  reviewCount: integer('review_count').default(0).notNull(),
  lapseCount: integer('lapse_count').default(0).notNull(),
});

export const shareLinks = pgTable('share_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  token: uuid('token').defaultRandom().notNull().unique(),
  isActive: boolean('is_active').default(true).notNull(),
  viewCount: integer('view_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  deckId: uuid('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  type: importTypeEnum('type').notNull(),
  status: importStatusEnum('status').default('pending').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  cardCount: integer('card_count'),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const llmProviders = pgTable(
  'llm_providers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    provider: text('provider').notNull(),
    baseUrl: text('base_url').notNull(),
    apiKey: text('api_key').notNull(), // encrypted at app level
    model: text('model').notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('llm_providers_user_provider_idx').on(
      table.userId,
      table.provider
    ),
  ]
);

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull(),
  name: text('name').notNull(),
  scope: apiKeyScopeEnum('scope').default('read').notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Relations ─────────────────────────────────────

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [profiles.id],
    references: [userSettings.userId],
  }),
  decks: many(decks),
  cards: many(cards),
}));

export const decksRelations = relations(decks, ({ one, many }) => ({
  user: one(profiles, { fields: [decks.userId], references: [profiles.id] }),
  cards: many(cards),
  studySessions: many(studySessions),
  shareLinks: many(shareLinks),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  deck: one(decks, { fields: [cards.deckId], references: [decks.id] }),
  user: one(profiles, { fields: [cards.userId], references: [profiles.id] }),
  reviewLogs: many(reviewLogs),
}));

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  card: one(cards, {
    fields: [reviewLogs.cardId],
    references: [cards.id],
  }),
  session: one(studySessions, {
    fields: [reviewLogs.studySessionId],
    references: [studySessions.id],
  }),
}));

export const studySessionsRelations = relations(
  studySessions,
  ({ one, many }) => ({
    deck: one(decks, {
      fields: [studySessions.deckId],
      references: [decks.id],
    }),
    reviewLogs: many(reviewLogs),
  })
);
