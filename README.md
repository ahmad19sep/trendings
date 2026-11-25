# Creator Trend Radar

Creator Trend Radar is a private, single-user research app for a Pakistan-based creator serving Urdu and Hindi audiences. It gathers real source signals, exposes a transparent 0–100 Contentability Score, compares markets, and tracks upcoming events. It does **not** generate ideas, scripts, hooks, captions, or posting plans.

The project follows a free-first rule. Paid and approval-gated integrations are off; see [`docs/paid-decisions.md`](docs/paid-decisions.md).

## What works now

- Protected Next.js 16 routes for trends, evidence, compare, upcoming/iCal, watchlists, bookmarks/CSV, digest archives, and settings.
- Argon2id login, signed/revocable sessions, rate-limited attempts, secure cookies, and both optimistic and data-layer authorization checks.
- SSRF-safe outbound fetching with DNS/IP validation on every redirect, timeout/size/type limits, and credential stripping.
- Live-tested parsers for Google Trends RSS, Google News RSS, and verified publisher feeds.
- Eight-component scoring with missing-value redistribution and provisional “Collecting history” behavior.
- PostgreSQL/pgvector Drizzle schema, raw-payload storage, idempotent upserts, source health, and exclusive `pg-boss` queues.
- Curated Pakistan events, truthful pre-buzz states, and RFC 5545 iCalendar output.
- Responsive light/dark UI, Urdu/Hindi font handling, visible keyboard focus, and no charts before real history exists.

Without PostgreSQL, the dashboard can show a labeled, non-persistent Pakistan Google Trends preview. Persistent history, clustering, digests, and alerts require the database and worker.

## Requirements

- Node.js 24 LTS or newer
- pnpm 12.23.0 through Corepack
- Docker Compose for local PostgreSQL
- PostgreSQL 18 with pgvector 0.8.7 for a manual database setup

The shared Supabase PostgreSQL database was migrated, seeded, and exercised with live ingestion, persisted queues, restart behavior, rollback-only retention/recovery acceptance tests, and graceful worker shutdown on 2026-11-25. Docker Compose remains available for an isolated local database.

## Local setup

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env.local
```

Generate two separate 32-byte secrets and an Argon2id password hash; copy the outputs to `SESSION_SECRET`, `APP_ENCRYPTION_KEY`, and `ADMIN_PASSWORD_HASH` in `.env.local`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
corepack pnpm auth:hash
```

Start and seed persistent storage. Seeding adds configuration and real calendar entries, never fake trends:

```powershell
docker compose up -d
corepack pnpm db:migrate
corepack pnpm db:seed
```

Run the web process and worker in separate terminals:

```powershell
corepack pnpm dev
corepack pnpm worker
```

For a manual ingestion pass:

```powershell
corepack pnpm ingest -- --once
```

Open `http://localhost:3000`. A temporary `AUTH_BYPASS_LOCAL=true` is available for local UI work and is hard-disabled in production.

## Verification

```powershell
corepack pnpm exec next typegen
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

The live database acceptance tests are explicit and rollback-only. With a configured `.env.local`, run:

```powershell
$env:RUN_DATABASE_ACCEPTANCE = "1"
node --env-file-if-exists=.env.local node_modules/vitest/vitest.mjs run src/worker/retention.acceptance.test.ts src/worker/recovery.acceptance.test.ts
```

Playwright acceptance coverage will run through `corepack pnpm test:e2e` once the database-backed test environment is added. Test-only XML never enters live ranking, digests, or exports.

## Free connectors

No-key sources are enabled in `.env.example`. These free sources still require Ahmad’s credential and remain off until provided:

- `YOUTUBE_API_KEY`
- `CRICKETDATA_API_KEY`
- `TMDB_API_TOKEN`
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

The RSS connectors and fixture-tested GDELT article discovery are implemented. GDELT timeline baselines/circuit breaking, YouTube, AlAdhan, Nager, CricketData, TMDB, Wikipedia/Wikidata, user ICS, Telegram delivery, multilingual clustering, digest generation, and persistent alert evaluation remain Phase 1 work. Current official constraints and honest implementation status are in [`docs/source-capabilities.md`](docs/source-capabilities.md).

## Project map

- `src/app`: protected pages, handlers, and login
- `src/lib/connectors`: connector contracts and free feed parsers
- `src/lib/http`: SSRF-safe fetcher
- `src/lib/scoring`: scoring formulas and redistribution
- `src/lib/upcoming`: events, pre-buzz, and iCalendar
- `src/db`: schema and database client
- `src/worker`: schedules, ingestion, health, and retention
- `config`: feeds, curated events, and verified limits
- `docs`: capabilities, scoring, AI modes, and paid decisions

The web server has no in-memory scheduler. `pg-boss` runs separately and stores jobs and locks in PostgreSQL.

## Production outline

The intended host is a private 2-vCPU/4-GB VPS running separate web and worker processes, PostgreSQL/pgvector, and Caddy for TLS. Set `NODE_ENV=production`, use long random secrets, keep PostgreSQL off the public network, and expose only HTTPS. `/api/health` currently requires a valid session.

Create a nightly encrypted/off-host database backup and test restoration regularly:

```bash
pg_dump --format=custom --file="trend-radar-$(date +%F).dump" "$DATABASE_URL"
```

## Non-negotiable data rules

- Demo fixtures require `DEMO_FIXTURES=true`, visible labels, and exclusion from rankings, digests, and exports. No demo trends are currently seeded.
- Missing is `null`, never an invented zero. Insufficient history yields a provisional score.
- YouTube metrics stay in Raw Signals and outside scoring unless audited permission allows derived use.
- Paid flags default to false and paid caps to zero.
- Provider text is untrusted. AI defaults off; see [`docs/ai-modes.md`](docs/ai-modes.md).

## Blockers before full Phase 1 acceptance

- A reviewed 100-item multilingual evaluation corpus, which was not supplied in the brief.
- Credentials for live verification of credentialed free integrations.
- Remaining connectors, cross-language clustering, digest/alert jobs, and Playwright coverage.

Do not start Phase 2 until the free acceptance suite passes and Ahmad explicitly approves an individual decision.

