import { describe, expect, it } from "vitest";
import { aggregateUserPoints, scorePick } from "@/domain/scoring";

describe("scorePick", () => {
  it("returns null when game not final", () => {
    expect(
      scorePick({ pickedTeam: "KC", winnerTeam: null, status: "scheduled" }),
    ).toBeNull();
  });

  it("awards 1 for correct final pick", () => {
    expect(
      scorePick({ pickedTeam: "KC", winnerTeam: "KC", status: "final" }),
    ).toBe(1);
  });

  it("awards 0 for wrong or missing pick when final with winner", () => {
    expect(
      scorePick({ pickedTeam: "BUF", winnerTeam: "KC", status: "final" }),
    ).toBe(0);
    expect(
      scorePick({ pickedTeam: null, winnerTeam: "KC", status: "final" }),
    ).toBe(0);
  });

  it("awards 0 when final but no winner (tie/void)", () => {
    expect(
      scorePick({ pickedTeam: "KC", winnerTeam: null, status: "final" }),
    ).toBe(0);
  });
});

describe("aggregateUserPoints", () => {
  it("sums only final games", () => {
    const games = [
      { id: "g1", status: "final" as const, winnerTeam: "KC" },
      { id: "g2", status: "final" as const, winnerTeam: "BUF" },
      { id: "g3", status: "scheduled" as const, winnerTeam: null },
    ];
    const picks = new Map([
      ["g1", "KC"],
      ["g2", "KC"],
    ]);
    expect(aggregateUserPoints(games, picks)).toBe(1);
  });
});
