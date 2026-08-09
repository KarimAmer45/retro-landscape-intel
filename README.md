# Retro Landscape Intel

A TypeScript/Node research tool that turns a real public games-data snapshot into an evidence-ranked retro landscape briefing and interactive dashboard.

The artifact is intentionally decision-disciplined: it ranks **research candidates**, not acquisitions; links every row to its source; excludes owner estimates from scoring; and says what the data cannot support.

## What ships

- Typed SteamSpy client with runtime Zod validation, timeout, retry, and exponential backoff
- Idempotent JSON persistence keyed by source identity, with atomic writes
- Deterministic 100-point ranking over five documented public signals
- Generated one-page [executive brief](docs/exec-brief.md) and dashboard dataset
- Responsive dashboard with ranked table, score chart, search, and pursue/park/pass filter
- Tests for schema drift, ranking determinism, source retries, and store idempotency
- CI for typechecking and tests

## Quick start

Requires Node.js 20 or newer. SteamSpy does not require an API key.

```bash
npm ci
npm run refresh
npm run check
npm run dashboard
```

Open `http://127.0.0.1:4173`. The default live slice is the 500 most-reviewed valid records returned for SteamSpy's `Retro` tag snapshot.

Useful overrides:

```bash
npm run ingest -- --tag Arcade --limit 250 --timeout 60000 --retries 3
npm run report -- --top 10
```

Environment equivalents are listed in `.env.example`. Nothing auto-loads a `.env` file: export the variables in your shell, prefix them on the command line, or copy `.env.example` to `.env` and run with Node's own loader.

```bash
STEAMSPY_TAG=Arcade npm run ingest
node --env-file=.env node_modules/tsx/dist/cli.mjs src/ingest.ts   # Node 20.6+
```

Flags must go to `ingest` and `report` directly. `npm run refresh -- --tag Arcade` does not work, because npm appends `--` arguments only to the last command in a chained script.

## Pipeline

```text
SteamSpy tag snapshot
  → validate each source object (Zod)
  → normalize and upsert by source ID (JSON)
  → score within the observed cohort
  → emit exec brief + dashboard data
  → render traceable research queue
```

The source endpoint is not paginated: it returns one cached tag snapshot. The client records the full received count, reports rejected objects, and applies the configured cap only after validation and deterministic review-count sorting. This behavior is explicit rather than pretending local chunks are API pages. A validation collapse aborts before replacing a previously valid store.

## Decision model

The score weights review evidence (35), a conservative review-quality bound (20), current attention (25), recent engagement (10), and explicit revival adjacency (10). Thresholds produce pursue/park/pass research calls. See [docs/method.md](docs/method.md) for formulas, reproduction steps, and limitations.

## Repository map

```text
src/sources/       source schemas and resilient client
src/ingest.ts      live pull → normalize → idempotent store
src/rank.ts        explicit scoring formula
src/report.ts      generated brief and dashboard dataset
dashboard/         dependency-free interactive front end
test/              fixed fixtures and behavior tests
docs/              executive output and model card
data/games.json    normalized evidence snapshot
```

## Honest limitations

This is public-signal discovery, not market sizing. SteamSpy coverage and cached fields can be incomplete; CCU is point-in-time; owner ranges are estimates; no rights, revenue, cost, console, or private sales data is present. A high score means “worth a teardown and corroboration,” not “buy or build this.”
