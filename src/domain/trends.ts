import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { getDb, schemaTables } from "@/db";
import { resolveAvatarId } from "@/domain/avatars";
import { NotFound, ValidationError } from "@/domain/errors";
import { canRevealPicks } from "@/domain/reveal";
import { getSeasonYear } from "@/domain/season";

export function consensusLabel(
  leadingShare: number,
): "High" | "Moderate" | "Slight" | "Split" {
  if (leadingShare >= 0.7) return "High";
  if (leadingShare >= 0.6) return "Moderate";
  if (leadingShare >= 0.55) return "Slight";
  return "Split";
}

export type TrendGame = {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  homeCount: number;
  awayCount: number;
  homePct: number;
  awayPct: number;
  consensus: ReturnType<typeof consensusLabel>;
};

export type TrendsPayload = {
  week: number;
  games: TrendGame[];
  popular: { team: string; count: number }[];
};

function asDate(value: Date | number | string): Date {
  return value instanceof Date ? value : new Date(value as unknown as number);
}

export function buildTrendGames(
  games: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    kickoffAt: Date;
  }[],
  picks: { gameId: string; pickedTeam: string; userId: string }[],
  now: Date,
): { games: TrendGame[]; popular: { team: string; count: number }[] } {
  const rows: TrendGame[] = [];
  const sides: { team: string; count: number }[] = [];

  for (const g of games) {
    const kickoff = asDate(g.kickoffAt);
    if (!canRevealPicks(kickoff, now)) continue;

    const gamePicks = picks.filter((p) => p.gameId === g.id);
    const homeCount = gamePicks.filter((p) => p.pickedTeam === g.homeTeam).length;
    const awayCount = gamePicks.filter((p) => p.pickedTeam === g.awayTeam).length;
    const total = homeCount + awayCount;
    const homePct = total === 0 ? 0 : Math.round((homeCount / total) * 100);
    const awayPct = total === 0 ? 0 : Math.round((awayCount / total) * 100);
    const leadingShare = total === 0 ? 0 : Math.max(homeCount, awayCount) / total;

    rows.push({
      gameId: g.id,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      kickoffAt: kickoff.toISOString(),
      homeCount,
      awayCount,
      homePct,
      awayPct,
      consensus: consensusLabel(leadingShare),
    });
    sides.push({ team: g.homeTeam, count: homeCount });
    sides.push({ team: g.awayTeam, count: awayCount });
  }

  const popular = [...sides].sort((a, b) => b.count - a.count).slice(0, 6);
  return { games: rows, popular };
}

export function getWeekTrends(week: number, now?: Date) {
  return Effect.gen(function* () {
    const when = now ?? new Date();
    const seasonYear = getSeasonYear();
    const db = getDb();
    const t = schemaTables();

    const games = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(t.games)
          .where(and(eq(t.games.week, week), eq(t.games.seasonYear, seasonYear))),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const picks = yield* Effect.tryPromise({
      try: () => db.select().from(t.picks),
      catch: (e) => new ValidationError({ message: String(e) }),
    });

    const built = buildTrendGames(
      games.map((g) => ({
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        kickoffAt: asDate(g.kickoffAt),
      })),
      picks.map((p) => ({
        gameId: p.gameId,
        pickedTeam: p.pickedTeam,
        userId: p.userId,
      })),
      when,
    );

    return {
      week,
      games: built.games,
      popular: built.popular,
    } satisfies TrendsPayload;
  });
}

export function getTeamPickers(gameId: string, pickedTeam: string, now?: Date) {
  return Effect.tryPromise({
    try: async () => {
      const when = now ?? new Date();
      const db = getDb();
      const t = schemaTables();
      const found = await db
        .select()
        .from(t.games)
        .where(eq(t.games.id, gameId));
      const game = found[0];
      if (!game) throw new NotFound({ entity: "game" });
      const kickoff = asDate(game.kickoffAt);
      if (!canRevealPicks(kickoff, when)) {
        throw new NotFound({ entity: "game" });
      }

      const pickRows = await db
        .select()
        .from(t.picks)
        .where(eq(t.picks.gameId, gameId));
      const users = await db.select().from(t.users);
      const userById = new Map(users.map((u) => [u.id, u]));

      const pickers = pickRows
        .filter((p) => p.pickedTeam === pickedTeam)
        .flatMap((p) => {
          const u = userById.get(p.userId);
          if (!u) return [];
          return [
            {
              userId: u.id,
              displayName: u.displayName,
              avatarId: resolveAvatarId(u.avatarId),
            },
          ];
        });

      return { pickers };
    },
    catch: (e) =>
      e instanceof NotFound || e instanceof ValidationError
        ? e
        : new ValidationError({ message: String(e) }),
  });
}
