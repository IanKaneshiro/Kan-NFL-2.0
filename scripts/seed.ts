import "dotenv/config";
import { eq } from "drizzle-orm";
import { createSetupToken } from "../src/auth/setup-token";
import { getDb, resetDbCache, schemaTables } from "../src/db";
import { ensureCommissioner } from "../src/db/ensure-commissioner";
import { newId } from "../src/domain/ids";

async function main() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./data/local.db";
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    process.env.SESSION_SECRET = "dev-only-session-secret-min-32-chars!!";
  }

  resetDbCache();
  await ensureCommissioner();

  const db = getDb();
  const t = schemaTables();

  const samplePlayers = [
    { email: "brother1@example.com", displayName: "Brother One" },
    { email: "brother2@example.com", displayName: "Brother Two" },
  ];

  for (const p of samplePlayers) {
    const email = p.email.toLowerCase();
    const rows = await db.select().from(t.users).where(eq(t.users.email, email));
    if (rows[0]) {
      console.log(`Player exists: ${email}`);
      continue;
    }
    const id = newId();
    const { rawToken, tokenHash, expiresAt } = createSetupToken();
    await db.insert(t.users).values({
      id,
      email,
      displayName: p.displayName,
      role: "player",
      passwordHash: null,
      setupTokenHash: tokenHash,
      setupTokenExpiresAt: expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`Player ${p.displayName} (${email}) setup: /setup?token=${rawToken}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
