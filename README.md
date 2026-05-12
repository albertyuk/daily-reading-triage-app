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
- `ANTHROPIC_SYNTHESIS_MODEL`: defaults to `claude-opus-4-1-20250805`.
- `ANTHROPIC_AUDIT_MODEL`: defaults to `claude-sonnet-4-20250514`.
- `OPENAI_API_KEY`: GPT-5.5 primary audit.
- `AUDIT_PROVIDER`: `openai` by default; set `anthropic` for fallback-first runs.
- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_TO`, `EMAIL_FROM`: inbound and outbound email.
- `SITE_PASSWORD`: required in production by middleware; `SITE_USER` defaults to `reader`.
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`: switch storage from local JSON to Vercel KV / Upstash Redis.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`: also supported if the Upstash integration provides these names instead.
- `CRON_SECRET`: protects cron endpoints.

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
# daily-reading-triage-app
# daily-reading-triage-app
