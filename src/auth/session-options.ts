import type { SessionOptions } from "iron-session";

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
