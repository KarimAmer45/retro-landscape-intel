import type { NormalizedGame } from "../src/model.js";

export function game(overrides: Partial<NormalizedGame> & Pick<NormalizedGame, "sourceId" | "name">): NormalizedGame {
  return {
    source: "steamspy", developer: "Test Studio", publisher: "Test Publisher",
    ownersLow: 0, ownersHigh: 0, positiveReviews: 0, negativeReviews: 0,
    averagePlaytimeForeverMinutes: 0, averagePlaytimeTwoWeeksMinutes: 0,
    concurrentUsers: 0, priceCents: 0, discountPercent: 0, genres: [], tags: ["Retro"],
    sourceUrl: `https://steamspy.com/app/${overrides.sourceId}`, retrievedAt: "2026-08-06T00:00:00.000Z",
    ...overrides
  };
}
