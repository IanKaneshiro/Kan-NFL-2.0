import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Unauthorized } from "@/domain/errors";
import { getLeaderboard } from "@/domain/leaderboard";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("week");
    const week = weekParam ? Number(weekParam) : undefined;
    const rows = await Effect.runPromise(
      getLeaderboard({
        week: Number.isFinite(week) ? week : undefined,
      }),
    );
    return jsonOk({ rows });
  } catch (e) {
    return mapDomainError(e);
  }
}
