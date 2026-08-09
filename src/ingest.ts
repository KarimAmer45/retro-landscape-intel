import { access } from "node:fs/promises";
import { readArgument, readPositiveInteger, readPositiveIntegerEnvironment } from "./args.js";
import type { GameStore } from "./model.js";
import { SteamSpyClient } from "./sources/steamspy.js";
import { readStore, upsertGames, writeStore } from "./store.js";

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function readOptions() {
  return {
    outputPath: readArgument("output", "data/games.json"),
    tag: readArgument("tag", process.env.STEAMSPY_TAG ?? "Retro"),
    maxRecords: readPositiveInteger("limit", readPositiveIntegerEnvironment("STEAMSPY_MAX_RECORDS", process.env.STEAMSPY_MAX_RECORDS, 500)),
    timeoutMs: readPositiveInteger("timeout", readPositiveIntegerEnvironment("STEAMSPY_TIMEOUT_MS", process.env.STEAMSPY_TIMEOUT_MS, 45_000)),
    maxRetries: readPositiveInteger("retries", readPositiveIntegerEnvironment("STEAMSPY_MAX_RETRIES", process.env.STEAMSPY_MAX_RETRIES, 3))
  };
}

async function main(): Promise<void> {
  const { outputPath, tag, maxRecords, timeoutMs, maxRetries } = readOptions();
  const client = new SteamSpyClient({
    ...(process.env.STEAMSPY_BASE_URL ? { baseUrl: process.env.STEAMSPY_BASE_URL } : {}),
    timeoutMs,
    maxRetries
  });
  const fetched = await client.fetchTag({ tag, maxRecords });
  if (fetched.games.length === 0) {
    throw new Error(`SteamSpy returned ${fetched.receivedCount} rows but none passed validation; the existing store was preserved.`);
  }
  const priorStore = await fileExists(outputPath) ? await readStore(outputPath) : undefined;
  const incomingKeys = new Set(fetched.games.map((game) => `${game.source}:${game.sourceId}`));
  const sameQuery = priorStore?.query.source === "steamspy" && priorStore.query.tag === tag;
  const existing = sameQuery ? priorStore.games.filter((game) => incomingKeys.has(`${game.source}:${game.sourceId}`)) : [];
  const { games, result } = upsertGames(existing, fetched.games);
  const store: GameStore = {
    schemaVersion: 1,
    query: { source: "steamspy", tag, maxRecords },
    ingestion: {
      received: fetched.receivedCount,
      accepted: fetched.acceptedCount,
      rejected: fetched.rejectedCount,
      retained: fetched.games.length
    },
    retrievedAt: fetched.retrievedAt,
    games
  };
  await writeStore(outputPath, store);
  console.log(JSON.stringify({
    source: "steamspy",
    tag,
    received: fetched.receivedCount,
    accepted: fetched.acceptedCount,
    rejected: fetched.rejectedCount,
    retained: fetched.games.length,
    ...result,
    output: outputPath
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
