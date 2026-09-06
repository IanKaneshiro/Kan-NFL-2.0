import { Effect } from "effect";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { NflApiError, NotFound, ValidationError } from "@/domain/errors";
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
        status: winnerOverride ? row.status : g.status,
        winnerTeam: winnerOverride ? row.winnerTeam : g.winnerTeam,
        updatedAt: now,
      })
      .where(eq(t.games.id, row.id));
    count++;
  }
  return count;
}

function asDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(value as number);
}

export function syncWeek(week: number, existingRunId?: string) {
  return Effect.gen(function* () {
    const seasonYear = getSeasonYear();
    const games = yield* fetchEspnWeek(seasonYear, week);
    const runId = existingRunId ?? newId();
    const startedAt = new Date();
    const db = getDb();
    const t = tables();
    if (!existingRunId) {
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
    }

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
    const failRetrySec = Number(process.env.NFL_SYNC_FAIL_RETRY_SEC ?? "60");
    const db = getDb();
    const t = tables();
    const recent = yield* Effect.tryPromise({
      try: async () =>
        db
          .select()
          .from(t.syncRuns)
          .orderBy(desc(t.syncRuns.startedAt))
          .limit(20),
      catch: () => [] as never[],
    });
    const nowMs = Date.now();

    const lastSuccess = recent.find((r) => r.ok === true && r.finishedAt != null);
    if (lastSuccess?.startedAt) {
      const started = asDate(lastSuccess.startedAt);
      if (nowMs - started.getTime() < minSec * 1000) {
        return { skipped: true as const, reason: "throttled" };
      }
    }

    const lastFinished = recent.find((r) => r.finishedAt != null);
    if (lastFinished && lastFinished.ok === false && lastFinished.startedAt) {
      const started = asDate(lastFinished.startedAt);
      if (nowMs - started.getTime() < failRetrySec * 1000) {
        return { skipped: true as const, reason: "retry_wait" };
      }
    }

    const claimed = yield* Effect.tryPromise({
      try: async () => {
        const runId = newId();
        const startedAt = new Date();
        await db.insert(t.syncRuns).values({
          id: runId,
          startedAt,
          finishedAt: null,
          ok: null,
          message: "claimed",
        });
        const open = await db.select().from(t.syncRuns);
        const inflight = open.filter((r) => {
          if (r.finishedAt != null) return false;
          const started = asDate(r.startedAt);
          return Date.now() - started.getTime() < minSec * 1000;
        });
        inflight.sort((a, b) => {
          const at = asDate(a.startedAt).getTime();
          const bt = asDate(b.startedAt).getTime();
          if (at !== bt) return at - bt;
          return a.id.localeCompare(b.id);
        });
        const winner = inflight[0];
        if (winner && winner.id !== runId) {
          await db
            .update(t.syncRuns)
            .set({
              finishedAt: new Date(),
              ok: false,
              message: "lost race",
            })
            .where(eq(t.syncRuns.id, runId));
          return { skipped: true as const, runId };
        }
        return { skipped: false as const, runId };
      },
      catch: () => ({ skipped: true as const, runId: "" }),
    });

    if (claimed.skipped) {
      return { skipped: true as const, reason: "in_flight" };
    }

    const result = yield* syncWeek(week, claimed.runId).pipe(
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
      const id = gameId.trim();
      if (!id) {
        throw new NotFound({ entity: "game" });
      }
      const db = getDb();
      const t = tables();
      const rows = await db.select().from(t.games).where(eq(t.games.id, id));
      const game = rows[0];
      if (!game) throw new NotFound({ entity: "game" });
      if (
        winnerTeam !== null &&
        winnerTeam !== game.homeTeam &&
        winnerTeam !== game.awayTeam
      ) {
        throw new ValidationError({
          message: `winnerTeam must be ${game.homeTeam} or ${game.awayTeam}`,
        });
      }
      await db
        .update(t.games)
        .set({
          winnerTeam,
          winnerOverride: winnerTeam !== null,
          status: winnerTeam ? "final" : game.status,
          updatedAt: new Date(),
        })
        .where(eq(t.games.id, id));
      return { gameId: id, winnerTeam };
    },
    catch: (e) => {
      if (e instanceof NotFound || e instanceof ValidationError) return e;
      return new NflApiError({ message: String(e) });
    },
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
