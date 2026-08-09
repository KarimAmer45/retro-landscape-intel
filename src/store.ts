import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { storeSchema, type GameStore, type NormalizedGame } from "./model.js";

export interface UpsertResult {
  inserted: number;
  updated: number;
  total: number;
}

export async function readStore(path: string): Promise<GameStore> {
  const contents = await readFile(path, "utf8");
  return storeSchema.parse(JSON.parse(contents));
}

export async function writeStore(path: string, store: GameStore): Promise<void> {
  const validated = storeSchema.parse(store);
  await mkdir(dirname(path), { recursive: true });
  // Named per process so concurrent runs cannot truncate each other's temporary file.
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export function upsertGames(existing: NormalizedGame[], incoming: NormalizedGame[]): {
  games: NormalizedGame[];
  result: UpsertResult;
} {
  const byId = new Map(existing.map((game) => [`${game.source}:${game.sourceId}`, game]));
  let inserted = 0;
  let updated = 0;

  for (const game of incoming) {
    const key = `${game.source}:${game.sourceId}`;
    if (byId.has(key)) updated += 1;
    else inserted += 1;
    byId.set(key, game);
  }

  const games = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { games, result: { inserted, updated, total: games.length } };
}
