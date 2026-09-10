import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { isGameLocked } from "@/domain/lock";
import { canRevealPicks } from "@/domain/reveal";
import { ValidationError } from "@/domain/errors";
import { deriveCurrentWeek, getSeasonYear } from "@/domain/season";
import { maybeThrottledSync } from "@/domain/sync";
import { scorePick, type GameStatus } from "@/domain/scoring";

function tables() {
  return schemaTables();
}

export function savePicks(input: {
  userId: string;
  week: number;
  picks: { gameId: string; pickedTeam: string }[];
  now?: Date;
}) {
  return Effect.tryPromise({
    try: async () => {
      const now = input.now ?? new Date();
      const db = getDb();
      const t = tables();
      const lockedGameIds: string[] = [];
      const toWrite: { gameId: string; pickedTeam: string; week: number }[] =
        [];

      for (const p of input.picks) {
        const games = await db
          .select()
          .from(t.games)
          .where(eq(t.games.id, p.gameId));
        const game = games[0];
        if (!game) {
          throw new ValidationError({ message: `Unknown game ${p.gameId}` });
        }
        const kickoff =
          game.kickoffAt instanceof Date
            ? game.kickoffAt
            : new Date(game.kickoffAt as unknown as number);
        if (isGameLocked(kickoff, now)) {
          lockedGameIds.push(p.gameId);
          continue;
        }
        if (p.pickedTeam !== game.homeTeam && p.pickedTeam !== game.awayTeam) {
          throw new ValidationError({
            message: `Invalid team ${p.pickedTeam} for game ${p.gameId}`,
          });
        }
        toWrite.push({
          gameId: p.gameId,
          pickedTeam: p.pickedTeam,
          week: game.week,
        });
      }

      await db.transaction(async (tx) => {
        for (const p of toWrite) {
          const existing = await tx
            .select()
            .from(t.picks)
            .where(
              and(eq(t.picks.userId, input.userId), eq(t.picks.gameId, p.gameId)),
            );
          if (existing[0]) {
            await tx
              .update(t.picks)
              .set({ pickedTeam: p.pickedTeam, updatedAt: now })
              .where(eq(t.picks.id, existing[0].id));
          } else {
            await tx.insert(t.picks).values({
              id: newId(),
              userId: input.userId,
              gameId: p.gameId,
              week: p.week,
              pickedTeam: p.pickedTeam,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      });
      return { saved: toWrite.length, lockedGameIds };
    },
    catch: (e) =>
      e instanceof ValidationError
        ? e
        : new ValidationError({ message: String(e) }),
  });
}

export type WeekPicksView = {
  week: number;
  currentWeek: number;
  seasonYear: number;
  staleWarning?: string;
  games: Array<{
    id: string;
    kickoffAt: string;
    homeTeam: string;
    awayTeam: string;
    homeName: string | null;
    awayName: string | null;
    status: GameStatus;
    winnerTeam: string | null;
    homeScore: number | null;
    awayScore: number | null;
    locked: boolean;
  }>;
  myPicks: Record<string, string>;
  revealedPicks: Array<{
    gameId: string;
    userId: string;
    displayName: string;
    pickedTeam: string;
    correct: boolean | null;
  }>;
};

export function getWeekPicksView(input: {
  userId: string;
  week?: number;
  now?: Date;
}) {
  return Effect.gen(function* () {
    const now = input.now ?? new Date();
    const seasonYear = getSeasonYear();
    const db = getDb();
    const t = tables();

    const allSeasonGames = yield* Effect.tryPromise({
      try: () =>
        db.select().from(t.games).where(eq(t.games.seasonYear, seasonYear)),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const currentWeek = deriveCurrentWeek(
      allSeasonGames.map((g) => ({ week: g.week, status: g.status })),
    );
    const week = input.week ?? currentWeek;

    let staleWarning: string | undefined;
    const syncResult = yield* maybeThrottledSync(week);
    if (
      syncResult &&
      "result" in syncResult &&
      syncResult.result &&
      "soft" in syncResult.result
    ) {
      staleWarning = "Scores may be stale (NFL sync failed or skipped).";
    }

    const games = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(t.games)
          .where(
            and(eq(t.games.week, week), eq(t.games.seasonYear, seasonYear)),
          ),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    games.sort((a, b) => {
      const ak =
        a.kickoffAt instanceof Date
          ? a.kickoffAt.getTime()
          : Number(a.kickoffAt);
      const bk =
        b.kickoffAt instanceof Date
          ? b.kickoffAt.getTime()
          : Number(b.kickoffAt);
      return ak - bk;
    });

    const myPickRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(t.picks)
          .where(and(eq(t.picks.userId, input.userId), eq(t.picks.week, week))),
      catch: (e) => new ValidationError({ message: String(e) }),
    });
    const myPicks: Record<string, string> = {};
    for (const p of myPickRows) myPicks[p.gameId] = p.pickedTeam;

    const users = yield* Effect.tryPromise({
      try: () => db.select().from(t.users),
      catch: (e) => new ValidationError({ message: String(e) }),
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const allPicks = yield* Effect.tryPromise({
      try: () => db.select().from(t.picks).where(eq(t.picks.week, week)),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const revealedPicks: WeekPicksView["revealedPicks"] = [];
    const gameDtos: WeekPicksView["games"] = [];

    for (const g of games) {
      const kickoff =
        g.kickoffAt instanceof Date
          ? g.kickoffAt
          : new Date(g.kickoffAt as unknown as number);
      const locked = isGameLocked(kickoff, now);
      gameDtos.push({
        id: g.id,
        kickoffAt: kickoff.toISOString(),
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeName: g.homeName,
        awayName: g.awayName,
        status: g.status as GameStatus,
        winnerTeam: g.winnerTeam,
        homeScore: g.homeScore ?? null,
        awayScore: g.awayScore ?? null,
        locked,
      });

      if (!canRevealPicks(kickoff, now)) continue;
      for (const p of allPicks.filter((x) => x.gameId === g.id)) {
        const u = userById.get(p.userId);
        if (!u) continue;
        const scored = scorePick({
          pickedTeam: p.pickedTeam,
          winnerTeam: g.winnerTeam,
          status: g.status as GameStatus,
        });
        revealedPicks.push({
          gameId: g.id,
          userId: p.userId,
          displayName: u.displayName,
          pickedTeam: p.pickedTeam,
          correct: scored === null ? null : scored === 1,
        });
      }
    }

    return {
      week,
      currentWeek,
      seasonYear,
      staleWarning,
      games: gameDtos,
      myPicks,
      revealedPicks,
    } satisfies WeekPicksView;
  });
}
