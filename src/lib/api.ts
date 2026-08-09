import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function mapDomainError(error: unknown): NextResponse {
  const tag =
    error && typeof error === "object" && "_tag" in error
      ? String((error as { _tag: string })._tag)
      : undefined;
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : "Error";

  switch (tag) {
    case "InvalidCredentials":
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    case "Unauthorized":
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    case "Forbidden":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    case "ValidationError":
      return NextResponse.json({ error: message }, { status: 400 });
    case "SetupTokenInvalid":
      return NextResponse.json(
        { error: "Setup link is invalid or expired. Ask the commissioner for a new one." },
        { status: 400 },
      );
    case "GameLocked":
      return NextResponse.json(
        { error: "Game is locked", gameId: (error as { gameId?: string }).gameId },
        { status: 409 },
      );
    case "NotFound":
      return NextResponse.json(
        { error: `${(error as { entity?: string }).entity ?? "Resource"} not found` },
        { status: 404 },
      );
    case "NflApiError":
      return NextResponse.json(
        { error: message || "NFL data unavailable" },
        { status: 502 },
      );
    default:
      console.error(error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function runEffectToResponse<A, E>(
  program: import("effect").Effect.Effect<A, E>,
): Promise<NextResponse> {
  const { Effect } = await import("effect");
  try {
    const result = await Effect.runPromise(
      program.pipe(
        Effect.map((data) => jsonOk(data)),
        Effect.catchAll((e) => Effect.succeed(mapDomainError(e))),
      ),
    );
    return result;
  } catch (e) {
    return mapDomainError(e);
  }
}
