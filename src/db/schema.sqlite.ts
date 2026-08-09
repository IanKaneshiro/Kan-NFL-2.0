import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    role: text("role").notNull().$type<"player" | "commissioner">(),
    setupTokenHash: text("setup_token_hash"),
    setupTokenExpiresAt: integer("setup_token_expires_at", {
      mode: "timestamp_ms",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("users_email_uidx").on(t.email)],
);

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id").notNull(),
    seasonYear: integer("season_year").notNull(),
    week: integer("week").notNull(),
    kickoffAt: integer("kickoff_at", { mode: "timestamp_ms" }).notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    homeName: text("home_name"),
    awayName: text("away_name"),
    status: text("status")
      .notNull()
      .$type<"scheduled" | "in_progress" | "final">(),
    winnerTeam: text("winner_team"),
    winnerOverride: integer("winner_override", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("games_external_id_uidx").on(t.externalId)],
);

export const picks = sqliteTable(
  "picks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    week: integer("week").notNull(),
    pickedTeam: text("picked_team").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [uniqueIndex("picks_user_game_uidx").on(t.userId, t.gameId)],
);

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  ok: integer("ok", { mode: "boolean" }),
  message: text("message"),
});
