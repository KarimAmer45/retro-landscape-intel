import { describe, expect, it } from "vitest";
import { upsertGames } from "../src/store.js";
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
