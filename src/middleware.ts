import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionOptions, type SessionData } from "@/auth/session-options";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/setup",
  "/api/auth/login",
  "/api/auth/setup",
  "/api/health",
];

function deny(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PREFIXES.some((p) =>
      p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/"),
    )
  ) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  try {
    const session = await getIronSession<SessionData>(
      request,
      response,
      sessionOptions(),
    );
    if (!session.isLoggedIn || !session.userId) {
      return deny(request);
    }
    return response;
  } catch {
    return deny(request);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
