# Method and model card

## Scope

This project queries SteamSpy's public `request=tag&tag=Retro` endpoint and keeps the first 500 valid records after sorting by total Steam reviews. The generated store records the query, retrieval timestamp, source IDs, source links, and normalized evidence fields. The query is a point-in-time discovery slice, not a census of retro games.

SteamSpy's tag response is a single cached snapshot rather than a paginated collection. The client therefore makes one bounded request, validates every returned object, reports rejected objects, and applies timeout plus exponential backoff for HTTP 429, HTTP 5xx, network, and timeout failures. Other 4xx statuses are treated as permanent and fail on the first attempt rather than consuming the retry budget. The record cap is applied only after validation and a deterministic review-count sort.

The store's `ingestion` block separates these stages: `received` objects returned, `accepted` objects that passed validation, `rejected` objects that failed it, and `retained` accepted records kept after the cap. The 2026-08-06 checked-in snapshot recorded 9,959 received, 9,958 accepted, 1 rejected, and 500 retained.

In that snapshot, all 500 selected records had zero recent-playtime values and no genre field. The engagement component therefore contributed zero for the full cohort; revival adjacency used the source query tag and observed title text. This absence is preserved and disclosed rather than imputed.

## Ranking formula

Each component is calculated within the retrieved cohort. Log scaling prevents blockbuster-scale counts from erasing smaller signals.

| Component | Weight | Calculation | Interpretation |
|---|---:|---|---|
| Review evidence | 35 | `log1p(total reviews) / log1p(cohort max)` | Breadth of observable audience evidence |
| Review quality | 20 | 95% Wilson lower bound of positive share | Conservative satisfaction estimate |
| Current attention | 25 | `log1p(CCU) / log1p(cohort max)` | Point-in-time audience activity proxy |
| Engagement depth | 10 | `log1p(average 2-week minutes) / log1p(cohort max)` | Recent playtime proxy when supplied |
| Revival signal | 10 | Up to three observed title/genre/tag matches | Explicit adjacency to arcade, classic, pixel, remake/remaster, platformer, or shoot-'em-up concepts |

The rounded sum is 0–100. `PURSUE` means ≥70, `PARK` means 50–69.9, and `PASS` means <50. These calls prioritize research effort only.

## Reproduction

```bash
npm ci
npm run ingest -- --tag Retro --limit 500
npm run report -- --top 10
npm run check
npm run dashboard
```

`npm run refresh` runs the same ingestion and report steps with their defaults. Pass flags to `ingest` and `report` directly, as above: npm forwards `--` arguments only to the last command of a chained script, so `npm run refresh -- --tag Retro` never reaches ingestion. The store upserts by `(source, sourceId)`, so repeat runs update records without duplicates. Writes use a temporary file followed by an atomic rename. Each run replaces the cohort with the current snapshot: prior records that fall outside the new capped selection are dropped rather than accumulated, so the store always describes one retrieval rather than a merged history.

## Limitations

- Rankings are heuristic prioritization signals, not valuation, demand forecasts, or proof of product-market fit.
- SteamSpy owner ranges are estimates. They are retained for traceability but deliberately excluded from scoring.
- Review totals, CCU, playtime, tags, genres, and catalog coverage depend on SteamSpy's public cached response and may be incomplete or stale.
- The endpoint does not expose release history, rights availability, development cost, revenue, console performance, or private sales data.
- The `Retro` tag is community/store metadata, not a finding that every title is retro by a consistent scholarly definition.
- A title's presence does not imply Atari ownership, availability, or strategic fit. Any pursue call requires a manual teardown, rights research, and corroboration from a second source.
- Current attention is a snapshot, not a longitudinal growth rate; this project never labels it market growth.
