# Project handoff

Updated: 2026-11-25, Asia/Karachi

This file preserves working context across Codex or ChatGPT accounts and
sessions. Read it before making changes and update it after substantial work.
Keep secrets in `.env.local`; never copy credentials, connection strings, or
passwords into this file.

## Current state

- The app uses the PostgreSQL protocol through Supabase's shared session pooler
  via `DATABASE_URL`; it does not use Supabase client API keys.
- The replacement Supabase database connection was verified with live queries.
- Drizzle migration `0000_broken_naoko` was applied successfully. The database
  has the expected 30 public application tables and the `vector` extension.
- Baseline seeding completed successfully: 4 settings, 6 country mappings, 25
  source definitions, and 14 curated events. No fake trend fixtures were added.
- Live one-shot and scheduled catch-up ingestion have completed. GDELT's
  untyped HTTP 429 was reproduced end to end: the current code records
  `http_status = 429`, retains the bounded raw response, and applies a minimum
  six-second fallback delay.
- The six application queues and six Asia/Karachi schedules are persisted in
  pg-boss. Real TTY/SIGINT shutdown now waits for active handlers before
  closing either pg-boss or the Drizzle pool. No worker process is left running.
- Rollback-only live acceptance tests pass for all six retention categories,
  bookmark `ON DELETE SET NULL`, and stale-source-run reconciliation.
- The current verified snapshot is 1,185 items, 75 raw payloads, 1,022 topics,
  and 1,173 topic-item links, with zero `running` source runs.
- This worktree is intentionally dirty and has not been committed. Preserve the
  changes listed below when resuming.

## Completed on 2026-11-24

1. Validated the new Supabase session-pooler URL shape.
2. Confirmed authentication and a live PostgreSQL query.
3. Applied the repository's existing additive migration.
4. Seeded and verified the new database.
5. Added this cross-account continuity record.

## Completed on 2026-11-25

1. Ran the full one-shot ingestion from 23:19 to 23:49 Asia/Karachi:
   - Google Trends: 6/6 sources succeeded, 60 items processed.
   - Google News: 4/4 succeeded, 140 items processed.
   - Publisher tier 1: 8/8 succeeded, 356 items processed.
   - Publisher tier 2: 3/3 succeeded, 120 items processed.
   - GDELT: Urdu and Hindi completed with zero items after retries; Pakistan and
     India failed after four attempts each.
2. Verified the first-pass persistence snapshot: 783 unique items, 34 raw
   payloads, 704 topics, and 771 topic-item links. There were no unfinished
   source runs. These counts predate the later Google Trends queue acceptance
   job and are not claimed as the current exact totals.
3. Diagnosed GDELT directly. Its failing response was HTTP 429 with no
   `Content-Type` and a provider message requiring at least five seconds between
   requests. The old code masked that as a media-type error.
4. Started the real worker long enough to create and verify all six exclusive
   queues and all six schedules, then stopped it before a cron boundary.
5. Verified persisted queue/restart behavior with tracked Google Trends job
   `c87ea7c4-c7fb-4502-82c4-c9429005d930`: it remained `created` while the
   worker was down, completed after restart, processed all six markets, and had
   zero pg-boss retries.
6. Added uncommitted fixes and tests for:
   - atomic raw/item/topic/source-success persistence inside one transaction;
   - untyped HTTP error bodies so GDELT 429 is surfaced and retained safely;
   - a six-second minimum fallback delay for 429 responses without Retry-After;
   - deterministic pg-boss plus Drizzle-pool shutdown and startup-failure cleanup;
   - startup reconciliation of source runs left `running` for more than 30 minutes;
   - automatic `.env.local` loading for migrate, seed, worker, and ingest scripts.
7. Reviewed the uncommitted implementation and fixed two additional provenance
   and lifecycle defects:
   - successful items now reference the successful response after a retained
     429 retry instead of the earlier error payload;
   - pg-boss is force-cleaned after partial startup failure without masking the
     original error.
8. Added and live-ran rollback-only database acceptance tests for retention and
   stale-run recovery. They exposed and verified fixes for PostgreSQL's
   ambiguous JSON parameter type and session-pooler timestamp strings.
9. Exercised GDELT again through the real worker. Successful live responses and
   upstream transport failures were observed, followed by reproduced 429s for
   Pakistan and Hindi. The latest verified Pakistan run is `error`,
   `http_status = 429`, `error_code = ConnectorHttpError`, four attempts, and
   one retained raw payload.
10. Exercised real TTY/SIGINT shutdown. The first pass exposed pg-boss returning
    after its 30-second grace while ingestion handlers were still active; that
    closed the app pool too early. Active work is now tracked, the graceful
    window matches the 20-minute queue expiry plus ten-minute recovery grace,
    and the second pass drained every handler without a database-close error.
11. Reconciled the two exact source runs interrupted by the first shutdown test
    as `ProcessInterrupted`, then verified zero unfinished source runs.
12. Updated stale live-database claims in `README.md` and the GDELT capability
    row in `docs/source-capabilities.md`.
13. Final gates pass: TypeScript typecheck, warning-free lint, 20 test files and
    142 tests passed (the two live acceptance files / two tests skip unless
    explicitly enabled), the 14-page production build, and `git diff --check`.

## Known live-data issue

- A previous interrupted `google-news-rss:en-US` run left exactly 12 item rows
  without `topic_items` links. Provenance was verified: every row points through
  `raw_ref` to the failed source run with `error_code = ProcessInterrupted`.
- Do not broadly delete unlinked items. If Ahmad approves cleanup, target only
  those failed-run residues and preserve their raw payload for the normal
  seven-day audit window. The current atomic-ingestion change prevents the same
  partial-write pattern on future failures.

## Uncommitted implementation

- Pre-existing continuity changes: `AGENTS.md` and this handoff file.
- Runtime/config: `package.json`.
- Fetch/rate-limit handling: `src/lib/http/safe-fetch.ts`,
  `src/worker/http-client.ts`, and their tests.
- Atomic ingestion: `src/worker/ingestion.ts`, `persistence.ts`,
  `topic-pipeline.ts`, and `ingestion.test.ts`.
- Worker recovery/shutdown: `src/worker/recovery.ts`, `recovery.test.ts`,
  `recovery.acceptance.test.ts`, `retention.ts`,
  `retention.acceptance.test.ts`, `runner.ts`, `runner.test.ts`, `shutdown.ts`,
  `shutdown.test.ts`, `schedules.ts`, and `index.ts`.
- Truthful project status: `README.md` and `docs/source-capabilities.md`.
- No migration was added and no commit was created.

## Resume from here

1. Begin with `git status --short`, review the complete uncommitted diff, and
   commit the continuity files with the implementation when Ahmad is ready.
2. Ask Ahmad before deleting the 12 known failed-run orphan items. The final
   provenance check still finds exactly those 12 and no other unlinked items.
3. Continue the documented Phase 1 backlog: unfinished free connectors,
   multilingual clustering, digest generation, persistent alert evaluation,
   and database-backed Playwright coverage.
4. Complete the free Phase 1 acceptance suite before starting Phase 2. Phase 2
   remains off until Ahmad explicitly approves an individual paid decision.

The detailed backlog and constraints remain in `README.md`,
`docs/source-capabilities.md`, and `docs/paid-decisions.md`.

## Safe operating notes

- Start with `git status --short` and preserve unrelated user changes.
- The updated package scripts load `.env.local` with Node's
  `--env-file-if-exists` option. For ad-hoc commands, continue loading it
  explicitly.
- In this restricted Codex Windows sandbox, `tsx` may fail in `os.userInfo()`.
  The proven temporary launcher prefix is
  `node --env-file=.env.local --import "data:text/javascript,process.geteuid=()=>0" --import tsx`.
- Database and public-feed access requires the approved network escalation in
  this sandbox. Never echo the connection string.
- The rollback-only live tests require `RUN_DATABASE_ACCEPTANCE=1`; the exact
  command is documented in `README.md`.
- Do not print `DATABASE_URL` or other secrets in command output or handoff
  notes.
- Update the date, current state, completed work, and resume point here before
  ending a substantial work session.
