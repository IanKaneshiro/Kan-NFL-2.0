import { Effect } from "effect";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { NflApiError } from "@/domain/errors";
import { getSeasonYear } from "@/domain/season";
import { fetchEspnWeek } from "@/nfl/espn-provider";
import type { NormalizedGame } from "@/nfl/types";

function tables() {
  return schemaTables();
}

export async function upsertNormalizedGames(
  games: NormalizedGame[],
): Promise<number> {
  const db = getDb();
  const t = tables();
  let count = 0;
  for (const g of games) {
    const existing = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, g.externalId));
    const row = existing[0];
    const now = new Date();
    if (!row) {
      await db.insert(t.games).values({
        id: newId(),
        externalId: g.externalId,
        seasonYear: g.seasonYear,
        week: g.week,
        kickoffAt: g.kickoffAt,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeName: g.homeName ?? null,
        awayName: g.awayName ?? null,
        status: g.status,
        winnerTeam: g.winnerTeam,
        winnerOverride: false,
        createdAt: now,
        updatedAt: now,
      });
      count++;
      continue;
    }
    const winnerOverride = Boolean(row.winnerOverride);
    await db
      .update(t.games)
      .set({
        seasonYear: g.seasonYear,
        week: g.week,
        kickoffAt: g.kickoffAt,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        homeName: g.homeName ?? null,
        awayName: g.awayName ?? null,
        status: g.status,
        winnerTeam: winnerOverride ? row.winnerTeam : g.winnerTeam,
        updatedAt: now,
      })
      .where(eq(t.games.id, row.id));
    count++;
  }
  return count;
}

export function syncWeek(week: number) {
  return Effect.gen(function* () {
    const seasonYear = getSeasonYear();
    const games = yield* fetchEspnWeek(seasonYear, week);
    const runId = newId();
    const startedAt = new Date();
    const db = getDb();
    const t = tables();
    yield* Effect.tryPromise({
      try: async () => {
        await db.insert(t.syncRuns).values({
          id: runId,
          startedAt,
          finishedAt: null,
          ok: null,
          message: null,
        });
      },
      catch: (e) => new NflApiError({ message: String(e) }),
    });

    const upserted = yield* Effect.tryPromise({
      try: () => upsertNormalizedGames(games),
      catch: (e) => new NflApiError({ message: String(e) }),
    }).pipe(
      Effect.tapError((err) =>
        Effect.tryPromise({
          try: async () => {
            await db
              .update(t.syncRuns)
              .set({
                finishedAt: new Date(),
                ok: false,
                message: err.message,
              })
              .where(eq(t.syncRuns.id, runId));
          },
          catch: () => new NflApiError({ message: "sync log failed" }),
        }).pipe(Effect.ignore),
      ),
    );

    yield* Effect.tryPromise({
      try: async () => {
        await db
          .update(t.syncRuns)
          .set({
            finishedAt: new Date(),
            ok: true,
            message: `week ${week}: ${upserted} games`,
          })
          .where(eq(t.syncRuns.id, runId));
      },
      catch: (e) => new NflApiError({ message: String(e) }),
    });
    return { week, upserted, ok: true as const };
  });
}

export function syncSeasonWeeks(weeks: number[] = Array.from({ length: 18 }, (_, i) => i + 1)) {
  return Effect.gen(function* () {
    const results: { week: number; upserted: number; ok: true }[] = [];
    for (const w of weeks) {
      results.push(yield* syncWeek(w));
    }
    return results;
  });
}

export function maybeThrottledSync(week: number) {
  return Effect.gen(function* () {
    const minSec = Number(process.env.NFL_SYNC_MIN_INTERVAL_SEC ?? "900");
    const db = getDb();
    const t = tables();
    const recent = yield* Effect.tryPromise({
      try: async () =>
        db
          .select()
          .from(t.syncRuns)
          .orderBy(desc(t.syncRuns.startedAt))
          .limit(1),
      catch: () => [] as never[],
    });
    const last = recent[0];
    if (last?.startedAt) {
      const started =
        last.startedAt instanceof Date
          ? last.startedAt
          : new Date(last.startedAt as unknown as number);
      if (Date.now() - started.getTime() < minSec * 1000) {
        return { skipped: true as const, reason: "throttled" };
      }
    }
    const result = yield* syncWeek(week).pipe(
      Effect.catchAll(() =>
        Effect.succeed({ week, upserted: 0, ok: true as const, soft: true }),
      ),
    );
    return { skipped: false as const, result };
  });
}

export function overrideWinner(gameId: string, winnerTeam: string | null) {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = tables();
      const rows = await db.select().from(t.games).where(eq(t.games.id, gameId));
      if (!rows[0]) throw new Error("not found");
      await db
        .update(t.games)
        .set({
          winnerTeam,
          winnerOverride: winnerTeam !== null,
          status: winnerTeam ? "final" : rows[0].status,
          updatedAt: new Date(),
        })
        .where(eq(t.games.id, gameId));
      return { gameId, winnerTeam };
    },
    catch: (e) => new NflApiError({ message: String(e) }),
  });
}

export function getGamesForWeek(week: number, seasonYear = getSeasonYear()) {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = tables();
      return db
        .select()
        .from(t.games)
        .where(
          and(eq(t.games.week, week), eq(t.games.seasonYear, seasonYear)),
        );
    },
    catch: (e) => new NflApiError({ message: String(e) }),
  });
}
