import { describe, expect, it } from "vitest";
import { visibleTeamScore } from "@/lib/game-score";

describe("visibleTeamScore", () => {
  it("returns the score for a final game", () => {
    expect(visibleTeamScore("final", 24)).toBe(24);
    expect(visibleTeamScore("final", 0)).toBe(0);
  });

  it("returns the score while a game is in progress", () => {
    expect(visibleTeamScore("in_progress", 14)).toBe(14);
  });

  it("hides placeholder scores on scheduled games", () => {
    expect(visibleTeamScore("scheduled", 0)).toBeNull();
    expect(visibleTeamScore("scheduled", 17)).toBeNull();
  });

  it("hides missing scores", () => {
    expect(visibleTeamScore("final", null)).toBeNull();
    expect(visibleTeamScore("in_progress", undefined)).toBeNull();
  });
});
