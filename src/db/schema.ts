import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    role: text("role").notNull().$type<"player" | "commissioner">(),
    setupTokenHash: text("setup_token_hash"),
    setupTokenExpiresAt: timestamp("setup_token_expires_at", {
      withTimezone: true,
    }),
    avatarId: text("avatar_id").notNull().default("fun-football"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_uidx").on(t.email),
    uniqueIndex("users_display_name_uidx").on(t.displayName),
  ],
);

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey(),
    externalId: text("external_id").notNull(),
    seasonYear: integer("season_year").notNull(),
    week: integer("week").notNull(),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    homeName: text("home_name"),
    awayName: text("away_name"),
    status: text("status")
      .notNull()
      .$type<"scheduled" | "in_progress" | "final">(),
    winnerTeam: text("winner_team"),
    winnerOverride: boolean("winner_override").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("games_external_id_uidx").on(t.externalId)],
);

export const picks = pgTable(
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("picks_user_game_uidx").on(t.userId, t.gameId)],
);

export const syncRuns = pgTable("sync_runs", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  message: text("message"),
});
