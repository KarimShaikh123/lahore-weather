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
- [x] Task 2 — Weather probe: throwaway script proves Open-Meteo field map for Lahore (lat 31.558, lon 74.35071); pinned fields + `current_units`; discard after
- [ ] Task 3 — AQI probe: throwaway script proves WAQI station `A471607` readings using `AQI_API_KEY` from `.env.local`; handles 200-but-`data:null` and missing-key gracefully; discard after
- [x] Task 4 — Interface (pulled forward so the owner can review it early): `index.html` + `styles.css` + `js/` in house style; weather + AQI visible first screen; AQI 0–500 with category colours; attribution line (Open-Meteo/CAMS, WAQI); loading/error/staleness states; renders a sample-reading JSON mock (no backend needed) — swap to the real endpoint happens in Task 9
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
- Local dev: `npx vercel dev` (needs populated `.env.local`; runs `api/` functions + static files)
- Static preview of the interface only (no `api/`): `python3 -m http.server 4317` — `npx serve` is unreliable in this environment (first-run install hangs). The app MUST be served over HTTP: `fetch()` is blocked on `file://`, so opening `index.html` by double-click shows the error state even though the mock is correct.
- Syntax check: `node --check <file>` (one file at a time)
- Tests: `npm test` (the `test` script is `node --test`, discovers `test/*.test.js`)
- Deploy: push to `main` (auto), or `npx vercel --prod`
- Verify a deploy: read the live page content (Lahore numbers, advancing timestamp) — never a status code alone

## Secrets (never in the repo)

- `AQI_API_KEY` — WAQI token
- `CRON_SECRET` — bearer token shared between the GitHub Actions cron and `/api/ingest`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — injected by the Vercel Marketplace integration; in `.env.local` for dev
- Real values live ONLY in: Vercel env vars, GitHub Actions secrets, and `.env.local` (gitignored). `.env.example` holds placeholder names only.
- Before any commit that touches secrets/config, run a grep audit for real key material. A leak found later is a rotation, not a fix.

## API domain rules (do not regress)

### Pinned data contract (verified live 2026-08-13, task 2)

Open-Meteo `current` object for Lahore (lat 31.558, lon 74.35071, `timezone=auto`):

| Field | Unit (`current_units`) | Sample |
|---|---|---|
| `time` | `iso8601`, local Asia/Karachi (UTC+5) | `2026-08-13T14:00` |
| `interval` | seconds — **900 (15-min updates)** | 900 |
| `temperature_2m` | `°C` | 36.7 |
| `apparent_temperature` | `°C` | 42.9 |
| `relative_humidity_2m` | `%` | 50 |
| `weather_code` | `wmo code` | 51 |
| `wind_speed_10m` | `km/h` | 5.3 |
| `is_day` | `""` (0/1) | 1 |

- `weather_code` is a WMO code and needs a code→label map for display (51 = light drizzle; not just a number on screen).
- `utc_offset_seconds` 18000; timestamps are naive-local, no Z — treat as Asia/Karachi local time.
- Errors: HTTP 400 with body `{"error": true, "reason": "..."}` — check the body, not just the status.

- Open-Meteo current fields: `temperature_2m`, `apparent_temperature`, `relative_humidity_2m`, `weather_code`, `wind_speed_10m`, `is_day`; units arrive in `current_units` and must be asserted against the contract (`°C`, `%`, `km/h`), not just trusted.
- Open-Meteo variable names are the long forms: `relative_humidity_2m`, `weather_code` — short aliases used by other providers do not exist here. Errors come back as HTTP 400 with an `error: true` body; check the body, not just the status.
- WAQI: station `A471607` (Lahore). A response can be HTTP 200 with `data: null` (station offline) — that is an error state to surface, never a crash. `data.aqi` is US AQI 0–500; pollutant values are nested in `data.iaqi.*.v` (keys `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`).

### WAQI contract (schema verified 2026-08-13, task 3; real Lahore values still pending a real token)

- Endpoint: `https://api.waqi.info/feed/lahore/?token=AQI_API_KEY` — the **city feed** (`/feed/lahore/`), verified to exist on aqicn.org/city/lahore (2026-08-13: overall AQI 128, PM2.5 128, PM10 68, NO2 3, SO2 3, O3 5, CO 3; source: Pakistan Air Quality Monitor - US EPA). Prefer the city feed over the station feeds (`A471607`, `A74005`, `A540730` exist but their identity could not be verified without a real token — the demo token returned a different station for `A471607`).
- Top level: `status` (`"ok"` | `"error"`) and `data` (object, or `null` when station is offline). Check `data` for null — do not trust `status` alone.
- `data.aqi` — US AQI 0–500. `data.dominentpol` — dominant pollutant key (e.g. `pm25`).
- `data.iaqi` — pollutant map, **only keys the station actually measures** (`pm1`, `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`, `h`, `p`, `t`, `w`), each `{ v: <number> }`. Never assume a pollutant key exists.
- `data.city.name` + `data.city.geo` — verify these say Lahore when the real token lands; a wrong-station response must be rejected, not stored.
- `data.time.iso` — reading time, ISO with offset (e.g. `2026-08-13T16:00:00+08:00`).
- **Trap (verified): the public `token=demo` is hardcoded to fake data** — `feed/lahore/?token=demo` returned Shanghai, `feed/A471607/?token=demo` returned Bend, Oregon. The demo token is useless for verifying Lahore; the real token is required.
- `data.iaqi` values carry **no unit field** — render them as-is; do not assert or invent units for WAQI pollutants.

### Stored reading contract (pinned 2026-08-13, task 4 — the mock `sample-reading.json` defines it; ingest task 6 must produce it, readings task 8 must serve it)

One flat JSON object per hourly snapshot:

```json
{
  "recorded_at": "2026-08-13T14:00:00+05:00",
  "temperature_c": 36.7,
  "feels_like_c": 42.9,
  "humidity_pct": 50,
  "weather_code": 51,
  "wind_kmh": 5.3,
  "is_day": 1,
  "aqi": 180,
  "dominant_pollutant": "pm25",
  "pm25": 62.9, "pm10": 66.1, "no2": 5.7, "o3": 277, "so2": 21, "co": 676
}
```

Pollutants are optional keys (`pm25`, `pm10`, `no2`, `o3`, `so2`, `co`) — a station may not measure all of them; render missing ones as `—`.

### Frontend (task 4)

- `js/data.js` — pure logic: `aqiCategory`, `weatherCodeLabel`, `formatStaleness`; browser global `window.LWData`, Node export for tests.
- `js/render.js` — `LW.render(reading, $)` fills the DOM ids from a reading; AQI colour via `data-cat` attribute.
- `js/app.js` — fetches `READINGS_URL` (currently `./sample-reading.json` — the mock; **task 9 changes this one constant to `/api/readings`**), handles loading/error/staleness.
- `test/data.test.js` — `node:test` unit tests for `js/data.js`. DOM wiring is verified by opening the page (house convention).
- Script load order in `index.html` matters: `data.js` → `render.js` → `app.js`.
- Run tests: `npm test` (the `test` script is `node --test`).
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