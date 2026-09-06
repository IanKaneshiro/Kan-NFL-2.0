import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { newId } from "../domain/ids";
import { getDb, schemaTables } from "./index";

const LEGACY_COMMISSIONER_EMAIL = "commissioner@example.com";

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

/** Create the commissioner if missing; set a password if the row has none. */
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
      const passwordHash =
        legacy[0].passwordHash ?? (await hashPassword(password));
      await db
        .update(t.users)
        .set({
          email,
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(t.users.id, legacy[0].id));
      console.log(
        `Moved commissioner ${LEGACY_COMMISSIONER_EMAIL} → ${email}`,
      );
      return;
    }

    await db.insert(t.users).values({
      id: newId(),
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
