import { Cause, Effect, Exit } from "effect";
import { getSession } from "@/auth/session";
import { ensureCommissioner } from "@/db/ensure-commissioner";
import { login } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    await ensureCommissioner();
    const body = (await req.json()) as { email?: string; password?: string };
    const exit = await Effect.runPromiseExit(
      login(body.email ?? "", body.password ?? ""),
    );
    if (Exit.isFailure(exit)) {
      return mapDomainError(Cause.squash(exit.cause));
    }
    const user = exit.value;
    const session = await getSession();
    session.isLoggedIn = true;
    session.userId = user.id;
    session.role = user.role;
    session.email = user.email;
    await session.save();
    return jsonOk({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (e) {
    return mapDomainError(e);
  }
}
