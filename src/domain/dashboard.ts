import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { resolveAvatarId } from "@/domain/avatars";
import { NotFound, ValidationError } from "@/domain/errors";
import { getLeaderboard } from "@/domain/leaderboard";
import { deriveCurrentWeek, getSeasonYear } from "@/domain/season";

export type DashboardPayload = {
  displayName: string;
  avatarId: string;
  week: number;
  rank: number | null;
  points: number;
  gamesLeft: number;
  nextLockAt: string | null;
  hasSchedule: boolean;
};

export function summarizeWeek(
  userId: string,
  games: { id: string; kickoffAt: Date }[],
  picks: { userId: string; gameId: string }[],
  now: Date,
): { gamesLeft: number; nextLockAt: string | null } {
  const picked = new Set(
    picks.filter((p) => p.userId === userId).map((p) => p.gameId),
  );
  const openUnpicked = games.filter((g) => {
    const kickoff =
      g.kickoffAt instanceof Date ? g.kickoffAt : new Date(g.kickoffAt);
    return now.getTime() < kickoff.getTime() && !picked.has(g.id);
  });
  let next: Date | null = null;
  for (const g of openUnpicked) {
    const kickoff =
      g.kickoffAt instanceof Date ? g.kickoffAt : new Date(g.kickoffAt);
    if (!next || kickoff.getTime() < next.getTime()) next = kickoff;
  }
  return {
    gamesLeft: openUnpicked.length,
    nextLockAt: next ? next.toISOString() : null,
  };
}

export function getDashboard(userId: string, now?: Date) {
  return Effect.gen(function* () {
    const at = now ?? new Date();
    const db = getDb();
    const t = schemaTables();
    const seasonYear = getSeasonYear();

    const users = yield* Effect.tryPromise({
      try: () => db.select().from(t.users).where(eq(t.users.id, userId)),
      catch: (e) => new ValidationError({ message: String(e) }),
    });
    const user = users[0];
    if (!user) {
      return yield* Effect.fail(new NotFound({ entity: "user" }));
    }

    const games = yield* Effect.tryPromise({
      try: () =>
        db.select().from(t.games).where(eq(t.games.seasonYear, seasonYear)),
      catch: (e) => new ValidationError({ message: String(e) }),
    });
    const week = deriveCurrentWeek(
      games.map((g) => ({ week: g.week, status: g.status })),
    );
    const weekGames = games.filter((g) => g.week === week);

    const picks = yield* Effect.tryPromise({
      try: () => db.select().from(t.picks),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const summary = summarizeWeek(
      userId,
      weekGames.map((g) => ({
        id: g.id,
        kickoffAt:
          g.kickoffAt instanceof Date
            ? g.kickoffAt
            : new Date(g.kickoffAt as unknown as string),
      })),
      picks.map((p) => ({ userId: p.userId, gameId: p.gameId })),
      at,
    );

    const board = yield* getLeaderboard();
    const me = board.find((r) => r.userId === userId);

    return {
      displayName: user.displayName,
      avatarId: resolveAvatarId(user.avatarId),
      week,
      rank: me?.rank ?? null,
      points: me?.points ?? 0,
      gamesLeft: summary.gamesLeft,
      nextLockAt: summary.nextLockAt,
      hasSchedule: weekGames.length > 0,
    } satisfies DashboardPayload;
  });
}
