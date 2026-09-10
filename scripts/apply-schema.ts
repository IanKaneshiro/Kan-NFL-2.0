import "dotenv/config";
import { createClient } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { isSqliteUrl, sqliteFilePath } from "../src/db/dialect";

const SQLITE_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL,
  setup_token_hash TEXT,
  setup_token_expires_at INTEGER,
  avatar_id TEXT NOT NULL DEFAULT 'fun-football',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx ON users(email);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  kickoff_at INTEGER NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_name TEXT,
  away_name TEXT,
  status TEXT NOT NULL,
  winner_team TEXT,
  home_score INTEGER,
  away_score INTEGER,
  winner_override INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS games_external_id_uidx ON games(external_id);

CREATE TABLE IF NOT EXISTS picks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  picked_team TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX IF NOT EXISTS picks_user_game_uidx ON picks(user_id, game_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  ok INTEGER,
  message TEXT
);
`;

const PG_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL,
  setup_token_hash TEXT,
  setup_token_expires_at TIMESTAMPTZ,
  avatar_id TEXT NOT NULL DEFAULT 'fun-football',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uidx ON users(email);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  external_id TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  kickoff_at TIMESTAMPTZ NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_name TEXT,
  away_name TEXT,
  status TEXT NOT NULL,
  winner_team TEXT,
  home_score INTEGER,
  away_score INTEGER,
  winner_override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS games_external_id_uidx ON games(external_id);

CREATE TABLE IF NOT EXISTS picks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  week INTEGER NOT NULL,
  picked_team TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS picks_user_game_uidx ON picks(user_id, game_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  ok BOOLEAN,
  message TEXT
);
`;

function isDisplayNameIndexDuplicateError(e: unknown): boolean {
  const msg = String(e);
  return (
    /unique constraint failed/i.test(msg) ||
    /duplicate key/i.test(msg) ||
    /could not create unique index/i.test(msg)
  );
}

async function createDisplayNameUniqueIndexSqlite(
  client: ReturnType<typeof createClient>,
): Promise<void> {
  try {
    await client.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_uidx ON users(display_name)",
    );
  } catch (e) {
    if (!isDisplayNameIndexDuplicateError(e)) throw e;
    console.error(
      "WARNING: skipped users_display_name_uidx — duplicate display_name values exist; resolve before enforcing uniqueness:",
      e,
    );
  }
}

async function createDisplayNameUniqueIndexPostgres(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  try {
    await sql.unsafe(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_display_name_uidx ON users(display_name)",
    );
  } catch (e) {
    if (!isDisplayNameIndexDuplicateError(e)) throw e;
    console.error(
      "WARNING: skipped users_display_name_uidx — duplicate display_name values exist; resolve before enforcing uniqueness:",
      e,
    );
  }
}

async function addSqliteColumn(
  client: ReturnType<typeof createClient>,
  ddl: string,
): Promise<void> {
  try {
    await client.execute(ddl);
  } catch (e) {
    const msg = String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  if (isSqliteUrl(url)) {
    const file = sqliteFilePath(url);
    const abs = resolve(file);
    mkdirSync(dirname(abs), { recursive: true });
    const client = createClient({ url: `file:${abs}` });
    for (const stmt of SQLITE_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await client.execute(stmt);
    }
    await addSqliteColumn(
      client,
      "ALTER TABLE users ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'fun-football'",
    );
    await addSqliteColumn(client, "ALTER TABLE games ADD COLUMN home_score INTEGER");
    await addSqliteColumn(client, "ALTER TABLE games ADD COLUMN away_score INTEGER");
    await createDisplayNameUniqueIndexSqlite(client);
    console.log(`Applied SQLite schema to ${abs}`);
    return;
  }

  const sql = postgres(url.replace(/^postgres:\/\//, "postgresql://"), { max: 1 });
  await sql.unsafe(PG_DDL);
  await sql.unsafe(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'fun-football'",
  );
  await sql.unsafe(
    "ALTER TABLE games ADD COLUMN IF NOT EXISTS home_score INTEGER",
  );
  await sql.unsafe(
    "ALTER TABLE games ADD COLUMN IF NOT EXISTS away_score INTEGER",
  );
  await createDisplayNameUniqueIndexPostgres(sql);
  await sql.end();
  console.log("Applied Postgres schema");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
