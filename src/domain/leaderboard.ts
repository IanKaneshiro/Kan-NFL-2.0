import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { ValidationError } from "@/domain/errors";
import { competitionRanks } from "@/domain/ranking";
import { scorePick, type GameStatus } from "@/domain/scoring";
import { getSeasonYear } from "@/domain/season";
import { maybeThrottledSync } from "@/domain/sync";
import { deriveCurrentWeek } from "@/domain/season";

function tables() {
  return schemaTables();
}

export type LeaderboardRow = {
  userId: string;
  displayName: string;
  points: number;
  correct: number;
  finalGames: number;
  rank: number;
};

export function getLeaderboard(opts: { week?: number } = {}) {
  return Effect.gen(function* () {
    const seasonYear = getSeasonYear();
    const db = getDb();
    const t = tables();

    if (opts.week === undefined) {
      const all = yield* Effect.tryPromise({
        try: () =>
          db.select().from(t.games).where(eq(t.games.seasonYear, seasonYear)),
        catch: (e) => new ValidationError({ message: String(e) }),
      });
      const cw = deriveCurrentWeek(
        all.map((g) => ({ week: g.week, status: g.status })),
      );
      yield* maybeThrottledSync(cw);
    } else {
      yield* maybeThrottledSync(opts.week);
    }

    const games = yield* Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(t.games)
          .where(eq(t.games.seasonYear, seasonYear));
        return opts.week === undefined
          ? rows
          : rows.filter((g) => g.week === opts.week);
      },
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const finalGames = games.filter((g) => g.status === "final");
    const users = yield* Effect.tryPromise({
      try: () => db.select().from(t.users),
      catch: (e) => new ValidationError({ message: String(e) }),
    });
    const picks = yield* Effect.tryPromise({
      try: () => db.select().from(t.picks),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const base = users.map((u) => {
      let points = 0;
      let correct = 0;
      for (const g of finalGames) {
        const pick = picks.find(
          (p) => p.userId === u.id && p.gameId === g.id,
        );
        const s = scorePick({
          pickedTeam: pick?.pickedTeam ?? null,
          winnerTeam: g.winnerTeam,
          status: g.status as GameStatus,
        });
        if (s === 1) {
          points += 1;
          correct += 1;
        }
      }
      return {
        userId: u.id,
        displayName: u.displayName,
        points,
        correct,
        finalGames: finalGames.length,
      };
    });

    const ranked = competitionRanks(base);
    return ranked.map((r) => {
      const full = base.find((b) => b.userId === r.userId)!;
      return {
        userId: r.userId,
        displayName: r.displayName,
        points: r.points,
        correct: full.correct,
        finalGames: full.finalGames,
        rank: r.rank,
      } satisfies LeaderboardRow;
    });
  });
}
