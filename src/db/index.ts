import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { isSqliteUrl, sqliteFilePath } from "./dialect";
import * as pgSchema from "./schema";
import * as sqliteSchema from "./schema.sqlite";

const globalForDb = globalThis as unknown as {
  pgClient: ReturnType<typeof postgres> | undefined;
  libsql: Client | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any | undefined;
};

export function normalizeDatabaseUrl(url: string): string {
  return url.replace(/^postgres:\/\//, "postgresql://");
}

export { isSqliteUrl, sqliteFilePath } from "./dialect";

export function toLibsqlUrl(url: string): string {
  const file = sqliteFilePath(url);
  const abs = resolve(file);
  mkdirSync(dirname(abs), { recursive: true });
  return `file:${abs}`;
}

function createPgDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.pgClient) {
    globalForDb.pgClient = postgres(normalizeDatabaseUrl(raw), { max: 10 });
  }
  return drizzlePg(globalForDb.pgClient, { schema: pgSchema });
}

function createSqliteDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.libsql) {
    globalForDb.libsql = createClient({ url: toLibsqlUrl(raw) });
  }
  return drizzleLibsql(globalForDb.libsql, { schema: sqliteSchema });
}

export type Db = PostgresJsDatabase<typeof pgSchema>;

export function getDb(): Db {
  if (!globalForDb.db) {
    globalForDb.db = isSqliteUrl() ? createSqliteDb() : createPgDb();
  }
  return globalForDb.db as Db;
}

/** Reset cached client (tests). */
export function resetDbCache(): void {
  globalForDb.db = undefined;
  globalForDb.libsql = undefined;
  globalForDb.pgClient = undefined;
}

export async function pingDb(): Promise<void> {
  if (isSqliteUrl()) {
    if (!globalForDb.libsql) getDb();
    await globalForDb.libsql!.execute("select 1");
    return;
  }
  const db = getDb();
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`select 1`);
}

/** Runtime tables for active dialect; typed as Postgres schema for one API surface. */
export function schemaTables(): typeof pgSchema {
  return (isSqliteUrl() ? sqliteSchema : pgSchema) as unknown as typeof pgSchema;
}
