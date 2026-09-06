import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { Effect } from "effect";
import { getDb, resetDbCache, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { savePicks } from "@/domain/picks";

const DB = "file:./data/test-picks.db";

describe("savePicks", () => {
  const userId = newId();
  const openGameId = newId();
  const lockedGameId = newId();

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.SESSION_SECRET =
      "test-session-secret-at-least-32-characters";
    try {
      unlinkSync("./data/test-picks.db");
    } catch {
      /* ok */
    }
    resetDbCache();
    execSync("npx tsx scripts/apply-schema.ts", {
      env: { ...process.env, DATABASE_URL: DB },
      stdio: "inherit",
    });
    resetDbCache();
    const db = getDb();
    const t = schemaTables();
    const now = new Date();
    await db.insert(t.users).values({
      id: userId,
      email: "p@test.com",
      displayName: "Picker",
      role: "player",
      passwordHash: "x",
      avatarId: "fun-football",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(t.games).values([
      {
        id: openGameId,
        externalId: "open-1",
        seasonYear: 2026,
        week: 1,
        kickoffAt: new Date("2099-01-01T00:00:00Z"),
        homeTeam: "KC",
        awayTeam: "BUF",
        status: "scheduled",
        winnerOverride: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: lockedGameId,
        externalId: "locked-1",
        seasonYear: 2026,
        week: 1,
        kickoffAt: new Date("2000-01-01T00:00:00Z"),
        homeTeam: "PHI",
        awayTeam: "DAL",
        status: "final",
        winnerTeam: "PHI",
        winnerOverride: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("does not persist earlier picks when a later pick is invalid", async () => {
    const db = getDb();
    const t = schemaTables();
    await expect(
      Effect.runPromise(
        savePicks({
          userId,
          week: 1,
          picks: [
            { gameId: openGameId, pickedTeam: "KC" },
            { gameId: "missing-game", pickedTeam: "KC" },
          ],
          now: new Date("2026-01-01T00:00:00Z"),
        }),
      ),
    ).rejects.toThrow();
    const rows = await db.select().from(t.picks);
    expect(rows).toHaveLength(0);
  });

  it("saves open games and skips locked", async () => {
    const result = await Effect.runPromise(
      savePicks({
        userId,
        week: 1,
        picks: [
          { gameId: openGameId, pickedTeam: "KC" },
          { gameId: lockedGameId, pickedTeam: "DAL" },
        ],
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    );
    expect(result.saved).toBe(1);
    expect(result.lockedGameIds).toEqual([lockedGameId]);
  });
});
