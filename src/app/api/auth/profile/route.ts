import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { Unauthorized } from "@/domain/errors";
import { updateProfile } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const body = (await req.json()) as {
      displayName?: string;
      avatarId?: string;
    };
    const user = await Effect.runPromise(
      updateProfile(session.userId, body),
    );
    return jsonOk({ user });
  } catch (e) {
    return mapDomainError(e);
  }
}
