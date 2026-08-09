import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GameStore } from "../src/model.js";
import { readStore, upsertGames, writeStore } from "../src/store.js";
import { game } from "./fixtures.js";

describe("upsertGames", () => {
  it("is idempotent by source identity", () => {
    const first = game({ sourceId: "1", name: "Before" });
    const updated = game({ sourceId: "1", name: "After", positiveReviews: 10 });
    const result = upsertGames([first], [updated]);
    expect(result.result).toEqual({ inserted: 0, updated: 1, total: 1 });
    expect(result.games).toEqual([updated]);
  });
});

describe("writeStore and readStore", () => {
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "retro-store-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const store: GameStore = {
    schemaVersion: 1,
    query: { source: "steamspy", tag: "Retro", maxRecords: 2 },
    ingestion: { received: 3, accepted: 2, rejected: 1, retained: 2 },
    retrievedAt: "2026-08-06T00:00:00.000Z",
    games: [game({ sourceId: "1", name: "Alpha" }), game({ sourceId: "2", name: "Beta" })]
  };

  it("round-trips a store and leaves no temporary file behind", async () => {
    const path = join(directory, "games.json");
    await writeStore(path, store);

    expect(await readStore(path)).toEqual(store);
    expect(await readdir(directory)).toEqual(["games.json"]);
  });

  it("defaults the retained count for stores written before it existed", async () => {
    const path = join(directory, "legacy.json");
    const legacy = { ...store, ingestion: { received: 3, accepted: 2, rejected: 1 } };
    await writeFile(path, JSON.stringify(legacy), "utf8");

    const loaded = await readStore(path);
    expect(loaded.ingestion).toEqual({ received: 3, accepted: 2, rejected: 1, retained: 0 });
  });
});
