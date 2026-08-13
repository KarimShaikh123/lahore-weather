# AGENTS.md

## Stack

- Plain HTML/CSS/JS frontend (no framework, no build step) + Node serverless functions in `api/` (Vercel auto-detects them, no framework). CommonJS, not ES modules — matches markdown-blog.
- Storage: Upstash Redis (provisioned via Vercel Marketplace; REST-based, serverless-safe). `@upstash/redis` is the only runtime dependency — pin the version from the registry at install (`npm view @upstash/redis version`), never from memory. Env vars are injected by the Upstash integration: `KV_REST_API_URL` + `KV_REST_API_TOKEN` (read/write), `KV_REST_API_READ_ONLY_TOKEN` (read-only), `KV_URL`/`REDIS_URL` (TCP).
- Data: Open-Meteo (weather, keyless) + WAQI (air quality, keyed, Lahore station `A471607`).
- Formula: GitHub + Vercel + OpenCode. Repo: https://github.com/KarimShaikh123/lahore-weather (private). Vercel project linked 2026-08-13 (account karimhshaikh009-7588, project `lahore-weather`, GitHub repo connected, auto-deploy on push enabled). `.vercel/` holds the link (`projectId`/`orgId`) and `.env.local` holds a short-lived `VERCEL_OIDC_TOKEN` written by `vercel link` — both gitignored, never commit either. Live URL set at deploy.
- Tests: Node's built-in test runner (`node:test`) — no test framework dependency. Every feature ships with its test in the same commit.

## Project status

Living checklist — update the tick in the same commit that completes the task.

- [x] Task 0 — README + AGENTS.md (this file)
- [x] Task 1 — Scaffold: git init, private GitHub repo `lahore-weather`, local git identity, `.gitignore` (`.env.local`, `node_modules`, `.vercel`, `dist`), `.env.example` (placeholders only), `package.json` with `@upstash/redis` (version from `npm view`), `vercel.json` (cleanUrls + nosniff)
- [x] Task 2 — Weather probe: throwaway script proves Open-Meteo field map for Lahore (lat 31.558, lon 74.35071); pinned fields + `current_units`; discard after
- [x] Task 3 — AQI probe: throwaway script proves WAQI station `A471607` readings using `AQI_API_KEY` from `.env.local`; handles 200-but-`data:null` and missing-key gracefully; discard after. Verified real Lahore data 2026-08-13 (AQI 179, fresh); city feed proven stale — use the station feed
- [x] Task 4 — Interface (pulled forward so the owner can review it early): `index.html` + `styles.css` + `js/` in house style; weather + AQI visible first screen; AQI 0–500 with category colours; attribution line (Open-Meteo/CAMS, WAQI); loading/error/staleness states; renders a sample-reading JSON mock (no backend needed) — swap to the real endpoint happens in Task 9
- [x] Task 5 — Provision Upstash Redis (creds → `.env.local`), connection test, key scheme (sorted set `readings`, score=epoch, prune to last 720 ≈ 30 days). Verified live 2026-08-13: PING PONG on `logical-loon-118735.upstash.io`, ZADD→ZRANGE round-trip, dedup via `zremrangebyscore`, prune via `zremrangebyrank`, cleanup. Scheme pinned below
- [x] Task 6 — `api/ingest.js`: Bearer `CRON_SECRET` check → fetch Open-Meteo + WAQI → validate (response ok, error key, unit assertion, ranges, station-offline) → `ZADD` with dedup → prune. Tests for validation + dedup. E2E verified live 2026-08-13: real reading stored (36.2°C, AQI 171, pm25 dominant)
- [x] Task 7 — `.github/workflows/ingest.yml`: hourly cron (`0 * * * *`), POSTs with `CRON_SECRET` from GitHub Actions secrets. Manual trigger via `workflow_dispatch`
- [x] Task 8 — `api/readings.js`: latest via `zrange("readings", -1, -1)`, history via `zrange("readings", -168, -1)`. E2E verified live 2026-08-13 (latest = real reading, history[-1] === latest)
- [x] Task 9 — Interface reads `/api/readings`: `js/app.js` fetches the live endpoint, renders `payload.latest`, and shows a clear "no readings yet" state when the DB is empty. Verified over `vercel dev` 2026-08-13 (real offset-stamped reading served). Also fixed: ingest now stamps `recorded_at` with the Karachi offset (`formatOffset`, e.g. `2026-08-13T15:45+05:00`) so staleness math is correct in any viewer timezone — previously naive-local was misread by non-PK browsers
- [x] Task 10 — Security audit (2026-08-13): WAQI token in **zero** tracked files and zero history commits (`git grep` + `git log -S`); no KV JWT prefix in tracked files or the `vercel dev` log; `api/` has no console output that could leak secrets; `CRON_SECRET` enforced (401 on missing/bad auth — poked live); `.env.example` in sync with every var the code reads; Redis token **scoped** — the public `api/readings.js` now uses `KV_REST_API_READ_ONLY_TOKEN` (verified: reads work, `zadd` → `NOPERM`). **Gap for task 13: `AQI_API_KEY` and `CRON_SECRET` are NOT in Vercel env yet** (only the KV vars are) — the deployed ingest would 502/401 until they are added
- [x] Task 11 — Polish (2026-08-13): AQI **text** colours now theme-aware (`--aqi-*-text` tokens, darker in light / lighter in night; computed WCAG AA ≥ 4.5:1 in both themes — worst case moderate 5.07:1, was ~2:1). Legend + big AQI number use the text variants; the track gradient keeps the raw category colours. Empty state: error hides the AQI marker (`marker.hidden`, re-shown in render) and sets `data-cat="unknown"` so the dash renders faint. 560px: legend wraps to 3×2, big numbers scale down (56/44px)
- [ ] Task 12 — Test everything: full `node:test` suite + manual wrong-input pokes
- [ ] Task 13 — Deploy + final review: Vercel project + production env vars + GitHub Actions secret, deploy, verify by content (Lahore numbers, timestamp advances), final loop audit

## Architecture

```
GH Actions cron (hourly) ──POST /api/ingest──▶ verify Bearer CRON_SECRET
    ├─ GET Open-Meteo weather      (keyless, lat 31.558, lon 74.35071)
    ├─ GET WAQI station A471607     (key AQI_API_KEY, server-side only)
    ├─ GET Open-Meteo air-quality   (CAMS — keyless; gases NO₂/O₃/SO₂/CO)
    ├─ validate all three (ok, error key, units, ranges, station-offline)
    └─ zremrangebyscore readings {score} {score} → zadd readings {score} {json} → zremrangebyrank readings 0 -721
       (sorted set `readings`, score = epoch seconds of the reading's hour; prune keeps newest 720 ≈ 30 days)

Browser ──GET /api/readings──▶
    ├─ ZRANGE readings -1 -1  → current conditions (latest)
    └─ ZRANGE readings 0 -1   → history window
```

### Redis key scheme + client facts (verified live 2026-08-13, task 5)

- Provisioning (for reference / recreate): `vercel install upstash/upstash-kv --plan free --name lahore-weather` needs a TTY (spinner + "Successfully provisioned"); once the integration is installed it can be driven non-interactively with `script -qec "…"` + `--installation-id <id>`. The install does NOT connect the resource to the project — that step (`vercel integration-resource connect lahore-weather --yes`) is what injects the env vars. No project env vars appear until the resource is connected.
- Env vars injected (all 3 environments, mirrored into `.env.local`): `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`. Use `KV_REST_API_URL` + `KV_REST_API_TOKEN` for the REST client; never hardcode.
- Key scheme: ONE sorted set `readings`. Score = unix epoch **seconds** of the reading's hour (deterministic within the hour → dedup). Member = the flat stored-reading JSON string.
- Ingest write order: `zremrangebyscore("readings", score, score)` (clear any same-hour member) → `zadd("readings", { score, member })` → `zremrangebyrank("readings", 0, -721)` (keep newest 720 ≈ 30 days).
- Reads: latest = `zrange("readings", -1, -1)`; history = `zrange("readings", 0, -1)`. Write path (ingest) uses `KV_REST_API_TOKEN`; read-only path (readings) uses `KV_REST_API_READ_ONLY_TOKEN`.
- @upstash/redis v1.38.2 facts (checked the installed package, not assumed): **there is no `zrevrange`** — the last element is `zrange(key, -1, -1)`; `automaticDeserialization` is ON, so JSON members come back already parsed (objects, not strings); `zrem(key, memberObject)` works while `zrem(key, rawString)` can miss; pruning uses `zremrangebyrank`. Latency ~0.6–0.9s per REST call — fine for an hourly cron.

The browser only ever talks to `/api/readings`. API keys never reach the browser.

## Commands

- Install: `npm install`
- Local dev: `npx vercel dev` (needs populated `.env.local`; runs `api/` functions + static files). Note: `vercel dev`/deploys require a `build` script in `package.json` and `"outputDirectory": "."` in `vercel.json` — this project has no real build step, the script is a no-op (`echo no-build`). Do not remove them, or `vercel dev` fails with missing-build / missing-output-directory errors.
- Static preview of the interface only (no `api/`): `python3 -m http.server 4317` — `npx serve` is unreliable in this environment (first-run install hangs). The app MUST be served over HTTP: `fetch()` is blocked on `file://`, so opening `index.html` by double-click shows the error state even though the mock is correct.
- Syntax check: `node --check <file>` (one file at a time)
- Tests: `npm test` (the `test` script is `node --test`, discovers `test/*.test.js`)
- Deploy: push to `main` (auto), or `npx vercel --prod`
- Verify a deploy: read the live page content (Lahore numbers, advancing timestamp) — never a status code alone

## Secrets (never in the repo)

- `AQI_API_KEY` — WAQI token
- `CRON_SECRET` — bearer token shared between the GitHub Actions cron and `/api/ingest`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (read/write) + `KV_REST_API_READ_ONLY_TOKEN` (read-only) — injected by the Upstash Vercel integration into the project; mirrored into `.env.local` for dev
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

### WAQI contract (verified live 2026-08-13 with a real token — task 3 complete)

- **Endpoint: `https://api.waqi.info/feed/A471607/?token=AQI_API_KEY` — the STATION feed. Verified fresh 2026-08-13: `data.city.name` = "Lahore", geo [31.548, 74.344], AQI 179, dominentpol `pm25`, iaqi keys actually present `h, pm1, pm10, pm25, t` (this station measures no NO2/O3/SO2/CO — those stay absent, not zero), reading time `2026-08-13T08:00:00Z`.**
- **Trap (verified with the real token): the CITY feed `feed/lahore/` returns STALE data — AQI 34 timestamped 2025-02-18 (station "Lahore US Embassy"). The aqicn.org web page looks current, but this API endpoint is not. Never use `feed/lahore/` for live data; always use the station feed `feed/A471607/`.**
- Top level: `status` (`"ok"` | `"error"`) and `data` (object, or `null` when station is offline). Check `data` for null — do not trust `status` alone.
- `data.aqi` — US AQI 0–500. `data.dominentpol` — dominant pollutant key (e.g. `pm25`).
- `data.iaqi` — pollutant map, **only keys the station actually measures** (`pm1`, `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`, `h`, `p`, `t`, `w`, `dew`), each `{ v: <number> }`. Never assume a pollutant key exists.
- `data.city.name` + `data.city.geo` — must say Lahore; a wrong-station response must be rejected, not stored.
- `data.time.iso` — station reading time, ISO with offset or `Z`.
- **Trap (verified): the public `token=demo` is hardcoded to fake data** — `feed/lahore/?token=demo` returned Shanghai, `feed/A471607/?token=demo` returned Bend, Oregon. The demo token is useless for verifying Lahore; the real token is required.
- `data.iaqi` values carry **no unit field** — render them as-is; do not assert or invent units for WAQI pollutants.
- **Gas trap (fixed 2026-08-13): the Lahore station `A471607` measures NO NO2/O3/SO2/CO** — those keys are absent from `iaqi` and must NOT be faked as zero. Gases are now sourced from **Open-Meteo Air Quality (CAMS)** at the same lat/lon: `carbon_monoxide→co`, `nitrogen_dioxide→no2`, `sulphur_dioxide→so2`, `ozone→o3` (all µg/m³, same scale as WAQI). Station values win if the station ever measures a gas; CAMS fills the gaps. Live-checked 2026-08-13: NO₂ 4.6, O₃ 259, SO₂ 18.3, CO 605.

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

Pollutants are optional keys (`pm1`, `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`) — a station may not measure all of them; render missing ones as `—`.

### Frontend (task 4)

- `js/data.js` — pure logic: `aqiCategory`, `weatherCodeLabel`, `formatStaleness`, `weatherIconKey` (WMO → icon key), `aqiPosition` (AQI → 0–100% for the scale bar); browser global `window.LWData`, Node export for tests. WMO thunder is only 95–99 (999 must land on `unknown`).
- `js/icons.js` — the inline-SVG icon set (`window.LW_ICONS`, Node export). **SVG arc trap (found 2026-08-13): an arc whose radius is smaller than half the distance between its endpoints is invalid and the renderer bulges the arc past the viewBox — the cloud tops clipped to y=0.28. Any new/changed icon MUST pass the throwaway bbox verifier `/tmp/opencode/icon-bbox.js` (all 11 pass: strokes + round caps stay inside `viewBox="0 0 24 24"` with margin).**
- `js/render.js` — `LW.render(reading, $)` fills the DOM ids from a reading; AQI colour via `data-cat`; inline-SVG weather icon from `LW_ICONS` into `#w-icon` (`data.weather` = icon key); sets `#aqi-marker` `left` to `aqiPosition%`; sets `document.body.dataset.theme` to `day`/`night` from `reading.is_day` (1 = day) and `document.body.dataset.sky` to a sky class (`clear`/`partly`/`overcast`/`storm`, mapped from the icon key) — the two attributes drive the atmospheric background gradient.
- `js/app.js` — fetches `READINGS_URL = "/api/readings"` (task 9, was `./sample-reading.json`), uses `payload.latest` (the API returns `{ latest, history }`, not a flat reading); when `latest` is null it shows "No readings yet — the hourly collector will fill this in." instead of a crash; handles loading/error/staleness; `startTicker` updates the Lahore clock (`#clock`, `Intl` + `Asia/Karachi`) every 30s and the staleness line every 60s. `sample-reading.json` still exists but is now only the contract fixture — nothing reads it at runtime.
- `index.html` — header right is `#clock` (was `.tagline`, removed); weather panel hero = `.wi-slot#w-icon` + temp; AQI panel has `.aqi-scale` (track + `#aqi-marker` + legend).
- **AQI bar semantics (changed 2026-08-13): `aqiPosition` maps through SIX EQUAL-WIDTH category bands (Good/Moderate/Sensitive/Unhealthy/Very/Hazardous), not the linear 0–500 value.** Linear made AQI 180 sit at 36% and read "not bad"; equal bands put it at ~60% (Unhealthy band), matching how bad it feels. Legend = colored category labels under each band; the old 0/50/100/150/200/300/500 ticks are gone.
- `styles.css` — tokens now `--ink-soft`/`--ink-faint`/`--panel`/`--panel-alpha` (raw hex removed from component rules so night mode works). Night theme = `body[data-theme="night"]` overriding `--paper/--ink/--panel/--panel-alpha/--line/--ink-soft/--ink-faint` (dark panels, light text). **Atmospheric sky (2026-08-13): the page background is a gradient driven by `body[data-theme][data-sky]` (day/night × clear/partly/overcast/storm) — 8 rule combos, `background-attachment: fixed`; panels use the translucent `--panel-alpha` + backdrop blur so the sky shows through.** AQI text colours are the `--aqi-*-text` tokens (theme-aware, AA-compliant) — only the scale track uses the raw `--aqi-*` colours. Icons are inline SVG (`stroke: currentColor`, color = `--ink`).
- `test/data.test.js` — `node:test` unit tests for `js/data.js`. DOM wiring is verified by opening the page (house convention) + the throwaway `/tmp/opencode/render-smoke.js`.
- Script load order in `index.html` matters: `data.js` → `icons.js` → `render.js` → `app.js`.
- Run tests: `npm test` (the `test` script is `node --test`).

### api/ serverless functions (tasks 6–8)

- `api/ingest.js` — POST only. Bearer `CRON_SECRET` auth (`isAuthorized`); 405 on non-POST, 401 on bad auth, 502 on provider/validation failure, 500 on internal, 200 `{ ok, recorded_at, score, count }` on success. Fetches Open-Meteo weather (explicit `temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`), WAQI station feed, and Open-Meteo air-quality (CAMS: `pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone`) in parallel; validates all three (unit assertion °C/%/km/h, ranges, `is_day` 0/1, station-offline via `data:null`, wrong-city reject, freshness within ±2h/1h); builds the stored-reading contract (gases filled from CAMS when the station lacks them); writes `zremrangebyscore(readings, score, score)` → `zadd` → `zremrangebyrank(readings, 0, -721)` prune.
- **Keep the Redis client construction inside the handler** — tests `require("../api/ingest.js")` and must not construct a client (env vars may be unset in CI). Pure helpers are exported on `module.exports`: `isAuthorized`, `toEpochSeconds`, `formatOffset` (seconds → ISO offset like `+05:00`), `buildReading` (stamps `recorded_at` as `current.time + formatOffset(utc_offset_seconds)` so timestamps carry their offset), `validateWeather`, `validateWaqi`, `validateAir` (CAMS — only rejects a field when present and bad), `validateFreshness`.
- `api/readings.js` — GET only, public (the browser calls it). Returns `{ latest, history }`: `latest` = `zrange("readings", -1, -1)[0]` or `null` when the DB is empty; `history` = `zrange("readings", -168, -1)` (last 168 ≈ 7 days, ascending, includes the latest element). Members arrive auto-deserialized by the client. **Uses the read-only Redis token** (`KV_REST_API_READ_ONLY_TOKEN`) — a public endpoint must not hold write credentials. 405 on non-GET, 500 on internal. Pure `buildReadingsResponse(latestRows, historyRows)` exported for tests.
- `test/ingest.test.js` — unit tests for the ingest helpers (no network): auth, epoch math, contract mapping (optional pollutants absent when the station doesn't measure them), validation errors, freshness.

### Hourly cron (task 7)

- `.github/workflows/ingest.yml` — `schedule` cron `0 * * * *` (every hour, minute 0) + `workflow_dispatch` for manual runs. GitHub Actions schedules run in **UTC**; minute 0 of every UTC hour = minute 0 of every Lahore hour (UTC+5, no DST), so the run lands on 04:00 PKT (= 23:00 UTC) each day as part of the hourly cadence. The scheduler queues runs, so the POST fires a minute or two after the top of the hour — never exactly on time. Single step: `curl -sS --fail --max-time 60 -X POST "$INGEST_URL" -H "Authorization: Bearer $CRON_SECRET"`. Secrets come from env-mapped GitHub Actions secrets (not shell interpolation): `INGEST_URL` (the production `/api/ingest` URL — set at deploy, task 13) and `CRON_SECRET` (shared with the server + Vercel env). `--fail` makes any non-2xx mark the run failed, so a dead endpoint is loud, not silent.
- The cron uses GitHub Actions' default read-only token; no checkout or permissions needed.
- Ingest must be idempotent: score = epoch of the reading's hour, and ingest does `zremrangebyscore` (same hour) → `zadd`, so a double-fired cron never stores a duplicate reading for the same hour.
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