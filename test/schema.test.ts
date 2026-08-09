import { describe, expect, it } from "vitest";
import { steamSpyGameSchema } from "../src/sources/types.js";

const validPayload = {
  appid: 123, name: "Example", developer: "Studio", publisher: "Publisher", score_rank: "",
  positive: 120, negative: 10, userscore: 0, owners: "20,000 .. 50,000",
  average_forever: 100, average_2weeks: 20, median_forever: 50, median_2weeks: 10,
  price: "999", initialprice: "1999", discount: "50", ccu: 12,
  languages: "English", genre: "Action, Indie", tags: { Retro: 42 }
};

describe("steamSpyGameSchema", () => {
  it("validates and coerces a documented source-shaped payload", () => {
    const result = steamSpyGameSchema.parse(validPayload);
    expect(result.price).toBe(999);
    expect(result.tags.Retro).toBe(42);
  });

  it("accepts fields omitted by the tag snapshot", () => {
    const result = steamSpyGameSchema.safeParse({
      appid: 413150, name: "Stardew Valley", developer: "ConcernedApe", publisher: "ConcernedApe",
      score_rank: "", positive: 872384, negative: 13811, userscore: 0,
      owners: "20,000,000 .. 50,000,000", average_forever: 0, average_2weeks: 0,
      median_forever: 0, median_2weeks: 0, price: "1499", initialprice: "1499", discount: "0", ccu: 50662
    });
    if (!result.success) throw new Error(JSON.stringify(result.error.issues));
    expect(result.success).toBe(true);
  });

  it("rejects records without an identity", () => {
    expect(steamSpyGameSchema.safeParse({ ...validPayload, appid: 0 }).success).toBe(false);
    expect(steamSpyGameSchema.safeParse({ ...validPayload, name: "" }).success).toBe(false);
  });
});
