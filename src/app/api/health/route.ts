import { NextResponse } from "next/server";
import { pingDb } from "@/db";
import { ensureCommissionerOnce } from "@/db/ensure-commissioner";

export async function GET() {
  try {
    await pingDb();
    try {
      await ensureCommissionerOnce();
    } catch (e) {
      console.error("ensureCommissioner failed", e);
    }
    return NextResponse.json({ ok: true, service: "kan-nfl-2.0" });
  } catch {
    return NextResponse.json(
      { ok: false, error: "database unavailable" },
      { status: 503 },
    );
  }
}
