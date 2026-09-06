import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Unauthorized, ValidationError } from "@/domain/errors";
import { getTeamPickers } from "@/domain/trends";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const url = new URL(req.url);
    const gameId = url.searchParams.get("gameId");
    const pickedTeam = url.searchParams.get("pickedTeam");
    if (!gameId || !pickedTeam) {
      throw new ValidationError({
        message: "gameId and pickedTeam are required",
      });
    }
    const payload = await Effect.runPromise(getTeamPickers(gameId, pickedTeam));
    return jsonOk(payload);
  } catch (e) {
    return mapDomainError(e);
  }
}
