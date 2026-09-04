import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { getDashboard } from "@/domain/dashboard";
import { Unauthorized } from "@/domain/errors";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const payload = await Effect.runPromise(getDashboard(session.userId));
    return jsonOk(payload);
  } catch (e) {
    return mapDomainError(e);
  }
}
