import { describe, expect, it } from "vitest";
import { rankGames, wilsonLowerBound } from "../src/rank.js";
import { game } from "./fixtures.js";

describe("rankGames", () => {
  const fixture = [
    game({ sourceId: "1", name: "Arcade Revival", positiveReviews: 9_500, negativeReviews: 500, concurrentUsers: 800, averagePlaytimeTwoWeeksMinutes: 240, genres: ["Arcade"] }),
    game({ sourceId: "2", name: "Quiet Classic", positiveReviews: 950, negativeReviews: 50, concurrentUsers: 8, averagePlaytimeTwoWeeksMinutes: 30, genres: ["Classic"] }),
    game({ sourceId: "3", name: "Busy but Divisive", positiveReviews: 5_500, negativeReviews: 4_500, concurrentUsers: 1_000, averagePlaytimeTwoWeeksMinutes: 300 }),
    game({ sourceId: "4", name: "No Evidence" })
  ];

  it("pins the deterministic fixture order and rounded scores", () => {
    const ranked = rankGames(fixture);
    expect(ranked.map(({ name }) => name)).toEqual(["Arcade Revival", "Busy but Divisive", "Quiet Classic", "No Evidence"]);
    expect(ranked.map(({ score }) => score)).toEqual([94.4, 84.1, 65.6, 3.3]);
    expect(ranked.map(({ rank }) => rank)).toEqual([1, 2, 3, 4]);
  });

  it("does not mutate the input", () => {
    const original = structuredClone(fixture);
    rankGames(fixture);
    expect(fixture).toEqual(original);
  });
});

describe("wilsonLowerBound", () => {
  it("rewards confidence from sample size", () => {
    expect(wilsonLowerBound(950, 50)).toBeGreaterThan(wilsonLowerBound(19, 1));
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });
});
