import { describe, expect, it } from "vitest";
import { buildPlayerBreakdown } from "@/domain/player-breakdown";

function game(
  id: string,
  overrides: Partial<Parameters<typeof buildPlayerBreakdown>[0][number]> = {},
) {
  return {
    id,
    week: 1,
    kickoffAt: new Date("2026-09-10T17:00:00Z"),
    status: "final" as const,
    homeTeam: "KC",
    awayTeam: "BUF",
    homeScore: 24,
    awayScore: 17,
    winnerTeam: "KC",
    ...overrides,
  };
}

describe("buildPlayerBreakdown", () => {
  it("scores final games and tallies who burned the player", () => {
    const result = buildPlayerBreakdown(
      [
        game("win"),
        game("loss1", { homeTeam: "DAL", awayTeam: "NYG", winnerTeam: "NYG" }),
        game("loss2", { homeTeam: "DAL", awayTeam: "PHI", winnerTeam: "PHI" }),
        game("skip", { homeTeam: "SF", awayTeam: "LAR", winnerTeam: "SF" }),
      ],
      new Map([
        ["win", "KC"],
        ["loss1", "DAL"],
        ["loss2", "DAL"],
      ]),
    );
    expect(result).toMatchObject({ points: 1, correct: 1, wrong: 2, missed: 1 });
    expect(result.burnedBy).toEqual([{ team: "DAL", count: 2 }]);
    expect(result.games.map((g) => g.result)).toEqual([
      "wrong",
      "wrong",
      "missed",
      "correct",
    ]);
  });

  it("shows live games without scoring them and hides unstarted games", () => {
    const result = buildPlayerBreakdown(
      [
        game("live", { status: "in_progress", winnerTeam: null }),
        game("later", { status: "scheduled", winnerTeam: null }),
      ],
      new Map([
        ["live", "KC"],
        ["later", "BUF"],
      ]),
    );
    expect(result.points).toBe(0);
    expect(result.games).toHaveLength(1);
    expect(result.games[0]).toMatchObject({
      gameId: "live",
      result: "live",
      pickedTeam: "KC",
    });
  });

  it("counts a tie as a miss for the picked team", () => {
    const result = buildPlayerBreakdown(
      [game("tie", { winnerTeam: null, homeScore: 20, awayScore: 20 })],
      new Map([["tie", "BUF"]]),
    );
    expect(result.points).toBe(0);
    expect(result.burnedBy).toEqual([{ team: "BUF", count: 1 }]);
  });
});
