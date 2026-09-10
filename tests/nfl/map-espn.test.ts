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
      homeScore: 0,
      awayScore: 0,
      week: 1,
    });
    expect(games[1]).toMatchObject({
      externalId: "401772902",
      homeTeam: "PHI",
      awayTeam: "DAL",
      status: "final",
      winnerTeam: "PHI",
      homeScore: 24,
      awayScore: 17,
    });
  });

  it("maps live scores while a game is in progress", () => {
    const games = mapEspnScoreboard(
      {
        events: [
          {
            id: "401772903",
            date: "2026-09-14T17:00:00Z",
            competitions: [
              {
                status: { type: { state: "in", completed: false } },
                competitors: [
                  {
                    homeAway: "home",
                    score: "14",
                    team: { abbreviation: "DEN" },
                  },
                  {
                    homeAway: "away",
                    score: "10",
                    team: { abbreviation: "LV" },
                  },
                ],
              },
            ],
          },
        ],
      },
      2026,
      2,
    );
    expect(games[0]).toMatchObject({
      homeTeam: "DEN",
      awayTeam: "LV",
      status: "in_progress",
      winnerTeam: null,
      homeScore: 14,
      awayScore: 10,
    });
  });

  it("uses null scores when ESPN omits or sends a non-numeric score", () => {
    const games = mapEspnScoreboard(
      {
        events: [
          {
            id: "401772904",
            date: "2026-09-14T17:00:00Z",
            competitions: [
              {
                status: { type: { state: "pre", completed: false } },
                competitors: [
                  {
                    homeAway: "home",
                    score: "",
                    team: { abbreviation: "SF" },
                  },
                  {
                    homeAway: "away",
                    team: { abbreviation: "SEA" },
                  },
                ],
              },
            ],
          },
        ],
      },
      2026,
      2,
    );
    expect(games[0]).toMatchObject({
      homeScore: null,
      awayScore: null,
    });
  });
});
