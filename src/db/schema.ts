import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

import type { ScoreBreakdownRow } from "../lib/scoring/types";

type JsonObject = Record<string, unknown>;

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull().default("Ahmad"),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uq").on(table.tokenHash),
    index("sessions_user_expires_idx").on(table.userId, table.expiresAt),
  ],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    key: text("key").primaryKey(),
    failures: integer("failures").notNull().default(0),
    firstFailureAt: timestamp("first_failure_at", { withTimezone: true }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (table) => [index("login_attempts_locked_idx").on(table.lockedUntil)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<JsonObject>().notNull(),
  updatedAt: updatedAt(),
});

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    lastFour: text("last_four").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("credentials_key_uq").on(table.key)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    phase: integer("phase").notNull().default(1),
    access: text("access").notNull().default("free"),
    capabilities: jsonb("capabilities").$type<JsonObject>().notNull().default({}),
    supportedMarkets: text("supported_markets").array().notNull().default([]),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    lastError: text("last_error"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    staleAfterMinutes: integer("stale_after_minutes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("sources_key_uq").on(table.key)],
);

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    itemsFetched: integer("items_fetched"),
    quotaCost: numeric("quota_cost", { precision: 14, scale: 4 }),
    httpStatus: integer("http_status"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
  },
  (table) => [
    index("source_runs_source_started_idx").on(table.sourceId, table.startedAt),
  ],
);

export const rawPayloads = pgTable(
  "raw_payloads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceRunId: uuid("source_run_id").references(() => sourceRuns.id, {
      onDelete: "set null",
    }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    contentType: text("content_type"),
    bodyCompressed: text("body_compressed").notNull(),
    contentHash: text("content_hash").notNull(),
    etag: text("etag"),
    lastModified: text("last_modified"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("raw_payloads_source_hash_uq").on(
      table.sourceId,
      table.contentHash,
    ),
    index("raw_payloads_expiry_idx").on(table.expiresAt),
  ],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    connector: text("connector").notNull(),
    externalId: text("external_id"),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    registrableDomain: text("registrable_domain"),
    outletName: text("outlet_name"),
    publisherCountry: text("publisher_country"),
    language: text("language").notNull().default("unknown"),
    languageDetectionMethod: text("language_detection_method"),
    script: text("script"),
    titleOriginal: text("title_original").notNull(),
    titleEn: text("title_en"),
    summaryOriginal: text("summary_original"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    eventAt: timestamp("event_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    nativePosition: integer("native_position"),
    nativeMetricName: text("native_metric_name"),
    nativeMetricValue: numeric("native_metric_value", {
      precision: 24,
      scale: 6,
    }),
    nativeMetricUnit: text("native_metric_unit"),
    reportingWindow: text("reporting_window"),
    trendMarket: text("trend_market"),
    storyLocations: text("story_locations").array().notNull().default([]),
    targetAudiences: text("target_audiences").array().notNull().default([]),
    imageUrl: text("image_url"),
    isSyndicatedCopy: boolean("is_syndicated_copy").notNull().default(false),
    origin: text("origin").notNull().default("live"),
    parserVersion: text("parser_version").notNull(),
    retrievalStatus: text("retrieval_status").notNull().default("ok"),
    simhash: bigint("simhash", { mode: "bigint" }),
    contentHash: text("content_hash"),
    rawRef: uuid("raw_ref").references(() => rawPayloads.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("items_connector_external_uq").on(
      table.connector,
      table.externalId,
    ),
    index("items_canonical_url_idx").on(table.canonicalUrl),
    index("items_first_seen_idx").on(table.firstSeenAt),
    index("items_market_language_idx").on(table.trendMarket, table.language),
  ],
);

export const itemEmbeddings = pgTable(
  "item_embeddings",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull().default(1024),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.model] })],
);

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    titleOriginal: text("title_original").notNull(),
    titleEn: text("title_en"),
    titleUr: text("title_ur"),
    titleHi: text("title_hi"),
    primaryCategory: text("primary_category").notNull(),
    secondaryCategories: text("secondary_categories").array().notNull().default([]),
    trendMarkets: text("trend_markets").array().notNull().default([]),
    storyLocations: text("story_locations").array().notNull().default([]),
    targetAudiences: text("target_audiences").array().notNull().default([]),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("active"),
    distinctOutletCount: integer("distinct_outlet_count").notNull().default(0),
    platformCount: integer("platform_count").notNull().default(0),
    isSocialOriginLikely: boolean("is_social_origin_likely")
      .notNull()
      .default(false),
    socialOriginPlatform: text("social_origin_platform"),
    socialOriginCues: jsonb("social_origin_cues").$type<JsonObject[]>().notNull().default([]),
    scoreVersion: text("score_version").notNull().default("v1"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("topics_activity_idx").on(table.lastActivityAt),
    index("topics_category_idx").on(table.primaryCategory),
  ],
);

export const topicItems = pgTable(
  "topic_items",
  {
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    similarity: real("similarity"),
    matchMethod: text("match_method").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.topicId, table.itemId] })],
);

export const topicSnapshots = pgTable(
  "topic_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    mentionCount: integer("mention_count").notNull().default(0),
    distinctOutlets: integer("distinct_outlets").notNull().default(0),
    markets: jsonb("markets").$type<JsonObject>().notNull().default({}),
    sourceTypes: jsonb("source_types").$type<JsonObject>().notNull().default({}),
  },
  (table) => [
    uniqueIndex("topic_snapshots_topic_time_uq").on(
      table.topicId,
      table.observedAt,
    ),
  ],
);

export const nativeSignals = pgTable(
  "native_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    market: text("market"),
    metricName: text("metric_name").notNull(),
    metricValue: numeric("metric_value", { precision: 24, scale: 6 }),
    metricRaw: text("metric_raw"),
    unit: text("unit"),
    position: integer("position"),
    listLength: integer("list_length"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    metadata: jsonb("metadata").$type<JsonObject>().notNull().default({}),
  },
  (table) => [index("native_signals_topic_time_idx").on(table.topicId, table.fetchedAt)],
);

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    provisional: boolean("provisional").notNull().default(false),
    collectingHistory: boolean("collecting_history").notNull().default(false),
    breakdown: jsonb("breakdown").$type<ScoreBreakdownRow[]>().notNull(),
    scoreVersion: text("score_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("scores_topic_version_time_uq").on(
      table.topicId,
      table.scoreVersion,
      table.computedAt,
    ),
    index("scores_rank_idx").on(table.score, table.computedAt),
  ],
);

export const aiCalls = pgTable("ai_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  task: text("task").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputItemIds: uuid("input_item_ids").array().notNull().default([]),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

export const aiCache = pgTable(
  "ai_cache",
  {
    key: text("key").primaryKey(),
    task: text("task").notNull(),
    model: text("model").notNull(),
    value: jsonb("value").$type<JsonObject>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("ai_cache_expiry_idx").on(table.expiresAt)],
);

export const riskFlags = pgTable(
  "risk_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    reason: text("reason").notNull(),
    evidenceIds: uuid("evidence_ids").array().notNull().default([]),
    method: text("method").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("risk_flags_topic_idx").on(table.topicId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalKey: text("external_key"),
    title: text("title").notNull(),
    titleUr: text("title_ur"),
    titleHi: text("title_hi"),
    category: text("category").notNull(),
    markets: text("markets").array().notNull().default([]),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    allDay: boolean("all_day").notNull().default(false),
    timezone: text("timezone").notNull().default("Asia/Karachi"),
    datePrecision: text("date_precision").notNull().default("day"),
    confidence: text("confidence").notNull(),
    sourceIds: uuid("source_ids").array().notNull().default([]),
    sourceUrls: text("source_urls").array().notNull().default([]),
    evidenceItemIds: uuid("evidence_item_ids").array().notNull().default([]),
    recurrence: text("recurrence"),
    createdBy: text("created_by").notNull(),
    status: text("status").notNull().default("scheduled"),
    preBuzzStatus: text("pre_buzz_status"),
    preBuzzRatio: real("pre_buzz_ratio"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("events_external_key_uq").on(table.externalKey),
    index("events_starts_at_idx").on(table.startsAt),
  ],
);

export const eventEvidence = pgTable(
  "event_evidence",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    quotedSpan: text("quoted_span"),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.itemId] })],
);

export const countryCodes = pgTable("country_codes", {
  iso2: text("iso2").primaryKey(),
  name: text("name").notNull(),
  fips: text("fips"),
  woeid: text("woeid"),
  providerCodes: jsonb("provider_codes").$type<JsonObject>().notNull().default({}),
});

export const watchlists = pgTable("watchlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(),
  value: text("value").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  watchlistId: uuid("watchlist_id").references(() => watchlists.id, {
    onDelete: "cascade",
  }),
  rule: jsonb("rule").$type<JsonObject>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  quietHours: jsonb("quiet_hours").$type<JsonObject>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alertRuleId: uuid("alert_rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "cascade",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "cascade",
    }),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
    dedupeUntil: timestamp("dedupe_until", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("alerts_rule_topic_dedupe_idx").on(
      table.alertRuleId,
      table.topicId,
      table.dedupeUntil,
    ),
  ],
);

export const deliveries = pgTable("deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  channel: text("channel").notNull(),
  status: text("status").notNull(),
  externalId: text("external_id"),
  error: text("error"),
  payload: jsonb("payload").$type<JsonObject>().notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    eventId: uuid("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    notes: text("notes").notNull().default(""),
    tags: text("tags").array().notNull().default([]),
    scoreSnapshot: jsonb("score_snapshot").$type<JsonObject>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("bookmarks_topic_uq").on(table.topicId),
    uniqueIndex("bookmarks_event_uq").on(table.eventId),
  ],
);

export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  filters: jsonb("filters").$type<JsonObject>().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    digestDate: text("digest_date").notNull(),
    timezone: text("timezone").notNull().default("Asia/Karachi"),
    payload: jsonb("payload").$type<JsonObject>().notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("digests_date_uq").on(table.digestDate)],
);

export const spendLedger = pgTable(
  "spend_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    task: text("task").notNull(),
    estimatedUsd: numeric("estimated_usd", { precision: 12, scale: 6 }).notNull(),
    reportedUsd: numeric("reported_usd", { precision: 12, scale: 6 }),
    externalReference: text("external_reference"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("spend_ledger_provider_time_idx").on(table.provider, table.occurredAt)],
);

export const userOverrides = pgTable(
  "user_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: jsonb("value").$type<JsonObject>().notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("user_overrides_topic_field_uq").on(table.topicId, table.field)],
);

