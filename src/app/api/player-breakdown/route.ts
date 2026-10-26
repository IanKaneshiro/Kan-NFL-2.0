import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Unauthorized, ValidationError } from "@/domain/errors";
import { getPlayerBreakdown } from "@/domain/player-breakdown";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
      throw new ValidationError({ message: "userId is required" });
    }
    const weekParam = url.searchParams.get("week");
    let week: number | undefined;
    if (weekParam != null && weekParam !== "") {
      week = Number(weekParam);
      if (!Number.isInteger(week) || week < 1 || week > 18) {
        throw new ValidationError({ message: "week must be an integer from 1 to 18" });
      }
    }
    const payload = await Effect.runPromise(getPlayerBreakdown(userId, week));
    return jsonOk(payload);
  } catch (e) {
    return mapDomainError(e);
  }
}
