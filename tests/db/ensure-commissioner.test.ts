import { beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { eq } from "drizzle-orm";
import { getDb, resetDbCache, schemaTables } from "@/db";
import { ensureCommissioner } from "@/db/ensure-commissioner";
import { newId } from "@/domain/ids";
import { verifyPassword } from "@/auth/password";

const DB = "file:./data/test-ensure-commissioner.db";

describe("ensureCommissioner", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = DB;
    process.env.SESSION_SECRET =
      "test-session-secret-at-least-32-characters";
    delete process.env.SEED_COMMISSIONER_EMAIL;
    delete process.env.SEED_RESET_COMMISSIONER_PASSWORD;
    process.env.SEED_COMMISSIONER_PASSWORD = "changeme";
    try {
      unlinkSync("./data/test-ensure-commissioner.db");
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

  it("creates the seed commissioner when missing", async () => {
    await ensureCommissioner();
    const db = getDb();
    const t = schemaTables();
    const rows = await db
      .select()
      .from(t.users)
      .where(eq(t.users.email, "iandkaneshiro@gmail.com"));
    expect(rows[0]?.role).toBe("commissioner");
    expect(await verifyPassword("changeme", rows[0]!.passwordHash!)).toBe(
      true,
    );
  });

  it("moves commissioner@example.com to the seed email", async () => {
    const db = getDb();
    const t = schemaTables();
    await db.delete(t.users);
    await db.insert(t.users).values({
      id: newId(),
      email: "commissioner@example.com",
      displayName: "Commissioner",
      role: "commissioner",
      passwordHash: "old",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await ensureCommissioner();
    const old = await db
      .select()
      .from(t.users)
      .where(eq(t.users.email, "commissioner@example.com"));
    expect(old).toHaveLength(0);
    const moved = await db
      .select()
      .from(t.users)
      .where(eq(t.users.email, "iandkaneshiro@gmail.com"));
    expect(moved).toHaveLength(1);
    expect(await verifyPassword("changeme", moved[0]!.passwordHash!)).toBe(
      true,
    );
  });
});
