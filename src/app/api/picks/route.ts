import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Unauthorized } from "@/domain/errors";
import { getWeekPicksView, savePicks } from "@/domain/picks";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("week");
    const week = weekParam ? Number(weekParam) : undefined;
    const view = await Effect.runPromise(
      getWeekPicksView({
        userId: session.userId,
        week: Number.isFinite(week) ? week : undefined,
      }),
    );
    return jsonOk(view);
  } catch (e) {
    return mapDomainError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const body = (await req.json()) as {
      week?: number;
      picks?: { gameId: string; pickedTeam: string }[];
    };
    const result = await Effect.runPromise(
      savePicks({
        userId: session.userId,
        week: body.week ?? 1,
        picks: body.picks ?? [],
      }),
    );
    return jsonOk(result);
  } catch (e) {
    return mapDomainError(e);
  }
}
