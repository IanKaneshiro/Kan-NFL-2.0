# Kan NFL Pick’em 2.0 — Design

**Date:** 2026-08-08  
**Status:** Approved for implementation planning  
**Workspace:** `kan-nfl-2.0`  
**References:** `ians-mcp` (deploy/stack patterns), `projects/kan-nfl` (legacy product), [Effect](https://www.effect.website/)

## Problem

Each NFL regular season, brothers submit weekly game winners. Correct pick = 1 point; wrong or missed = 0. Need a private web app: self-service login, weekly picks with fair lock/reveal rules, auto schedule/scores, season leaderboard. Deploy on Render with Postgres like `ians-mcp`.

## Goals (v1)

- Multi-user private pick’em for the full **regular season (weeks 1–18)**
- **Login/logout in players’ hands** (password after one-time setup)
- **Picks page**, **leaderboard**, light **commissioner admin**
- **Per-game lock at kickoff**; **others’ picks hidden until kickoff**
- **All games required** for fair comparison (miss after kickoff = 0)
- **Auto schedule + results from a free NFL API** (server-side)
- Points **aggregated** from picks + final games (not a separate points ledger)
- Stack: Next.js, Drizzle, Render Postgres (+ SQLite local), iron-session, **Effect** for domain

## Non-goals (v1)

- AI insights / roasts / pick suggestions
- Playoffs, preseason, spreads, confidence pools
- Third-party auth (Clerk, Auth0, etc.)
- Required email/SMS delivery provider
- Public signup, multi-league, mobile native apps
- MCP server

## Approach

**ians-mcp skeleton + Effect domain + pick’em product** (greenfield in this repo):

- Mirror `ians-mcp` ops: Next 15 App Router, Drizzle dual dialect, `render.yaml`, vitest, health check
- Multi-player sessions (not single-owner env password)
- Domain rules and NFL sync orchestration as Effect programs
- Legacy `kan-nfl` informs UX/schema ideas only (not Clerk/Supabase)

## Architecture

```text
Browser
  → Next.js 15 (App Router) on Render
      → iron-session cookie (userId, role)
      → Route handlers / server actions
          → Effect domain (picks, locks, scoring, sync)
          → Drizzle ORM
              → Postgres (Render production)
              → SQLite file (local development)
      → NFL provider adapter (server-only free HTTP API)
```

| Layer | Responsibility |
|--------|----------------|
| UI | Login, password setup, picks, leaderboard, admin |
| HTTP / session | Authz, boundary validation, JSON/error mapping |
| Domain (Effect) | Lock/reveal rules, save picks, leaderboard aggregate, sync |
| DB | Users, games, picks, sync metadata |
| NFL provider | Fetch schedule/scores → normalize to `Game` |

## Data model

### `users`

- `id` (stable string/ULID)
- `email` (unique)
- `display_name`
- `password_hash` (nullable until setup complete)
- `role`: `player` | `commissioner`
- Optional setup/reset: `setup_token_hash`, `setup_token_expires_at`
- timestamps

### `games`

- `id` (internal) + `external_id` (API id, unique)
- `season_year`, `week` (1–18)
- `kickoff_at` (UTC)
- `home_team`, `away_team` (codes); optional display names
- `status`: `scheduled` | `in_progress` | `final`
- `winner_team` (nullable)
- `winner_override` (boolean): when true, auto-sync must not clobber `winner_team`
- timestamps / last synced markers as needed

### `picks`

- `id`
- `user_id` → users
- `game_id` → games
- `picked_team`
- unique `(user_id, game_id)`
- optional denormalized `week` for query convenience
- timestamps

### `sync_runs` (lightweight)

- last run time, success/failure, message (ops/debug)

### Scoring (derived)

No separate points table.

```text
for each game where status = final and winner_team is set:
  if user pick exists and picked_team == winner_team → +1
  else → +0
```

- Season leaderboard = sum over all such games in season
- Week view = same filter by week
- Missed pick (no row after kickoff) = 0 for that game
- Tie / no winner declared: no one receives a point for that game

## Auth

1. **Commissioner seeds** allowlisted users (email + display name) via admin or seed script.
2. **One-time setup:** tokenized link → user sets password → bcrypt hash stored.
3. **Login:** email + password → iron-session (long TTL, e.g. 60–90 days) so season use is smooth.
4. **Logout:** clears session; re-login is fully self-service.
5. **Password change while logged in:** included in v1 (self-service; no email).
6. **Forgot password without email:** commissioner issues new setup/reset token and shares once. Self-service email reset is out of scope until a mail path exists.

**Authorization**

- Unauthenticated: only login/setup/health
- Players: write own picks for unlocked games; read leaderboard; read others’ picks only when `kickoff_at <= now`
- Commissioner: manage users, generate setup tokens, force sync, optional winner override

## Product surfaces

| Route | Access | Behavior |
|--------|--------|----------|
| `/login` | Public | Email + password |
| `/setup` | Token | Set password once |
| `/picks` | Player | Week slate, pick home/away, save |
| `/leaderboard` | Player | Season totals; optional week filter |
| `/admin` | Commissioner | Users, tokens, sync, winner override |

### Picks

- Default to current NFL week; week switcher 1–18
- Games ordered by kickoff
- Batch save (or equivalent) upserts picks for **open** games only
- **Lock:** server rejects create/update when `now >= kickoff_at` for that game
- Past weeks: view results; no edits after lock
- **Reveal:** for games with `now >= kickoff_at`, show all brothers’ picks (and correctness once final). Before kickoff, only the current user’s pick is visible. **Server enforces** hide/show.

### Leaderboard

- Display name, points (and simple record if useful)
- Stable sort: points desc, then display name
- Ties share the same point total (rank display can be competition or dense; pick one in implementation)

## NFL sync

- Single server-only adapter (`nfl/provider` or similar)
- Concrete free source chosen during implementation (e.g. public scoreboard/schedule HTTP endpoints); fixture-based tests so provider can swap
- App DB is source of truth between syncs
- **Triggers:** throttled refresh on picks/leaderboard load when stale; commissioner “Sync now”; optional Render cron later (not required for v1)
- **Upsert** by `external_id`; update kickoff/status/winner; never delete picks on game update
- Respect `winner_override`
- Season year + week bounds configurable (not hard-coded forever)

## Effect usage

Domain programs (illustrative):

- `savePicks`
- `getWeekPicksView` (own picks + conditional reveal)
- `getLeaderboard`
- `syncSchedule` / `syncScores` (or combined `syncWeek`)

Typed errors mapped at HTTP boundary, including:

- `Unauthorized`, `Forbidden`
- `GameLocked`
- `ValidationError`
- `NflApiError`
- `NotFound`
- `InvalidCredentials` / setup token errors

UI remains React; Effect is not required in every client component.

## Errors & edge cases

| Situation | Behavior |
|-----------|----------|
| Bad login | Generic invalid credentials message |
| Bad/expired setup token | Clear recovery message (ask commissioner) |
| Pick after kickoff | Reject that game (`GameLocked`); other open games may still save |
| NFL API down | Serve last synced data; surface stale warning; retry sync |
| Non-commissioner admin | 403 |
| Kickoff time change | Lock uses latest `kickoff_at` after sync |
| Partial week picks | Allowed; missing after lock = 0 |

## Testing

Vitest (aligned with `ians-mcp`):

- Unit: lock rule, reveal rule, aggregation, missed pick = 0, override flag
- Integration: save picks, reject locked game, setup/login session
- Provider: map fixture JSON → games (mocked HTTP)
- Smoke: `/api/health`

## Deploy & local (ians-mcp-shaped)

**Production (Render)**

- Web service + Postgres via `render.yaml`
- Env: `DATABASE_URL`, `SESSION_SECRET`, season config as needed, provider env if any
- Health: `/api/health`
- Build/start pattern similar to `ians-mcp` (`npm ci --include=dev && npm run build`)

**Local**

- SQLite via `DATABASE_URL=file:./data/local.db` (or equivalent)
- Seed commissioner + sample brothers
- Optional mocked NFL fixtures if live API unavailable

## Success criteria

- Brothers can set password once, then login/logout all season without commissioner involvement
- Each week they pick all games before respective kickoffs
- After kickoff, picks for that game are visible to the group
- After games finalize via sync, leaderboard points match correct-pick counts
- App runs on Render with Postgres; local dev works without cloud DB

## Implementation notes (for planning)

1. Scaffold Next app + Drizzle dual dialect + Effect + iron-session + vitest + render.yaml  
2. Auth: users, setup token, login/logout, middleware  
3. Schema: games, picks, sync_runs  
4. NFL provider adapter + sync upsert  
5. Domain: save picks, lock, reveal, leaderboard  
6. UI: picks, leaderboard, admin  
7. Deploy docs and seed path  

AI insights remain a later epic after core game loop is solid.
