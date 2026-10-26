import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { resolveAvatarId } from "@/domain/avatars";
import { NotFound, ValidationError } from "@/domain/errors";
import { scorePick, type GameStatus } from "@/domain/scoring";
import { getSeasonYear } from "@/domain/season";

export type BreakdownResult = "wrong" | "missed" | "live" | "correct";

export type BreakdownGame = {
  gameId: string;
  week: number;
  kickoffAt: string;
  status: GameStatus;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeam: string | null;
  pickedTeam: string | null;
  result: BreakdownResult;
};

export type PlayerBreakdown = {
  user: { userId: string; displayName: string; avatarId: string };
  week: number | null;
  points: number;
  correct: number;
  wrong: number;
  missed: number;
  burnedBy: { team: string; count: number }[];
  games: BreakdownGame[];
};

const RESULT_ORDER: Record<BreakdownResult, number> = {
  wrong: 0,
  missed: 1,
  live: 2,
  correct: 3,
};

function asDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value as unknown as number);
}

/** Only games that have kicked off (live or final) are included, so picks never leak early. */
export function buildPlayerBreakdown(
  games: {
    id: string;
    week: number;
    kickoffAt: Date;
    status: GameStatus;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    winnerTeam: string | null;
  }[],
  picksByGameId: Map<string, string>,
): Omit<PlayerBreakdown, "user" | "week"> {
  const rows: BreakdownGame[] = [];
  const burned = new Map<string, number>();
  let correct = 0;
  let wrong = 0;
  let missed = 0;

  for (const g of games) {
    if (g.status === "scheduled") continue;
    const pickedTeam = picksByGameId.get(g.id) ?? null;

    let result: BreakdownResult;
    if (g.status === "in_progress") {
      result = "live";
    } else if (!pickedTeam) {
      result = "missed";
      missed += 1;
    } else if (scorePick({ pickedTeam, winnerTeam: g.winnerTeam, status: g.status }) === 1) {
      result = "correct";
      correct += 1;
    } else {
      result = "wrong";
      wrong += 1;
      burned.set(pickedTeam, (burned.get(pickedTeam) ?? 0) + 1);
    }

    rows.push({
      gameId: g.id,
      week: g.week,
      kickoffAt: asDate(g.kickoffAt).toISOString(),
      status: g.status,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      winnerTeam: g.winnerTeam,
      pickedTeam,
      result,
    });
  }

  rows.sort(
    (a, b) =>
      RESULT_ORDER[a.result] - RESULT_ORDER[b.result] ||
      Date.parse(b.kickoffAt) - Date.parse(a.kickoffAt),
  );

  const burnedBy = [...burned.entries()]
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));

  return { points: correct, correct, wrong, missed, burnedBy, games: rows };
}

export function getPlayerBreakdown(userId: string, week?: number) {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = schemaTables();

      const found = await db.select().from(t.users).where(eq(t.users.id, userId));
      const user = found[0];
      if (!user) throw new NotFound({ entity: "user" });

      const seasonGames = await db
        .select()
        .from(t.games)
        .where(eq(t.games.seasonYear, getSeasonYear()));
      const games =
        week === undefined ? seasonGames : seasonGames.filter((g) => g.week === week);

      const picks = await db.select().from(t.picks).where(eq(t.picks.userId, userId));
      const picksByGameId = new Map(picks.map((p) => [p.gameId, p.pickedTeam]));

      const built = buildPlayerBreakdown(
        games.map((g) => ({
          id: g.id,
          week: g.week,
          kickoffAt: asDate(g.kickoffAt),
          status: g.status as GameStatus,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          homeScore: g.homeScore ?? null,
          awayScore: g.awayScore ?? null,
          winnerTeam: g.winnerTeam ?? null,
        })),
        picksByGameId,
      );

      return {
        user: {
          userId: user.id,
          displayName: user.displayName,
          avatarId: resolveAvatarId(user.avatarId),
        },
        week: week ?? null,
        ...built,
      } satisfies PlayerBreakdown;
    },
    catch: (e) =>
      e instanceof NotFound || e instanceof ValidationError
        ? e
        : new ValidationError({ message: String(e) }),
  });
}
