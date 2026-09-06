import { describe, expect, it } from "vitest";
import { competitionRanks } from "@/domain/ranking";

describe("competitionRanks", () => {
  it("sorts by points then name and uses competition ranks", () => {
    const ranked = competitionRanks([
      { userId: "1", points: 10, displayName: "Zed" },
      { userId: "2", points: 12, displayName: "Amy" },
      { userId: "3", points: 10, displayName: "Bob" },
    ]);
    expect(ranked.map((r) => r.userId)).toEqual(["2", "3", "1"]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2]);
  });
});
