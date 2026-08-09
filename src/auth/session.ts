import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { Effect } from "effect";
import { Forbidden, Unauthorized } from "@/domain/errors";

export type SessionData = {
  isLoggedIn: boolean;
  userId?: string;
  role?: "player" | "commissioner";
  email?: string;
};

/** Dashboard session lifetime (90 days). */
export const SESSION_TTL_SEC = 60 * 60 * 24 * 90;

export function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters");
  }
  return {
    cookieName: "kan_nfl_session",
    password,
    ttl: SESSION_TTL_SEC,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}

export function requireSessionEffect() {
  return Effect.tryPromise({
    try: async () => {
      const session = await getSession();
      if (!session.isLoggedIn || !session.userId || !session.role) {
        throw new Unauthorized({});
      }
      return {
        userId: session.userId,
        role: session.role,
        email: session.email,
      };
    },
    catch: (e) => (e instanceof Unauthorized ? e : new Unauthorized({})),
  });
}

export function requireCommissionerEffect() {
  return Effect.gen(function* () {
    const s = yield* requireSessionEffect();
    if (s.role !== "commissioner") {
      return yield* Effect.fail(new Forbidden({}));
    }
    return s;
  });
}
