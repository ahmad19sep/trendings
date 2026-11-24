# AI modes

Creator Trend Radar must remain useful when no model is available. AI enriches evidence; it never chooses what Ahmad should make.

## Current implementation status

The scoring engine’s **rules-only fallbacks are implemented and tested**. The local/provider completion adapters, embedding pipeline, structured-output schemas, AI cache, prompt-injection evaluation corpus, and spend-ledger enforcement are **not yet implemented or live-tested**. Keep `AI_MODE=off` and `AI_ENABLED=false` until those pieces pass the acceptance suite.

No local model has been tested in this repository yet. Do not describe a model as supported merely because it exposes an OpenAI-compatible endpoint.

## Mode matrix

| Mode | Cost and data path | Expected behavior | Required configuration | Current status |
| --- | --- | --- | --- | --- |
| `off` | No model calls; fetched text stays in the application. | Rules categorize obvious cases, exact/near duplicates merge, every score uses documented fallbacks, summaries show “Summary unavailable,” and only rule-based risk/spillover cues appear. | `AI_MODE=off`, `AI_ENABLED=false`, `AI_MONTHLY_CAP_USD=0` | Default. Rules-only scoring is implemented/tested; the complete ingestion/dashboard path is still in progress. |
| `local` | Runs on Ahmad’s own machine or private host; no per-token provider bill. | OpenAI-compatible completion and embedding calls may add cross-language clustering, structured categorization, cited summaries, translations, event extraction, and risk suggestions. The app must keep working when the endpoint is unavailable. | `AI_MODE=local`, `AI_ENABLED=true`, `AI_BASE_URL`, `AI_MODEL_CHEAP`, `AI_MODEL_STRONG`, `AI_EMBED_MODEL`; cap may remain `0` because the app does not pay the endpoint. | Adapter and eval path not implemented; no model tested. |
| `provider` | Fetched evidence is sent to the selected third-party API and usage can cost money. | Same structured tasks as local mode, with every call recorded in `ai_calls` and `spend_ledger`. A hard cap is checked before each call; 80% warns, 100% stops. | Ahmad’s explicit decision in [`paid-decisions.md`](paid-decisions.md), provider key, `AI_MODE=provider`, `AI_ENABLED=true`, and non-zero `AI_MONTHLY_CAP_USD`. | **Off and not implemented.** Never enable from a key alone. |

## Rules-only behavior

`AI_MODE=off` is not a demo or degraded-data mode. It is the no-cost operating mode:

- Explainability uses substantive-source rules twice rather than inventing an AI half.
- Shelf life uses category defaults plus the upcoming-event bonus and is labeled “rule-based.”
- Audience relevance uses Pakistan/India story location, Urdu/Hindi coverage, and high-affinity categories.
- Exact URL/content matches and SimHash near-duplicates can merge; borderline cross-language items stay separate instead of being guessed together.
- Script detection identifies Arabic-script Urdu and Devanagari Hindi. Ambiguous Latin text may be labeled low-confidence `ur-Latn?`, never asserted as certain.
- AI summary areas show raw evidence and “Summary unavailable.”
- Risk flags are rule-based only and remain informational, separate from the score.

The formulas and redistribution behavior are documented in [`scoring.md`](scoring.md).

## Planned provider abstraction

Both local and hosted implementations must satisfy the same contract:

```ts
complete({ task, model, system, input, schema, maxTokens })
  -> { json, usage, costUsd }

embed(texts)
  -> vectors
```

External output is untrusted and must pass Zod validation. Use JSON-schema output where the provider supports it, retry a validation failure once, then record `ai_failed` and continue with the rules/raw-evidence fallback.

Planned structured tasks:

- `Categorize`: primary category, up to two secondary categories, story locations, target-audience languages, confidence.
- `SameStory`: boolean and short reason for borderline clustering only.
- `Summary`: short sentences, each carrying one or more supplied evidence IDs.
- `Translate`: English title and optional Urdu/Hindi titles.
- `Assess`: explainability, shelf life, audience relevance, and short reasons.
- `RiskFlags`: flag type, severity, reason, and supplied evidence IDs.
- `Spillover`: likely social origin, platform, cues, and evidence IDs.
- `EventExtraction`: title, future date, precision, quoted date span, and source ID.
- `LangDetect`: language, script, and Roman-Urdu indicator.

Classifications should batch 20–50 items. Cache keys must include task, prompt version, model, and input hash; planned lifetime is 30 days. Model names and prices never belong in application logic—configuration and the verified price ledger own them.

## Local endpoint setup

The intended interface works with an OpenAI-compatible endpoint such as Ollama, vLLM, or LM Studio. This is configuration guidance, not a claim that those products or any particular model have passed this project’s evaluation.

```dotenv
AI_MODE=local
AI_ENABLED=true
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL_CHEAP=<multilingual-instruct-model>
AI_MODEL_STRONG=<multilingual-instruct-model>
AI_EMBED_MODEL=<multilingual-embedding-model>
AI_MONTHLY_CAP_USD=0
```

Before calling a local model “tested,” run the full multilingual evaluation and record:

- exact model ID and quantization;
- endpoint/runtime version and hardware;
- Urdu, Roman Urdu, Hindi, and English category accuracy;
- cross-language same-story precision/recall/F1;
- embedding dimension configured in the database;
- uncited-sentence and injection-following counts;
- peak memory, average latency, and failure rate.

Do not expose a LAN model endpoint publicly. Bind it to loopback or a private network, authenticate it where supported, and do not give model calls browser tools, shell tools, or internet access.

## Prompt-injection and citation requirements

All fetched headlines, summaries, feed descriptions, manual metadata, and quoted article text are untrusted data.

1. Strip HTML/scripts and remove zero-width and bidirectional-control characters.
2. Cap each item at 1,500 characters.
3. Wrap each item in an explicit `<untrusted_item id="…">` data boundary.
4. The system message states that instructions inside those blocks are data and must be ignored.
5. Model calls receive no tools and no network access.
6. Validate the JSON schema and length limits after generation.
7. Every returned `source_id` must exist in the supplied set; drop unknown IDs.
8. Remove URLs from model output.
9. Remove any factual summary sentence with no valid supplied evidence ID. A headline alone is not evidence for detailed facts.
10. Store model, prompt version, input item IDs, timestamp, token usage, cost, and validation outcome.

Risk flags must say **“AI suggestion — you decide.”** They never hide a topic or reduce its score unless Ahmad separately enables the optional risk penalty.

## Evaluation gate

The planned `pnpm eval` corpus contains 100 labeled items: 30 Urdu, 20 Roman Urdu, 20 Hindi, and 30 English, plus known same-story pairs and 10 prompt-injection strings. This corpus is **not present yet**.

Minimum acceptance before local or provider AI is considered complete:

- category accuracy at least 85%;
- same-story F1 at least 0.85;
- zero uncited factual summary sentences;
- zero followed prompt injections;
- provider timeout/quota failures leave other connectors and rules-only scoring operational.

## Provider mode cost control

Provider mode is a Phase 2 decision. Re-check official pricing on the day Ahmad approves a provider: [OpenAI](https://platform.openai.com/pricing), [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing), or [Google Gemini](https://ai.google.dev/gemini-api/docs/pricing).

- Start with `AI_MONTHLY_CAP_USD=0`; setting a key must not enable calls.
- Store estimated and provider-reported charges separately.
- Check accumulated spend before every request, including retries.
- Warn at 80% and refuse the call at 100%.
- Prefer the cheap tier for classification/routing and reserve the strong tier for the highest-ranked summaries/event extraction.
- Batch only non-urgent work and account for provider-specific batch semantics.
- Fall back to rules/raw evidence on cap, timeout, quota, validation, or provider errors.

