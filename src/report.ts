import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readArgument, readPositiveInteger } from "./args.js";
import type { GameStore, RankedGame } from "./model.js";
import { rankGames } from "./rank.js";
import { readStore } from "./store.js";

interface BriefInput {
  ranked: RankedGame[];
  tag: string;
  retrievedAt: string;
  ingestion: GameStore["ingestion"];
  topCount: number;
}

function integer(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function escapeCell(value: string): string {
  // Pipes break the column split; newlines break the row.
  return value.replaceAll("|", "\\|").replace(/\s*[\r\n]+\s*/g, " ");
}

function evidenceRow(game: RankedGame): string {
  const quality = `${(game.positiveShare * 100).toFixed(1)}%`;
  const signal = game.signals.slice(0, 3).join(", ") || "Retro source tag";
  return `| ${game.rank} | [${escapeCell(game.name)}](${game.sourceUrl}) | ${game.score.toFixed(1)} | ${game.recommendation.toUpperCase()} | ${integer(game.reviewCount)} / ${quality} | ${integer(game.concurrentUsers)} | ${escapeCell(signal)} |`;
}

function buildBrief({ ranked, tag, retrievedAt, ingestion, topCount }: BriefInput): string {
  const top = ranked.slice(0, topCount);
  const pursue = top.filter((game) => game.recommendation === "pursue").length;
  const asOf = retrievedAt.slice(0, 10);
  const cohortSize = ranked.length;
  const recentCoverage = ranked.filter((game) => game.averagePlaytimeTwoWeeksMinutes > 0).length;
  const genreCoverage = ranked.filter((game) => game.genres.length > 0).length;
  const coverageNote = recentCoverage === 0 && genreCoverage === 0
    ? " SteamSpy supplied neither non-zero recent-playtime nor genre fields for this selected cohort, so recent engagement contributed zero cohort-wide and revival adjacency used the query tag plus title text."
    : ` Recent-playtime coverage was ${recentCoverage}/${cohortSize}; genre coverage was ${genreCoverage}/${cohortSize}.`;
  // Stores written before ingestion counts were recorded report zeros; fall back to the cohort size alone.
  const provenance = ingestion.received > 0
    ? `The \`${tag}\` tag snapshot returned ${integer(ingestion.received)} records on ${asOf}; ${integer(ingestion.accepted)} passed validation, and the ${integer(ingestion.retained || cohortSize)} most-reviewed were normalized and ranked.`
    : `${integer(cohortSize)} SteamSpy records from the \`${tag}\` tag snapshot were normalized on ${asOf}.`;
  return `# Retro landscape executive brief\n\n` +
    `**Decision:** pursue deep-dive research on the ${pursue} highest-confidence comparables below; park the remainder until a second source or rights data confirms the signal. This is a discovery queue, not an acquisition recommendation.\n\n` +
    `**Readout:** ${provenance} Rankings reward broad review evidence, statistically conservative review quality, current concurrent attention, recent playtime when present, and explicit revival-adjacent metadata.${coverageNote}\n\n` +
    `| # | Comparable | Score | Call | Reviews / positive | CCU | Revival signals |\n` +
    `|---:|---|---:|---|---:|---:|---|\n${top.map(evidenceRow).join("\n")}\n\n` +
    `## Action in the next 10 days\n\n` +
    `Commission a manual teardown of the top three **PURSUE** comparables: core loop, accessibility, platform mix, community retention, and the specific lesson transferable to Atari-owned IP. Before any rights or production decision, validate release history and ownership in MobyGames/official publisher records and compare at least one additional demand source.\n\n` +
    `## Guardrails\n\n` +
    `SteamSpy owner counts are estimates and are not used in the score. CCU and review totals are point-in-time public signals, not revenue or market size. A title appearing here does not imply that Atari owns or can license it. Full formula and limitations: [method.md](method.md).\n`;
}

async function main(): Promise<void> {
  const inputPath = readArgument("input", "data/games.json");
  const briefPath = readArgument("brief", "docs/exec-brief.md");
  const dashboardPath = readArgument("dashboard-data", "dashboard/data.json");
  const topCount = readPositiveInteger("top", 10);

  const store = await readStore(inputPath);
  const ranked = rankGames(store.games);
  if (ranked.length === 0) throw new Error("The store contains no games; run ingestion first.");
  const brief = buildBrief({ ranked, tag: store.query.tag, retrievedAt: store.retrievedAt, ingestion: store.ingestion, topCount });
  const dashboardData = {
    generatedAt: new Date().toISOString(),
    sourceRetrievedAt: store.retrievedAt,
    query: store.query,
    cohortSize: ranked.length,
    games: ranked
  };
  await mkdir(dirname(briefPath), { recursive: true });
  await mkdir(dirname(dashboardPath), { recursive: true });
  await writeFile(briefPath, brief, "utf8");
  await writeFile(dashboardPath, `${JSON.stringify(dashboardData, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ brief: briefPath, dashboardData: dashboardPath, cohort: ranked.length, top: ranked[0]?.name }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
