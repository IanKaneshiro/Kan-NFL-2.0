import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { getDb, resetDbCache, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { overrideWinner, upsertNormalizedGames } from "@/domain/sync";
import type { NormalizedGame } from "@/nfl/types";

const DB = "file:./data/test-sync.db";

describe("upsertNormalizedGames", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = DB;
    process.env.SESSION_SECRET =
      "test-session-secret-at-least-32-characters";
    try {
      unlinkSync("./data/test-sync.db");
    } catch {
      /* ok */
    }
    resetDbCache();
    execSync("npx tsx scripts/apply-schema.ts", {
      env: { ...process.env, DATABASE_URL: DB },
      stdio: "inherit",
    });
    resetDbCache();
  });

  afterAll(() => {
    resetDbCache();
  });

  it("preserves winner when override is set", async () => {
    const base: NormalizedGame = {
      externalId: "ext-1",
      seasonYear: 2026,
      week: 1,
      kickoffAt: new Date("2026-09-13T17:00:00Z"),
      homeTeam: "KC",
      awayTeam: "BUF",
      status: "final",
      winnerTeam: "KC",
      homeScore: 27,
      awayScore: 24,
    };
    await upsertNormalizedGames([base]);
    const db = getDb();
    const t = schemaTables();
    const rows = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-1"));
    expect(rows[0]?.winnerTeam).toBe("KC");

    await db
      .update(t.games)
      .set({ winnerTeam: "BUF", winnerOverride: true })
      .where(eq(t.games.id, rows[0]!.id));

    await upsertNormalizedGames([
      { ...base, winnerTeam: "KC", status: "final" },
    ]);
    const again = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-1"));
    expect(again[0]?.winnerTeam).toBe("BUF");
    expect(again[0]?.winnerOverride).toBe(true);
  });

  it("keeps override status when ESPN later reports in_progress", async () => {
    const base: NormalizedGame = {
      externalId: "ext-status",
      seasonYear: 2026,
      week: 1,
      kickoffAt: new Date("2026-09-13T17:00:00Z"),
      homeTeam: "PHI",
      awayTeam: "DAL",
      status: "in_progress",
      winnerTeam: null,
      homeScore: 14,
      awayScore: 7,
    };
    await upsertNormalizedGames([base]);
    const db = getDb();
    const t = schemaTables();
    const rows = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-status"));
    await Effect.runPromise(overrideWinner(rows[0]!.id, "PHI"));

    await upsertNormalizedGames([
      { ...base, status: "in_progress", winnerTeam: null },
    ]);
    const again = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-status"));
    expect(again[0]?.winnerTeam).toBe("PHI");
    expect(again[0]?.status).toBe("final");
    expect(again[0]?.winnerOverride).toBe(true);
  });

  it("rejects override winner that is not playing", async () => {
    const base: NormalizedGame = {
      externalId: "ext-bad-team",
      seasonYear: 2026,
      week: 1,
      kickoffAt: new Date("2026-09-13T17:00:00Z"),
      homeTeam: "SF",
      awayTeam: "SEA",
      status: "scheduled",
      winnerTeam: null,
      homeScore: null,
      awayScore: null,
    };
    await upsertNormalizedGames([base]);
    const db = getDb();
    const t = schemaTables();
    const rows = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-bad-team"));
    await expect(
      Effect.runPromise(overrideWinner(rows[0]!.id, "KC")),
    ).rejects.toThrow();
    await expect(Effect.runPromise(overrideWinner("", "SF"))).rejects.toThrow();
  });

  it("persists ESPN scores on insert and update", async () => {
    const base: NormalizedGame = {
      externalId: "ext-scores",
      seasonYear: 2026,
      week: 1,
      kickoffAt: new Date("2026-09-13T17:00:00Z"),
      homeTeam: "DEN",
      awayTeam: "KC",
      status: "in_progress",
      winnerTeam: null,
      homeScore: 10,
      awayScore: 7,
    };
    await upsertNormalizedGames([base]);
    const db = getDb();
    const t = schemaTables();
    const rows = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-scores"));
    expect(rows[0]?.homeScore).toBe(10);
    expect(rows[0]?.awayScore).toBe(7);

    await upsertNormalizedGames([
      { ...base, status: "final", winnerTeam: "DEN", homeScore: 24, awayScore: 17 },
    ]);
    const again = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-scores"));
    expect(again[0]?.homeScore).toBe(24);
    expect(again[0]?.awayScore).toBe(17);
    expect(again[0]?.winnerTeam).toBe("DEN");
    expect(again[0]?.status).toBe("final");
  });

  it("updates ESPN scores even when winnerOverride is set", async () => {
    const base: NormalizedGame = {
      externalId: "ext-override-scores",
      seasonYear: 2026,
      week: 1,
      kickoffAt: new Date("2026-09-13T17:00:00Z"),
      homeTeam: "GB",
      awayTeam: "CHI",
      status: "final",
      winnerTeam: "GB",
      homeScore: 20,
      awayScore: 17,
    };
    await upsertNormalizedGames([base]);
    const db = getDb();
    const t = schemaTables();
    const rows = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-override-scores"));
    await Effect.runPromise(overrideWinner(rows[0]!.id, "CHI"));

    await upsertNormalizedGames([
      { ...base, winnerTeam: "GB", homeScore: 27, awayScore: 24 },
    ]);
    const again = await db
      .select()
      .from(t.games)
      .where(eq(t.games.externalId, "ext-override-scores"));
    expect(again[0]?.winnerTeam).toBe("CHI");
    expect(again[0]?.status).toBe("final");
    expect(again[0]?.winnerOverride).toBe(true);
    expect(again[0]?.homeScore).toBe(27);
    expect(again[0]?.awayScore).toBe(24);
  });
});
