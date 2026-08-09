import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "@/auth/password";
import { createSetupToken, hashSetupToken } from "@/auth/setup-token";
import { getDb, schemaTables } from "@/db";
import { newId } from "@/domain/ids";
import {
  InvalidCredentials,
  NotFound,
  SetupTokenInvalid,
  ValidationError,
} from "@/domain/errors";

export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: "player" | "commissioner";
  passwordHash: string | null;
};

function tables() {
  return schemaTables();
}

export function createUser(input: {
  email: string;
  displayName: string;
  role: "player" | "commissioner";
}) {
  return Effect.tryPromise({
    try: async () => {
      const email = input.email.trim().toLowerCase();
      const displayName = input.displayName.trim();
      if (!email || !email.includes("@")) {
        throw new ValidationError({ message: "Valid email required" });
      }
      if (!displayName) {
        throw new ValidationError({ message: "Display name required" });
      }
      const db = getDb();
      const t = tables();
      const id = newId();
      await db.insert(t.users).values({
        id,
        email,
        displayName,
        role: input.role,
        passwordHash: null,
      });
      return { id, email, displayName, role: input.role };
    },
    catch: (e) =>
      e instanceof ValidationError
        ? e
        : new ValidationError({ message: String(e) }),
  });
}

export function issueSetupToken(userId: string) {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = tables();
      const { rawToken, tokenHash, expiresAt } = createSetupToken();
      const updated = await db
        .update(t.users)
        .set({
          setupTokenHash: tokenHash,
          setupTokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(t.users.id, userId))
        .returning({ id: t.users.id });
      if (!updated.length) throw new NotFound({ entity: "user" });
      return {
        rawToken,
        setupPath: `/setup?token=${rawToken}`,
        expiresAt,
      };
    },
    catch: (e) =>
      e instanceof NotFound
        ? e
        : new ValidationError({ message: String(e) }),
  });
}

export function completeSetup(rawToken: string, password: string) {
  return Effect.tryPromise({
    try: async () => {
      if (!password || password.length < 8) {
        throw new ValidationError({
          message: "Password must be at least 8 characters",
        });
      }
      const db = getDb();
      const t = tables();
      const tokenHash = hashSetupToken(rawToken);
      const rows = await db.select().from(t.users).where(eq(t.users.setupTokenHash, tokenHash));
      const user = rows[0];
      if (!user?.setupTokenHash || !user.setupTokenExpiresAt) {
        throw new SetupTokenInvalid({});
      }
      const exp =
        user.setupTokenExpiresAt instanceof Date
          ? user.setupTokenExpiresAt
          : new Date(user.setupTokenExpiresAt as unknown as string | number);
      if (exp.getTime() < Date.now()) throw new SetupTokenInvalid({});

      const passwordHash = await hashPassword(password);
      await db
        .update(t.users)
        .set({
          passwordHash,
          setupTokenHash: null,
          setupTokenExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(t.users.id, user.id));

      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as "player" | "commissioner",
      };
    },
    catch: (e) => {
      if (
        e instanceof SetupTokenInvalid ||
        e instanceof ValidationError
      ) {
        return e;
      }
      return new SetupTokenInvalid({});
    },
  });
}

export function login(email: string, password: string) {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = tables();
      const normalized = email.trim().toLowerCase();
      const rows = await db
        .select()
        .from(t.users)
        .where(eq(t.users.email, normalized));
      const user = rows[0];
      if (!user?.passwordHash) throw new InvalidCredentials({});
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) throw new InvalidCredentials({});
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as "player" | "commissioner",
      };
    },
    catch: (e) =>
      e instanceof InvalidCredentials ? e : new InvalidCredentials({}),
  });
}

export function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  return Effect.tryPromise({
    try: async () => {
      if (!newPassword || newPassword.length < 8) {
        throw new ValidationError({
          message: "Password must be at least 8 characters",
        });
      }
      const db = getDb();
      const t = tables();
      const rows = await db.select().from(t.users).where(eq(t.users.id, userId));
      const user = rows[0];
      if (!user?.passwordHash) throw new InvalidCredentials({});
      const ok = await verifyPassword(currentPassword, user.passwordHash);
      if (!ok) throw new InvalidCredentials({});
      const passwordHash = await hashPassword(newPassword);
      await db
        .update(t.users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(t.users.id, userId));
    },
    catch: (e) => {
      if (e instanceof ValidationError || e instanceof InvalidCredentials) {
        return e;
      }
      return new InvalidCredentials({});
    },
  });
}

export function listUsers() {
  return Effect.tryPromise({
    try: async () => {
      const db = getDb();
      const t = tables();
      const rows = await db.select().from(t.users);
      return rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role as "player" | "commissioner",
        hasPassword: Boolean(u.passwordHash),
      }));
    },
    catch: (e) => new ValidationError({ message: String(e) }),
  });
}
