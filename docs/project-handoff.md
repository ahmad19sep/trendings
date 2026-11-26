# Project handoff

Updated: 2026-11-26, Asia/Karachi

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
- The production web app is deployed at
  `https://trendings-gamma.vercel.app` against the existing Supabase database.
  Vercel deployment protection/SSO is still enabled, so visitors must first be
  authorized by Vercel and then use the app's own login.
- This is a web-only deployment. The persistent pg-boss worker is not hosted on
  Vercel and remains stopped, so scheduled ingestion requires a separate
  always-on worker host.
- The production `ADMIN_PASSWORD_HASH` was regenerated through a masked local
  prompt, uploaded as a Vercel secret, and verified without exposing the
  password or hash. The subsequent production sign-in succeeded and
  bootstrapped the database administrator.
- The production dashboard now loads its 25 topic cards with four batched
  database reads instead of 76 sequential reads. Vercel functions are pinned
  to Tokyo (`hnd1`) beside the Supabase pooler, and the runtime is pinned to
  Node 24. The optimized deployment is READY at the production URL.
- The dashboard now selects from a recent 250-topic window and prioritizes
  English/Latin titles, then Urdu/Arabic, with Hindi as a fallback. English or
  deterministic Romanized text is the primary display, while the untouched
  source headline remains labeled as `Original`. Romanization is not claimed as
  translation and uses no paid service.
- The hardened ingestion and worker lifecycle implementation is committed and
  pushed to `origin/main` as `5682a28`.

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
6. Added fixes and tests for:
   - atomic raw/item/topic/source-success persistence inside one transaction;
   - untyped HTTP error bodies so GDELT 429 is surfaced and retained safely;
   - a six-second minimum fallback delay for 429 responses without Retry-After;
   - deterministic pg-boss plus Drizzle-pool shutdown and startup-failure cleanup;
   - startup reconciliation of source runs left `running` for more than 30 minutes;
   - automatic `.env.local` loading for migrate, seed, worker, and ingest scripts.
7. Reviewed the implementation and fixed two additional provenance
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
13. Final gates pass: TypeScript typecheck, lint with three unused-parameter
    warnings in `src/worker/runner.test.ts`, 20 test files and 142 tests passed
    (the two live acceptance files / two tests skip unless explicitly enabled),
    the 14-page production build, and `git diff --check`.
14. Deployed the web app to Vercel at
    `https://trendings-gamma.vercel.app`, configured production database/auth
    variables, corrected `ADMIN_PASSWORD_HASH`, and verified the protected
    production login page. Vercel SSO remains enabled; the pg-boss worker was
    not deployed.
15. Reset the administrator password through a masked local-only prompt after
    confirming that no database administrator existed. Updated the production
    Argon2id secret, redeployed successfully, verified HTTP 200 with no login
    configuration warnings, and removed all temporary reset artifacts.
16. Diagnosed the sidebar-only production load as a 76-query sequential
    dashboard waterfall amplified by Vercel `iad1` to Supabase Tokyo latency.
    Batched the reads down to four, request-memoized the duplicate session
    check, pinned Node 24 and Vercel `hnd1`, then passed typecheck, lint, 142
    tests, and the 14-page production build. Deployment inspection confirms the
    production functions are READY in `hnd1`.

## Completed on 2026-11-26

1. Confirmed the previous live top 25 were all Devanagari Hindi because the
   latest Hindi ingestion batch occupied the recency-only cutoff; 632 stored
   English topics were still available.
2. Added a recent-window readable-topic selection tier: English/Latin first,
   Urdu/Arabic second, and Hindi fallback, while preserving recency inside each
   tier and retaining the four-query dashboard path.
3. Added deterministic, tested Devanagari and Urdu-script Romanization. UI
   cards, compare, bookmarks/CSV, topic detail, evidence, search, and accessible
   labels now use readable titles while retaining the original headline.
4. Verified the resulting live 25-topic selection has 17 English alternatives,
   7 Latin originals, 1 other-script title, and no Devanagari primary titles.
5. Passed typecheck, lint, 21 test files / 153 tests (2 acceptance tests skip by
   default), the 14-page production build, and `git diff --check`; deployed the
   READY production release at `https://trendings-gamma.vercel.app`.

## Known live-data issue

- A previous interrupted `google-news-rss:en-US` run left exactly 12 item rows
  without `topic_items` links. Provenance was verified: every row points through
  `raw_ref` to the failed source run with `error_code = ProcessInterrupted`.
- Do not broadly delete unlinked items. If Ahmad approves cleanup, target only
  those failed-run residues and preserve their raw payload for the normal
  seven-day audit window. The current atomic-ingestion change prevents the same
  partial-write pattern on future failures.

## Committed implementation

- Commit `5682a28` (`Harden ingestion and worker lifecycle`) is pushed to
  `origin/main` and contains the runtime/config, rate-limit, atomic-ingestion,
  worker recovery/shutdown, acceptance-test, documentation, and continuity
  changes described above.
- Commit `50fc2d9` (`Speed up production dashboard`) is pushed to `origin/main`
  and contains the batched dashboard reads, request-scoped auth memoization,
  Node 24 pin, and Tokyo Vercel region configuration.
- Commit `178bc25` (`Prefer readable English and Romanized titles`) is pushed to
  `origin/main` and contains readable-topic selection, free deterministic
  Romanization, original-title provenance, and UI integration.
- No migration was added for that work.
- `.env.local` and `.vercel` remain ignored; do not commit either directory or
  copy their values into documentation.

## Resume from here

1. Confirm the English/Roman-readable production headlines after a hard refresh
   of the production URL.
2. Decide whether to keep Vercel deployment protection/SSO or disable it so the
   app's own login page is directly reachable from the public URL.
3. Deploy `pnpm worker` on an always-on host such as Railway, Render, Fly.io, or
   the intended VPS; do not attempt to run the persistent pg-boss process in a
   Vercel function.
4. Connect the Vercel project to the GitHub repository if automatic deployments
   from `main` are desired; the current production deployment was made manually.
5. Ask Ahmad before deleting the 12 known failed-run orphan items. The final
   provenance check still finds exactly those 12 and no other unlinked items.
6. Continue the documented Phase 1 backlog: unfinished free connectors,
   multilingual clustering, digest generation, persistent alert evaluation,
   and database-backed Playwright coverage.
7. Complete the free Phase 1 acceptance suite before starting Phase 2. Phase 2
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
