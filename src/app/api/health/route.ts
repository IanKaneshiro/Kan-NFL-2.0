import { NextResponse } from "next/server";
import { pingDb } from "@/db";

export async function GET() {
  try {
    await pingDb();
    return NextResponse.json({ ok: true, service: "kan-nfl-2.0" });
  } catch {
    return NextResponse.json(
      { ok: false, error: "database unavailable" },
      { status: 503 },
    );
  }
}
