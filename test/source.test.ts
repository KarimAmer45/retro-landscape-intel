import { describe, expect, it, vi } from "vitest";
import { SteamSpyClient } from "../src/sources/steamspy.js";

function sourceRow(appid: number, positive: number): Record<string, unknown> {
  return {
    appid, name: `Retro Test ${appid}`, developer: "Studio", publisher: "Publisher",
    positive, negative: 10, userscore: 0, owners: "10,000 .. 20,000",
    average_forever: 100, average_2weeks: 20, median_forever: 50, median_2weeks: 10,
    price: 999, initialprice: 999, discount: 0, ccu: 25, languages: "English",
    genre: "Action, Indie", tags: { Arcade: 8 }
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
}

describe("SteamSpyClient", () => {
  it("backs off after a retryable response and normalizes accepted rows", async () => {
    const payload = { "10": { ...sourceRow(10, 90), name: "Retro Test" } };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse(payload));
    const sleep = vi.fn(async () => undefined);
    const client = new SteamSpyClient({ fetchImpl, sleep, maxRetries: 1, timeoutMs: 1_000 });
    const result = await client.fetchTag({ tag: "Retro", maxRecords: 10 });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(result.games[0]).toMatchObject({ name: "Retro Test", ownersLow: 10_000, ownersHigh: 20_000, genres: ["Action", "Indie"], tags: ["Arcade", "Retro"] });
  });

  it("fails immediately on a non-retryable status", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 }));
    const sleep = vi.fn(async () => undefined);
    const client = new SteamSpyClient({ fetchImpl, sleep, maxRetries: 3, timeoutMs: 1_000 });

    await expect(client.fetchTag({ tag: "Retro", maxRecords: 10 })).rejects.toThrow("HTTP 404");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("counts validation results before applying the record cap", async () => {
    const payload = { "10": sourceRow(10, 900), "11": sourceRow(11, 500), "12": { appid: 0, name: "" } };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload));
    const client = new SteamSpyClient({ fetchImpl, sleep: async () => undefined, maxRetries: 0 });
    const result = await client.fetchTag({ tag: "Retro", maxRecords: 1 });

    expect(result).toMatchObject({ receivedCount: 3, acceptedCount: 2, rejectedCount: 1 });
    expect(result.games.map((game) => game.sourceId)).toEqual(["10"]);
  });
});
