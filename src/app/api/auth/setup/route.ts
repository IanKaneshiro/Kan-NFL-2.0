import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { completeSetup } from "@/domain/users";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const user = await Effect.runPromise(
      completeSetup(body.token ?? "", body.password ?? ""),
    );
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
