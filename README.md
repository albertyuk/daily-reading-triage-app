# Daily Reading Triage

Personal daily reading triage and global briefing app.

## Setup

1. Install dependencies with an npm-compatible package manager.
2. Copy `.env.example` to `.env.local` and fill in keys.
3. Run `npm run feeds:check` to validate public source availability.
4. Run `npm run ingest` to store `data/raw-{date}.json`.
5. Run `npm run digest` to ingest, synthesize, audit, publish, and store the digest.
6. Run `npm run dev` and open `http://localhost:3000`.

## Important Env Vars

- `ANTHROPIC_API_KEY`: Claude Opus 4.7 synthesis and Claude Sonnet 4.6 fallback audit.
- `ANTHROPIC_SYNTHESIS_MODEL`: defaults to `claude-opus-4-7`.
- `ANTHROPIC_AUDIT_MODEL`: defaults to `claude-sonnet-4-6`.
- `OPENAI_API_KEY`: GPT-5.5 primary audit.
- `OPENAI_AUDIT_MODEL`: defaults to `gpt-5.5`; set this to an API model ID your OpenAI project can access.
- `AUDIT_PROVIDER`: `openai` by default; set `anthropic` for fallback-first runs.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_TO`, `EMAIL_FROM`: inbound and outbound email.
- `SITE_PASSWORD`: required in production by middleware; `SITE_USER` defaults to `reader`.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: switch storage from local JSON to Vercel KV / Upstash Redis.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: also supported if the Upstash integration provides these names instead.
- `CRON_SECRET`: protects cron endpoints.
- `PREFILTER_ENABLED`: defaults to enabled. Uses deterministic zero-token ranking before Opus so feed search stays cheap.
- `MAX_PREFILTER_ARTICLE_CHARS`: defaults to `3500`; caps article text before synthesis and audit.
- `MAX_SYNTHESIS_CURATED`, `MAX_SYNTHESIS_GLOBAL`, `MAX_SYNTHESIS_DISCOVERY`: cap how many articles each pool sends to Opus and GPT-5.5. Curated newsletters are preserved by default; the bigger savings come from global and discovery feeds.
- `MAX_ARTICLE_CHARS`: final per-article truncation cap before model calls; defaults to `3500`.
- `CURATED_LOOKBACK_HOURS`: defaults to `72`, because many curated newsletters are not daily.
- `ENABLE_EXTENDED_THINKING`: defaults off in production; set `true` temporarily when diagnosing synthesis decisions.
- `DIGEST_RUN_LOCK_MS`: defaults to `600000`; prevents repeated manual reloads from starting overlapping paid model runs.
- `RSSHUB_BASE_URL`: optional base URL for direct China social-media ingestion. Use your self-hosted RSSHub or a trusted public instance.
- `WEIBO_RSSHUB_PATHS`: optional comma-separated RSSHub routes for Weibo watchlists. The built-in Weibo hot-search route uses `/weibo/search/hot`.
- `XIAOHONGSHU_RSSHUB_PATHS`: optional comma-separated RSSHub routes such as `/xiaohongshu/user/{user_id}/notes`.
- `DOUYIN_RSSHUB_PATHS`: optional comma-separated RSSHub routes such as `/newrank/douyin/{dyid}`. This usually requires Newrank/RSSHub-side configuration.

## China Social Sources

Weibo, Xiaohongshu, and Douyin do not provide simple public RSS feeds. The app
supports them through RSSHub routes so social-media signals can enter the China
coverage pool without brittle direct scraping. These items flow through Global or
For You; there is no separate China section. For production reliability, prefer a
self-hosted RSSHub instance with any required cookies configured there.

## Cost Controls

The app fetches all configured feeds, then applies a free local prefilter before
calling Claude Opus 4.7. Opus still does the final synthesis, but it sees a
smaller, higher-signal corpus. GPT-5.5 audits the same filtered corpus, which also
cuts audit tokens. To reduce cost further, lower `MAX_SYNTHESIS_GLOBAL`,
`MAX_SYNTHESIS_DISCOVERY`, or `MAX_PREFILTER_ARTICLE_CHARS`.

## Run Logs

Every run writes durable observability artifacts and exposes them at
`/runs/{YYYY-MM-DD}`. The page shows source health, stage timing, per-article
decisions, LLM calls, token/cost accounting, audit issues, and the synthesis
trace when extended thinking is enabled.

## Commands

- `npm run ingest [YYYY-MM-DD]`
- `npm run digest [YYYY-MM-DD]`
- `npm run audit:inject [YYYY-MM-DD]`
- `npm run audit:compare [YYYY-MM-DD]`
- `npm run feeds:check`
- `npm test`

## Cron

Vercel cron runs in UTC. The included schedules are:

- `/api/cron/digest` at `0 8 * * *`
- `/api/cron/email` at `0 11 * * *`

These match 4:00 AM and 7:00 AM Eastern during daylight time. Adjust to `9` and `12`
UTC during standard time, or use an hourly gated cron on a Pro plan if exact DST
handling is required. Each route also accepts `?date=YYYY-MM-DD` for manual replay
and uses markers to avoid duplicate sends.
Use `force=true` on `/api/cron/digest` to intentionally regenerate an existing date
after a code or prompt fix.
# daily-reading-triage-app
# daily-reading-triage-app
