import { describe, expect, it } from "vitest";
import fixture from "@/nfl/fixtures/scoreboard-sample.json";
import { mapEspnScoreboard } from "@/nfl/map-espn";

describe("mapEspnScoreboard", () => {
  it("maps scheduled and final games", () => {
    const games = mapEspnScoreboard(fixture, 2026, 1);
    expect(games).toHaveLength(2);
    expect(games[0]).toMatchObject({
      externalId: "401772901",
      homeTeam: "KC",
      awayTeam: "BUF",
      status: "scheduled",
      winnerTeam: null,
      week: 1,
    });
    expect(games[1]).toMatchObject({
      externalId: "401772902",
      homeTeam: "PHI",
      awayTeam: "DAL",
      status: "final",
      winnerTeam: "PHI",
    });
  });
});
