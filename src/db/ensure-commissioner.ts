import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { newId } from "../domain/ids";
import { getDb, schemaTables } from "./index";

const LEGACY_COMMISSIONER_EMAIL = "commissioner@example.com";
/** One deploy only: set commissioner password to changeme, then never again. */
export const COMMISSIONER_PASSWORD_RESET_TOKEN =
  "commissioner-pw-reset-2026-09-06";

export function commissionerSeedEmail() {
  return (
    process.env.SEED_COMMISSIONER_EMAIL ?? "iandkaneshiro@gmail.com"
  )
    .trim()
    .toLowerCase();
}

export function commissionerSeedPassword() {
  return process.env.SEED_COMMISSIONER_PASSWORD || "changeme";
}

async function uniqueDisplayName(
  desired: string,
  email: string,
): Promise<string> {
  const db = getDb();
  const t = schemaTables();
  const rows = await db.select({ name: t.users.displayName }).from(t.users);
  const taken = new Set(rows.map((r) => r.name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) return desired;
  const fromEmail = email.split("@")[0] || "Commissioner";
  if (!taken.has(fromEmail.toLowerCase())) return fromEmail.slice(0, 32);
  let n = 2;
  while (taken.has(`commish${n}`)) n += 1;
  return `commish${n}`;
}

async function resetCommissionerPasswordOnce(
  userId: string,
  password: string,
) {
  const db = getDb();
  const t = schemaTables();
  const done = await db
    .select()
    .from(t.syncRuns)
    .where(eq(t.syncRuns.message, COMMISSIONER_PASSWORD_RESET_TOKEN));
  if (done[0]) return;

  await db
    .update(t.users)
    .set({
      passwordHash: await hashPassword(password),
      updatedAt: new Date(),
    })
    .where(eq(t.users.id, userId));
  await db.insert(t.syncRuns).values({
    id: newId(),
    startedAt: new Date(),
    finishedAt: new Date(),
    ok: true,
    message: COMMISSIONER_PASSWORD_RESET_TOKEN,
  });
  console.log("One-time reset: commissioner password is now the seed password");
}

/** Create the commissioner if missing; one-time password reset if not yet applied. */
export async function ensureCommissioner() {
  const db = getDb();
  const t = schemaTables();
  const email = commissionerSeedEmail();
  const password = commissionerSeedPassword();

  const existing = await db
    .select()
    .from(t.users)
    .where(eq(t.users.email, email));
  const user = existing[0];

  if (!user) {
    const legacy = await db
      .select()
      .from(t.users)
      .where(eq(t.users.email, LEGACY_COMMISSIONER_EMAIL));
    if (legacy[0]) {
      await db
        .update(t.users)
        .set({
          email,
          updatedAt: new Date(),
        })
        .where(eq(t.users.id, legacy[0].id));
      console.log(
        `Moved commissioner ${LEGACY_COMMISSIONER_EMAIL} → ${email}`,
      );
      await resetCommissionerPasswordOnce(legacy[0].id, password);
      return;
    }

    const id = newId();
    await db.insert(t.users).values({
      id,
      email,
      displayName: await uniqueDisplayName("Commissioner", email),
      role: "commissioner",
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(
      `Created commissioner ${email} (change password at /account)`,
    );
    await resetCommissionerPasswordOnce(id, password);
    return;
  }

  if (!user.passwordHash) {
    await db
      .update(t.users)
      .set({
        passwordHash: await hashPassword(password),
        updatedAt: new Date(),
      })
      .where(eq(t.users.id, user.id));
    console.log(`Set missing password for ${email}`);
  }
  await resetCommissionerPasswordOnce(user.id, password);
}

let ensured: Promise<void> | undefined;

export function ensureCommissionerOnce() {
  if (!ensured) {
    ensured = ensureCommissioner().catch((e) => {
      ensured = undefined;
      throw e;
    });
  }
  return ensured;
}
