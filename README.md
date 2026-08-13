# Lahore Weather + Air Quality

A dashboard showing Lahore's current weather and air quality at a glance — open it, see both, done.

**Live:** TBD (set at deploy, task 12)

**Stack:** GitHub + Vercel + OpenCode — plain HTML/CSS/JS frontend, Node serverless functions in `api/`, Upstash Redis for storage. Data from Open-Meteo (weather) and WAQI (air quality).

## What it does

- Shows current weather for Lahore: temperature, feels-like, humidity, wind
- Shows real-time air quality from a Lahore monitoring station, as a US AQI 0–500 number with category colour
- Pulls fresh data hourly via a GitHub Actions cron into Redis, so the dashboard never calls the weather APIs directly
- Shows how fresh the last reading is, so stale data is visible, not silent

## Status

Built in small reviewed steps:

1. README + AGENTS.md (done)
2. Scaffold — git, GitHub repo, gitignore, env contract, Vercel config (done)
3. Weather probe — prove Open-Meteo field map for Lahore (done)
4. AQI probe — schema pinned; real Lahore readings blocked on the WAQI token (in progress)
5. Interface — weather + AQI on one screen, renders a sample mock (done)
6. Provision Upstash Redis + schema (done)
7. Ingest endpoint — fetch, validate, store (done)
8. Hourly scheduler via GitHub Actions (done)
9. Readings endpoint — latest + history (pending)
10. Swap interface mock → real endpoint (pending)
11. Security audit (pending)
12. Polish (pending)
13. Test everything (pending)
14. Deploy + final review (pending)

## Run locally

Needs Node and a `.env.local` with the API keys (placeholders in `.env.example`):

```
npm install
npx vercel dev
```

## Deploy

Connected to GitHub; pushes to `main` auto-deploy to Vercel. Serverless functions in `api/` and the static frontend deploy together. Production env vars are set in Vercel; the GitHub Actions secret is set in the repo.

## Files

- `AGENTS.md` — stack, conventions, commands, API domain rules, and secret-handling rules for any AI agent working on this repo
- `.env.example` — placeholder names for every secret; never real values
- `index.html` — page layout
- `styles.css` — all styling (house tokens: `--ink`, `--paper`, `--lime`, `--coral`, `--blue`, `--error`, `--line` + AQI category colours `--aqi-*`)
- `js/data.js` — pure logic: AQI category, WMO weather-code labels, staleness formatting
- `js/render.js` — fills the page from a reading
- `js/app.js` — fetch + loading/error/staleness; reads `./sample-reading.json` until the real endpoint lands
- `sample-reading.json` — mock reading; defines the stored-reading contract
- `test/data.test.js` — `node:test` unit tests
- `api/ingest.js` — hourly data collector: fetch both APIs, validate, write to Redis
- `api/readings.js` — serves latest + history to the dashboard
- `.github/workflows/ingest.yml` — hourly cron that calls `/api/ingest`

For AI agents: `AGENTS.md` holds the stack, commands, conventions, and verification rules. Read it first and keep it updated with any structural change.