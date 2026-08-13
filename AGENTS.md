# AGENTS.md

## Stack

- Plain HTML/CSS/JS frontend (no framework, no build step) + Node serverless functions in `api/` (Vercel auto-detects them, no framework). CommonJS, not ES modules — matches markdown-blog.
- Storage: Upstash Redis (provisioned via Vercel Marketplace; REST-based, serverless-safe). `@upstash/redis` is the only runtime dependency — pin the version from the registry at install (`npm view @upstash/redis version`), never from memory.
- Data: Open-Meteo (weather, keyless) + WAQI (air quality, keyed, Lahore station `A471607`).
- Formula: GitHub + Vercel + OpenCode. Repo: https://github.com/KarimShaikh123/lahore-weather (private). Live URL set at deploy.
- Tests: Node's built-in test runner (`node:test`) — no test framework dependency. Every feature ships with its test in the same commit.

## Project status

Living checklist — update the tick in the same commit that completes the task.

- [x] Task 0 — README + AGENTS.md (this file)
- [x] Task 1 — Scaffold: git init, private GitHub repo `lahore-weather`, local git identity, `.gitignore` (`.env.local`, `node_modules`, `.vercel`, `dist`), `.env.example` (placeholders only), `package.json` with `@upstash/redis` (version from `npm view`), `vercel.json` (cleanUrls + nosniff)
- [ ] Task 2 — Weather probe: throwaway script proves Open-Meteo field map for Lahore (lat 31.558, lon 74.35071); pinned fields + `current_units`; discard after
- [ ] Task 3 — AQI probe: throwaway script proves WAQI station `A471607` readings using `AQI_API_KEY` from `.env.local`; handles 200-but-`data:null` and missing-key gracefully; discard after
- [ ] Task 4 — Interface (pulled forward so the owner can review it early): `index.html` + `styles.css` + `js/` in house style; weather + AQI visible first screen; AQI 0–500 with category colours; attribution line (Open-Meteo/CAMS, WAQI); loading/error/staleness states; renders a sample-reading JSON mock (no backend needed) — swap to the real endpoint happens in Task 9
- [ ] Task 5 — Provision Upstash Redis (creds → `.env.local`), connection test, key scheme (sorted set `readings`, score=epoch, prune to last 720 ≈ 30 days)
- [ ] Task 6 — `api/ingest.js`: Bearer `CRON_SECRET` check → fetch Open-Meteo + WAQI → validate (response ok, error key, unit assertion, ranges, station-offline) → `ZADD` with dedup → prune. Tests for validation + dedup
- [ ] Task 7 — `.github/workflows/ingest.yml`: hourly cron, POSTs with `CRON_SECRET` from GitHub Actions secrets
- [ ] Task 8 — `api/readings.js`: latest via `ZREVRANGE 0 0`, history via `ZRANGE`
- [ ] Task 9 — Swap interface mock → real `/api/readings` (single small commit; contract already pinned by the mock shape)
- [ ] Task 10 — Security audit: no secrets in repo/logs, `CRON_SECRET` enforced, `.env.example` in sync, Redis token scoped
- [ ] Task 11 — Polish: responsive breakpoints (820/560), empty states, AQI category contrast
- [ ] Task 12 — Test everything: full `node:test` suite + manual wrong-input pokes
- [ ] Task 13 — Deploy + final review: Vercel project + production env vars + GitHub Actions secret, deploy, verify by content (Lahore numbers, timestamp advances), final loop audit

## Architecture

```
GH Actions cron (hourly) ──POST /api/ingest──▶ verify Bearer CRON_SECRET
    ├─ GET Open-Meteo weather   (keyless, lat 31.558, lon 74.35071)
    ├─ GET WAQI station A471607  (key AQI_API_KEY, server-side only)
    ├─ validate response (ok, error key, units, ranges, station-offline)
    └─ ZADD readings {epoch} {json}  → Upstash Redis, prune to last 720 (~30 days)

Browser ──GET /api/readings──▶
    ├─ ZREVRANGE 0 0   → current conditions
    └─ ZRANGE 0 -1     → history window
```

The browser only ever talks to `/api/readings`. API keys never reach the browser.

## Commands

- Install: `npm install`
- Local dev: `npx vercel dev` (needs populated `.env.local`)
- Syntax check: `node --check <file>` (one file at a time)
- Tests: `node --test api/*.test.js` (or the per-task test file)
- Deploy: push to `main` (auto), or `npx vercel --prod`
- Verify a deploy: read the live page content (Lahore numbers, advancing timestamp) — never a status code alone

## Secrets (never in the repo)

- `AQI_API_KEY` — WAQI token
- `CRON_SECRET` — bearer token shared between the GitHub Actions cron and `/api/ingest`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — injected by the Vercel Marketplace integration; in `.env.local` for dev
- Real values live ONLY in: Vercel env vars, GitHub Actions secrets, and `.env.local` (gitignored). `.env.example` holds placeholder names only.
- Before any commit that touches secrets/config, run a grep audit for real key material. A leak found later is a rotation, not a fix.

## API domain rules (do not regress)

- Open-Meteo current fields: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `weather_code`, `wind_speed_10m`, `is_day`; units arrive in `current_units` and must be asserted against the contract (`°C`, `%`, `km/h`), not just trusted.
- Open-Meteo variable names are the long forms: `relative_humidity_2m`, `weather_code` — short aliases used by other providers do not exist here. Errors come back as HTTP 400 with an `error: true` body; check the body, not just the status.
- WAQI: station `A471607` (Lahore). A response can be HTTP 200 with `data: null` (station offline) — that is an error state to surface, never a crash. `data.aqi` is US AQI 0–500; pollutant values are nested in `data.iaqi.*.v` (keys `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`).
- Ingest must be idempotent: `ZADD` is keyed on epoch, so a double-fired cron never stores a duplicate reading for the same hour.
- Stale data must be visible to users: the dashboard renders "last read Xh ago", so a dead cron or failed write is never silent.

## Conventions

- Design tokens in `:root` in `styles.css` — `--ink #19201c`, `--paper #f4f2eb`, `--lime #d8ef62`, `--coral #ff8d73`, `--blue #315eff`, `--error #d64530`, `--line`. New styles reuse these, not raw hex.
- Fonts: Manrope (body) + DM Mono (labels/buttons) via Google Fonts, matching portfolio-site and qr-generator.
- No code comments unless asked.
- One concern per file in `js/`, one concern per function in `api/`.

## Rules

- A 200 status proves a server answered; only content proves it is the right site.
- When stating a fact (versions, URLs, deploy targets), say what was checked versus assumed.
- Attribution is required by the data licences: credit Open-Meteo / CAMS and WAQI in the UI. This is compliance, not polish.
- One task, one commit, one review; nothing committed before the owner reviews.
- Commit identity: Karim Shaikh <karimhshaikh009@gmail.com>.
- Keep this file, README, and PROCESS.md updated in the same commit as any structural change.
- This file is the single source of truth for the build. Every task commit must (a) tick its status checkbox, (b) record any new API behaviour, error state, command, or convention discovered during the task, and (c) update the file map if files changed. Its goal: a fresh agent with zero context can pick it up and know exactly what exists, what is next, and what must not regress.