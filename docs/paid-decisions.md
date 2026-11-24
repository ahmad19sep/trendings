# Paid and approval decisions

**Status: no Phase 2 item is approved. Every flag remains off.**

Prices and access rules were re-checked against official sources on **2026-11-23**. They can change without notice. Before implementing or enabling any item, re-open the linked official page, record the chosen monthly cap, and have Ahmad mark one decision box. An unchecked line means **not approved**.

## Decision checklist

### Provider-hosted AI

- **Adds:** hosted classification, multilingual clustering support, summaries, translations, event extraction, and risk suggestions when a local model is not used.
- **Type:** paid, although a provider may offer a changing free tier.
- **Current examples:** OpenAI lists GPT-6 Luna at $0.10 input / $0.50 output per 1M short-context tokens and GPT-6 Sol at $2 / $10. Anthropic lists Claude Haiku 5.5 at $0.10 / $0.50 for prompts up to 100k tokens and Claude Sonnet 5.5 at $2 / $10; its Batch API is 50% lower. Google lists Gemini 4 Argon at $2 / $10 through 2026-11-30, increasing to $4 / $20 on 2026-12-01, and also documents free tiers for selected models.
- **Planning estimate only:** the brief’s workload assumptions—roughly 3,000 classifications and 150 summaries per day—are about $52/month at $0.10/$0.50 and $2/$10 standard rates, before retries, caching, translations, or taxes. Batch processing would be roughly half where supported. Actual usage must come from the spend ledger.
- **Flag/cap:** `AI_MODE=provider`, `AI_ENABLED=true`, and a non-zero `AI_MONTHLY_CAP_USD`. The cap must be checked before every call; warn at 80%, stop at 100%.
- **Fallback:** `AI_MODE=off` rules or `AI_MODE=local`.
- **Implementation:** provider adapters are not implemented.
- **Sources:** [OpenAI API pricing](https://platform.openai.com/pricing), [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing).
- **Decision:** [ ] Yes — provider/model: __________ cap: $____/month  [ ] No  [ ] Later

### X trends

- **Adds:** official trends by WOEID with native position and `tweet_count` when returned.
- **Type:** paid, pay-per-use credits; no subscription commitment.
- **Current price/limit:** X lists Trends at **$0.010 per request**. `GET /2/trends/by/woeid/:id` and trend locations are limited to 75 requests per 15 minutes per app. Four locations every four hours are about 720 requests or **$7.20/month**; hourly is about 2,880 requests or **$28.80/month**, assuming 30 days and no retries.
- **Flag/cap:** `SRC_X_TRENDS=false`; required `X_MONTHLY_CAP_USD`, recommended initial cap $10.
- **Fallback:** X Explore deep link plus manual URL paste. Missing `tweet_count` is unknown, never zero.
- **Implementation:** not implemented.
- **Sources:** [X pay-per-use pricing](https://docs.x.com/x-api/getting-started/pricing), [trends endpoint](https://docs.x.com/x-api/trends/get-trends-by-woeid), [rate limits](https://docs.x.com/x-api/fundamentals/rate-limits).
- **Decision:** [ ] Yes — cadence: __________ cap: $____/month  [ ] No  [ ] Later

### Reddit Data API

- **Adds:** approved hot/rising community signals for selected subreddits. A subreddit signal is not a country-level measurement.
- **Type:** approval required; commercial access requires explicit written approval. Reddit does not publish a guaranteed price for this use case on the policy page.
- **Flag/cap:** `SRC_REDDIT=false`; no connector may run before approval and credentials.
- **Fallback:** Reddit search deep links plus manual URL paste.
- **Implementation:** not implemented.
- **Source:** [Reddit Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy).
- **Decision:** [ ] Apply  [ ] Skip  [ ] Later

### Instagram hashtag watchlist

- **Adds:** public top/recent media for hashtags Ahmad explicitly watches. It is not a general trending/explore API.
- **Type:** approval required; requires an Instagram Business or Creator account, App Review, Instagram Public Content Access, and `instagram_basic`.
- **Current limit:** at most **30 unique hashtags in a rolling seven-day period** per professional account. Fetching top or recent media counts as querying the hashtag.
- **Flag/cap:** `SRC_INSTAGRAM=false`; show the rolling usage counter before activation.
- **Fallback:** Instagram tag deep links plus manual URL paste.
- **Implementation:** not implemented.
- **Source:** [Meta Hashtag Search documentation](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search).
- **Decision:** [ ] Apply  [ ] Skip  [ ] Later

### Google Trends API alpha

- **Adds:** consistently scaled interest data over a rolling five-year window, regular interval aggregation, and region/sub-region comparisons for stronger baselines.
- **Type:** limited alpha; application/acceptance required. Google publishes no public price or quota.
- **Flag/cap:** `SRC_GTRENDS_API=false`; interface stub only until Ahmad is accepted. Never substitute scraped internal endpoints or `pytrends`.
- **Fallback:** current Trends RSS snapshots and Google Trends Explore deep links.
- **Implementation:** not implemented.
- **Source:** [Google Trends API alpha](https://developers.google.com/search/apis/trends).
- **Decision:** [ ] Apply  [ ] Skip  [ ] Later

### YouTube quota increase

- **Adds:** more topic-search calls after the free default proves insufficient; it does not change the requirement to keep YouTube metrics out of the score unless audited permission allows derived use.
- **Type:** audit/application required; Google does not list a purchase price for a standard quota extension.
- **Current baseline:** general methods default to 10,000 units/day; `search.list` has a separate default bucket of 100 calls/day. Current quotas must be read from the project console.
- **Flag/cap:** no activation until the free connector is implemented, live usage is measured, and an audit is justified.
- **Fallback:** chart/raw signals within existing quota plus YouTube search deep links.
- **Implementation:** connector and quota application are not implemented.
- **Sources:** [quota costs](https://developers.google.com/youtube/v3/determine_quota_cost), [search.list](https://developers.google.com/youtube/v3/docs/search/list), [developer policies](https://developers.google.com/youtube/terms/developer-policies).
- **Decision:** [ ] Apply  [ ] Skip  [ ] Later

### CricketData paid capacity

- **Adds:** more than the free 100 hits/day, including higher-frequency fixture/live-score polling.
- **Type:** paid after the free tier.
- **Current plans:** $5.99/month for 2,000 hits/day; $12.99 for 10,000; $29.99 for 100,000; $64.99 for no listed daily limit. The provider says data can be a few minutes behind real time.
- **Flag/cap:** `SRC_CRICKETDATA=false` until the free connector is implemented and a key is supplied. Record the selected tier as the cap.
- **Fallback:** the free 100-hit/day fixture budget and manual event entry.
- **Implementation:** not implemented.
- **Source:** [CricketData official pricing](https://cricketdata.org/pricing/).
- **Decision:** [ ] Free tier first  [ ] $5.99  [ ] $12.99  [ ] $29.99  [ ] $64.99  [ ] Skip

### Calendarific

- **Adds:** Pakistan public-holiday coverage where Nager returns no PK data.
- **Type:** free tier plus paid plans; still requires an API key and attribution on free.
- **Current plans:** free 500 calls/month; Starter $12/month or $100/year for 10,000 calls/month; higher annual tiers are listed on the official page.
- **Flag/cap:** `SRC_CALENDARIFIC=false`. Start with free only if Ahmad approves the account/key; never auto-upgrade.
- **Fallback:** curated Pakistan event file plus AlAdhan’s explicitly uncertain calculated dates.
- **Implementation:** not implemented.
- **Source:** [Calendarific pricing](https://calendarific.com/pricing).
- **Decision:** [ ] Free tier  [ ] Starter monthly  [ ] Starter annual  [ ] Skip  [ ] Later

### Resend email digest

- **Adds:** morning digest by email.
- **Type:** free tier plus paid/overage plans.
- **Current plans:** Free $0 for 3,000 transactional emails/month with 100/day; Pro $20/month for 50,000 with optional $0.90 per extra 1,000-email bucket. Paid overages can charge automatically and must remain disabled unless explicitly approved.
- **Flag/cap:** `DIGEST_EMAIL=false`; a verified sending domain and `RESEND_API_KEY` are required. Record a hard monthly cap before enabling any paid plan/overage.
- **Fallback:** in-app digest and optional free Telegram delivery.
- **Implementation:** not implemented.
- **Source:** [Resend pricing](https://resend.com/pricing).
- **Decision:** [ ] Free tier  [ ] Pro, cap $____/month  [ ] Skip  [ ] Later

### WhatsApp Cloud API digest

- **Adds:** an approved digest template delivered on WhatsApp.
- **Type:** paid plus business onboarding and template approval.
- **Current pricing rule:** Meta charges per delivered business-to-user message, by category and recipient market. Rates may update quarterly; Pakistan’s exact category rate must be read from Meta’s current downloadable rate card immediately before approval. The first 1,000 **service** messages per business phone number each month are free as of 2026-10-01, but an outbound scheduled digest normally needs an approved template and must not be assumed to be a free service message.
- **Flag/cap:** `DIGEST_WHATSAPP=false` with a mandatory `WHATSAPP_MONTHLY_CAP_USD`; no automatic enablement after account setup.
- **Fallback:** in-app digest and optional Telegram.
- **Implementation:** not implemented.
- **Source:** [Meta WhatsApp Business Platform pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
- **Decision:** [ ] Yes — verified rate: $______ cap: $____/month  [ ] No  [ ] Later

### TMDB commercial licence

- **Adds:** continued TMDB use only if Creator Trend Radar becomes commercial.
- **Type:** approval/licence; public non-commercial API access requires attribution, while commercial use needs a separate licence. No public commercial price is quoted in the FAQ.
- **Flag/cap:** no commercial launch until written terms are obtained. `SRC_TMDB` remains a credentialed Phase 1 option only for personal, non-commercial use.
- **Fallback:** user-added film events and other permitted sources.
- **Implementation:** TMDB connector not implemented.
- **Source:** [TMDB FAQ](https://developer.themoviedb.org/docs/faq).
- **Decision:** [ ] Not applicable—personal use  [ ] Request commercial terms  [ ] Remove TMDB

### Hosted scheduler

- **Adds:** nothing required for the intended VPS deployment. The architecture uses `pg-boss` in PostgreSQL and a separate worker process.
- **Type:** hosted services may have free and paid tiers, but add cost and another operational dependency.
- **Flag/cap:** none.
- **Fallback:** `pg-boss` worker.
- **Decision:** [ ] Skip (recommended)  [ ] Revisit later

## Explicit non-option: TikTok trend scraping

No paid decision makes TikTok scraping acceptable. The build has no creator-accessible official TikTok trends connector. Use news spillover cues, provider deep links, and user-pasted URLs through the safe fetcher. Do not scrape TikTok, Instagram, or X pages or extract cookies.

