import { Effect } from "effect";
import { getSession } from "@/auth/session";
import { changePassword } from "@/domain/users";
import { Unauthorized } from "@/domain/errors";
import { jsonOk, mapDomainError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.userId) throw new Unauthorized({});
    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    await Effect.runPromise(
      changePassword(
        session.userId,
        body.currentPassword ?? "",
        body.newPassword ?? "",
      ),
    );
    return jsonOk({ ok: true });
  } catch (e) {
    return mapDomainError(e);
  }
}
