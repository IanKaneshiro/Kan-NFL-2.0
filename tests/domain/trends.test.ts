import { describe, expect, it } from "vitest";
import { buildTrendGames, consensusLabel } from "@/domain/trends";

describe("consensusLabel", () => {
  it("maps 0.70 to High", () => {
    expect(consensusLabel(0.7)).toBe("High");
  });

  it("maps 0.60 to Moderate", () => {
    expect(consensusLabel(0.6)).toBe("Moderate");
  });

  it("maps 0.55 to Slight", () => {
    expect(consensusLabel(0.55)).toBe("Slight");
  });

  it("maps 0.50 to Split", () => {
    expect(consensusLabel(0.5)).toBe("Split");
  });
});

describe("buildTrendGames", () => {
  it("includes games before kickoff", () => {
    const games = [
      { id: "1", homeTeam: "KC", awayTeam: "BUF", kickoffAt: new Date("2026-09-10T17:00:00Z") },
      { id: "2", homeTeam: "DAL", awayTeam: "NYG", kickoffAt: new Date("2026-09-10T20:00:00Z") },
    ];
    const picks = [
      { gameId: "1", pickedTeam: "KC", userId: "a" },
      { gameId: "1", pickedTeam: "BUF", userId: "b" },
      { gameId: "1", pickedTeam: "KC", userId: "c" },
      { gameId: "2", pickedTeam: "DAL", userId: "a" },
    ];
    const { games: rows, popular } = buildTrendGames(games, picks);
    expect(rows).toHaveLength(2);
    expect(rows[0].gameId).toBe("1");
    expect(rows[0].homeCount).toBe(2);
    expect(rows[0].awayCount).toBe(1);
    expect(rows[0].homePct).toBe(67);
    expect(rows[1].gameId).toBe("2");
    expect(rows[1].homeCount).toBe(1);
    expect(popular[0]).toEqual({ team: "KC", count: 2 });
  });
});
