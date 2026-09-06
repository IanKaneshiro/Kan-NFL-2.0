import { NextResponse } from "next/server";

const DOMAIN_TAGS = new Set([
  "InvalidCredentials",
  "Unauthorized",
  "Forbidden",
  "ValidationError",
  "SetupTokenInvalid",
  "GameLocked",
  "NotFound",
  "NflApiError",
]);

/** Effect.runPromise rejects with FiberFailure, which hides `_tag` from callers. */
export function unwrapDomainError(error: unknown): unknown {
  let current: unknown = error;
  for (let i = 0; i < 8; i++) {
    if (!current || typeof current !== "object") break;
    const obj = current as Record<string, unknown>;
    const tag = typeof obj._tag === "string" ? obj._tag : undefined;
    if (tag && DOMAIN_TAGS.has(tag)) return current;
    if ("error" in obj && obj.error !== current) {
      current = obj.error;
      continue;
    }
    if ("defect" in obj && obj.defect !== current) {
      current = obj.defect;
      continue;
    }
    if ("cause" in obj && obj.cause !== current) {
      current = obj.cause;
      continue;
    }
    break;
  }
  const text = String(error);
  for (const tag of DOMAIN_TAGS) {
    if (text.includes(tag)) return { _tag: tag, message: text };
  }
  return error;
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function mapDomainError(error: unknown): NextResponse {
  const unwrapped = unwrapDomainError(error);
  const tag =
    unwrapped && typeof unwrapped === "object" && "_tag" in unwrapped
      ? String((unwrapped as { _tag: string })._tag)
      : undefined;
  const message =
    unwrapped && typeof unwrapped === "object" && "message" in unwrapped
      ? String((unwrapped as { message: unknown }).message)
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
        {
          error: "Game is locked",
          gameId: (unwrapped as { gameId?: string }).gameId,
        },
        { status: 409 },
      );
    case "NotFound":
      return NextResponse.json(
        {
          error: `${(unwrapped as { entity?: string }).entity ?? "Resource"} not found`,
        },
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
