import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { Effect } from "effect";
import { getDb, resetDbCache, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import { updateProfile } from "@/domain/users";
import { DEFAULT_AVATAR_ID } from "@/domain/avatars";

const DB = "file:./data/test-profile.db";

describe("updateProfile", () => {
  const a = newId();
  const b = newId();

  beforeAll(async () => {
    process.env.DATABASE_URL = DB;
    process.env.SESSION_SECRET =
      "test-session-secret-at-least-32-characters";
    try {
      unlinkSync("./data/test-profile.db");
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
    await db.insert(t.users).values([
      {
        id: a,
        email: "a@test.com",
        displayName: "Alpha",
        role: "player",
        passwordHash: "x",
        avatarId: DEFAULT_AVATAR_ID,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: b,
        email: "b@test.com",
        displayName: "Beta",
        role: "player",
        passwordHash: "x",
        avatarId: DEFAULT_AVATAR_ID,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("updates name and avatar", async () => {
    const row = await Effect.runPromise(
      updateProfile(a, { displayName: "Al", avatarId: "nfl-kc" }),
    );
    expect(row.displayName).toBe("Al");
    expect(row.avatarId).toBe("nfl-kc");
  });

  it("rejects taken names case-insensitively", async () => {
    const result = await Effect.runPromise(
      Effect.either(updateProfile(a, { displayName: "beta" })),
    );
    expect(result._tag).toBe("Left");
  });

  it("rejects unknown avatar", async () => {
    const result = await Effect.runPromise(
      Effect.either(updateProfile(a, { avatarId: "nfl-xyz" })),
    );
    expect(result._tag).toBe("Left");
  });

  it("allows keeping own name", async () => {
    const row = await Effect.runPromise(
      updateProfile(a, { displayName: "Al" }),
    );
    expect(row.displayName).toBe("Al");
  });
});
