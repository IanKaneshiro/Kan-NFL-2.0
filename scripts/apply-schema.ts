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
    console.log(`Applied SQLite schema to ${abs}`);
    return;
  }

  const sql = postgres(url.replace(/^postgres:\/\//, "postgresql://"), { max: 1 });
  await sql.unsafe(PG_DDL);
  await sql.end();
  console.log("Applied Postgres schema");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
