CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "ai_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"task" text NOT NULL,
	"model" text NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_item_ids" uuid[] DEFAULT '{}' NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(12, 6),
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid,
	"rule" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"quiet_hours" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"topic_id" uuid,
	"event_id" uuid,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid,
	"event_id" uuid,
	"notes" text DEFAULT '' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"score_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "country_codes" (
	"iso2" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"fips" text,
	"woeid" text,
	"provider_codes" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"last_four" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"external_id" text,
	"error" text,
	"payload" jsonb NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_date" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"payload" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_evidence" (
	"event_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quoted_span" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_evidence_event_id_item_id_pk" PRIMARY KEY("event_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_key" text,
	"title" text NOT NULL,
	"title_ur" text,
	"title_hi" text,
	"category" text NOT NULL,
	"markets" text[] DEFAULT '{}' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Asia/Karachi' NOT NULL,
	"date_precision" text DEFAULT 'day' NOT NULL,
	"confidence" text NOT NULL,
	"source_ids" uuid[] DEFAULT '{}' NOT NULL,
	"source_urls" text[] DEFAULT '{}' NOT NULL,
	"evidence_item_ids" uuid[] DEFAULT '{}' NOT NULL,
	"recurrence" text,
	"created_by" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"pre_buzz_status" text,
	"pre_buzz_ratio" real,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_embeddings" (
	"item_id" uuid NOT NULL,
	"model" text NOT NULL,
	"dimensions" integer DEFAULT 1024 NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_embeddings_item_id_model_pk" PRIMARY KEY("item_id","model")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"connector" text NOT NULL,
	"external_id" text,
	"url" text NOT NULL,
	"canonical_url" text,
	"registrable_domain" text,
	"outlet_name" text,
	"publisher_country" text,
	"language" text DEFAULT 'unknown' NOT NULL,
	"language_detection_method" text,
	"script" text,
	"title_original" text NOT NULL,
	"title_en" text,
	"summary_original" text,
	"published_at" timestamp with time zone,
	"event_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"native_position" integer,
	"native_metric_name" text,
	"native_metric_value" numeric(24, 6),
	"native_metric_unit" text,
	"reporting_window" text,
	"trend_market" text,
	"story_locations" text[] DEFAULT '{}' NOT NULL,
	"target_audiences" text[] DEFAULT '{}' NOT NULL,
	"image_url" text,
	"is_syndicated_copy" boolean DEFAULT false NOT NULL,
	"origin" text DEFAULT 'live' NOT NULL,
	"parser_version" text NOT NULL,
	"retrieval_status" text DEFAULT 'ok' NOT NULL,
	"simhash" bigint,
	"content_hash" text,
	"raw_ref" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"first_failure_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "native_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"market" text,
	"metric_name" text NOT NULL,
	"metric_value" numeric(24, 6),
	"metric_raw" text,
	"unit" text,
	"position" integer,
	"list_length" integer,
	"fetched_at" timestamp with time zone NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_run_id" uuid,
	"source_id" uuid NOT NULL,
	"content_type" text,
	"body_compressed" text NOT NULL,
	"content_hash" text NOT NULL,
	"etag" text,
	"last_modified" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"reason" text NOT NULL,
	"evidence_ids" uuid[] DEFAULT '{}' NOT NULL,
	"method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"score" real NOT NULL,
	"provisional" boolean DEFAULT false NOT NULL,
	"collecting_history" boolean DEFAULT false NOT NULL,
	"breakdown" jsonb NOT NULL,
	"score_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"items_fetched" integer,
	"quota_cost" numeric(14, 4),
	"http_status" integer,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"phase" integer DEFAULT 1 NOT NULL,
	"access" text DEFAULT 'free' NOT NULL,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"supported_markets" text[] DEFAULT '{}' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error_at" timestamp with time zone,
	"last_error" text,
	"next_run_at" timestamp with time zone,
	"stale_after_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spend_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"task" text NOT NULL,
	"estimated_usd" numeric(12, 6) NOT NULL,
	"reported_usd" numeric(12, 6),
	"external_reference" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_items" (
	"topic_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"similarity" real,
	"match_method" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_items_topic_id_item_id_pk" PRIMARY KEY("topic_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "topic_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"distinct_outlets" integer DEFAULT 0 NOT NULL,
	"markets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_types" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title_original" text NOT NULL,
	"title_en" text,
	"title_ur" text,
	"title_hi" text,
	"primary_category" text NOT NULL,
	"secondary_categories" text[] DEFAULT '{}' NOT NULL,
	"trend_markets" text[] DEFAULT '{}' NOT NULL,
	"story_locations" text[] DEFAULT '{}' NOT NULL,
	"target_audiences" text[] DEFAULT '{}' NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"distinct_outlet_count" integer DEFAULT 0 NOT NULL,
	"platform_count" integer DEFAULT 0 NOT NULL,
	"is_social_origin_likely" boolean DEFAULT false NOT NULL,
	"social_origin_platform" text,
	"social_origin_cues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score_version" text DEFAULT 'v1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" jsonb NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text DEFAULT 'Ahmad' NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_watchlist_id_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_alert_rule_id_alert_rules_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_evidence" ADD CONSTRAINT "event_evidence_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_evidence" ADD CONSTRAINT "event_evidence_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_embeddings" ADD CONSTRAINT "item_embeddings_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_raw_ref_raw_payloads_id_fk" FOREIGN KEY ("raw_ref") REFERENCES "public"."raw_payloads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_signals" ADD CONSTRAINT "native_signals_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "native_signals" ADD CONSTRAINT "native_signals_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_payloads" ADD CONSTRAINT "raw_payloads_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_flags" ADD CONSTRAINT "risk_flags_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_items" ADD CONSTRAINT "topic_items_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_items" ADD CONSTRAINT "topic_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_snapshots" ADD CONSTRAINT "topic_snapshots_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_overrides" ADD CONSTRAINT "user_overrides_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_cache_expiry_idx" ON "ai_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "alerts_rule_topic_dedupe_idx" ON "alerts" USING btree ("alert_rule_id","topic_id","dedupe_until");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_topic_uq" ON "bookmarks" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_event_uq" ON "bookmarks" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credentials_key_uq" ON "credentials" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "digests_date_uq" ON "digests" USING btree ("digest_date");--> statement-breakpoint
CREATE UNIQUE INDEX "events_external_key_uq" ON "events" USING btree ("external_key");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "items_connector_external_uq" ON "items" USING btree ("connector","external_id");--> statement-breakpoint
CREATE INDEX "items_canonical_url_idx" ON "items" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "items_first_seen_idx" ON "items" USING btree ("first_seen_at");--> statement-breakpoint
CREATE INDEX "items_market_language_idx" ON "items" USING btree ("trend_market","language");--> statement-breakpoint
CREATE INDEX "login_attempts_locked_idx" ON "login_attempts" USING btree ("locked_until");--> statement-breakpoint
CREATE INDEX "native_signals_topic_time_idx" ON "native_signals" USING btree ("topic_id","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_payloads_source_hash_uq" ON "raw_payloads" USING btree ("source_id","content_hash");--> statement-breakpoint
CREATE INDEX "raw_payloads_expiry_idx" ON "raw_payloads" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "risk_flags_topic_idx" ON "risk_flags" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_topic_version_time_uq" ON "scores" USING btree ("topic_id","score_version","computed_at");--> statement-breakpoint
CREATE INDEX "scores_rank_idx" ON "scores" USING btree ("score","computed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "source_runs_source_started_idx" ON "source_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key_uq" ON "sources" USING btree ("key");--> statement-breakpoint
CREATE INDEX "spend_ledger_provider_time_idx" ON "spend_ledger" USING btree ("provider","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_snapshots_topic_time_uq" ON "topic_snapshots" USING btree ("topic_id","observed_at");--> statement-breakpoint
CREATE INDEX "topics_activity_idx" ON "topics" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "topics_category_idx" ON "topics" USING btree ("primary_category");--> statement-breakpoint
CREATE UNIQUE INDEX "user_overrides_topic_field_uq" ON "user_overrides" USING btree ("topic_id","field");
