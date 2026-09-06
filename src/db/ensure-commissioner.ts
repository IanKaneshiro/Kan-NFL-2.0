import { eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { newId } from "../domain/ids";
import { getDb, schemaTables } from "./index";

export function commissionerSeedEmail() {
  return (
    process.env.SEED_COMMISSIONER_EMAIL ?? "iandkaneshiro@gmail.com"
  ).trim().toLowerCase();
}

export function commissionerSeedPassword() {
  return process.env.SEED_COMMISSIONER_PASSWORD || "changeme";
}

/** Create the commissioner if missing; set a password if the row has none. */
export async function ensureCommissioner() {
  const db = getDb();
  const t = schemaTables();
  const email = commissionerSeedEmail();
  const password = commissionerSeedPassword();
  const reset = process.env.SEED_RESET_COMMISSIONER_PASSWORD === "true";

  const existing = await db
    .select()
    .from(t.users)
    .where(eq(t.users.email, email));
  const user = existing[0];

  if (!user) {
    await db.insert(t.users).values({
      id: newId(),
      email,
      displayName: "Commissioner",
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

  if (!user.passwordHash || reset) {
    await db
      .update(t.users)
      .set({
        passwordHash: await hashPassword(password),
        updatedAt: new Date(),
      })
      .where(eq(t.users.id, user.id));
    console.log(
      reset
        ? `Reset commissioner password for ${email}`
        : `Set missing password for ${email}`,
    );
    return;
  }

  console.log(`Commissioner already exists: ${email}`);
}
