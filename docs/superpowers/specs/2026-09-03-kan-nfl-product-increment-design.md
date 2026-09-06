# Kan NFL Pick’em — Product increment design

**Date:** 2026-09-03  
**Status:** Approved for implementation planning  
**Workspace:** `kan-nfl-2.0`  
**Baseline:** `docs/superpowers/specs/2026-08-08-kan-nfl-pickem-design.md` (core pick’em already implemented)  
**Legacy product:** `projects/kan-nfl` (Clerk + Supabase; informs Trends UX only)

## Problem

The 2.0 rewrite already has private login, Render Postgres, ESPN sync, server locks, picks, leaderboard, and admin. It is missing the old app’s social Trends page, a signed-in home that answers “what do I do now?”, install-on-phone, profile identity after dropping Clerk, and a keep-alive so Render’s free web service does not sleep.

## Goals

- Keep all 2.0 core behavior (auth, locks, reveal, scoring, sync, admin).
- Port **Trends** from the old app: consensus and who-picked-what, with **server-side reveal** (no pre-kickoff leak).
- **Home dashboard** for signed-in users.
- **PWA** (Add to Home Screen).
- **Profiles:** unique typed display name + **preset avatars** (no photo upload).
- **Keep-alive** ping of `/api/health` so the free Render service stays warm.
- **Admin winner override** from a week’s game list, not a raw internal id.

## Non-goals

- Custom photo / file uploads
- Confidence points, survivor, spreads, playoffs
- Email / SMS provider
- Live in-game scoreboard, weekly recap, Monday math
- AI, public signup, Clerk, MongoDB, Supabase
- Restarting in the old `projects/kan-nfl` repo

## Architecture

Unchanged from the baseline: Next.js 15 on Render → iron-session → Effect domain → Drizzle → Postgres (prod) / SQLite (local) → ESPN server-only.

Additions:

```text
Signed-in browser / PWA
  /                 dashboard
  /picks            existing
  /trends           new
  /leaderboard      existing + avatars
  /account          password + name + avatar
  /admin            existing + game picker

External cron (UptimeRobot or GitHub Action)
  GET /api/health   every 5 minutes
```

## Data model

### `users` (additive)

Existing columns stay. Add:

- `avatar_id` TEXT NOT NULL DEFAULT `'fun-football'`
- Unique index on `display_name` (exact stored value)

`avatar_id` must be a key in the in-app catalog. Unknown ids are rejected on write; reads fall back to `fun-football`.

Display name rules:

- Trim whitespace
- Length 2–32 characters
- Unique in the league, compared case-insensitively in domain code
- Players may change their own name on Account; commissioner-created names follow the same uniqueness rules

### Avatar catalog (code, not a table)

File: `src/domain/avatars.ts`

- 32 NFL teams: ids `nfl-ari`, `nfl-atl`, … `nfl-was` (lowercase abbreviation)
- Fun extras: `fun-football`, `fun-trophy`, `fun-helmet`, `fun-question`
- Each entry: `{ id, label, emoji }` (emoji as the visible mark; no image assets required)

Default for new users: `fun-football`.

### No new tables

Trends, dashboard, and who-picked are queries over `games`, `picks`, and `users`. Scoring stays derived.

## Product surfaces

| Route | Access | Behavior |
|--------|--------|----------|
| `/` logged out | Public | Existing marketing home |
| `/` logged in | Player | **Dashboard** (replaces marketing) |
| `/picks` | Player | Unchanged |
| `/trends` | Player | Week consensus; tap a side → who picked it |
| `/leaderboard` | Player | Existing week/season + avatars |
| `/account` | Player | Password, display name, avatar grid |
| `/admin` | Commissioner | Users, tokens, sync, **week game list** for override |
| `/login`, `/setup` | Public | Unchanged |
| `/api/health` | Public | Unchanged; target of keep-alive |

Nav (logged in): Home, Picks, Trends, Leader Board, Account, Admin if commissioner. Nav shows avatar + display name.

### Dashboard

Show:

- Avatar + display name
- Season rank and points (same aggregation as leaderboard)
- Current week number
- Games left to pick this week (unlocked games with no pick)
- Next lock: earliest future `kickoff_at` among this week’s games
- Links: Make picks, Trends, Leaderboard

Empty/stale: if no games synced, say so and point commissioner to Admin sync.

### Trends

- Week switcher 1–18, default current week
- Only **revealed** games (`now >= kickoff_at`) appear
- Per game: home/away pick counts and percentages among picks that exist
- Consensus label from the leading side’s share: High ≥70%, Moderate ≥60%, Slight ≥55%, else Split
- Popular teams: top sides by pick count that week (revealed games only)
- Click a side: list of `{ displayName, avatarId }` who picked it
- Unrevealed games: omitted entirely (do not show “hidden” counts)

### Profiles

Account page sections:

1. Display name (save)
2. Avatar grid (select saves immediately or with a Save on the section)
3. Change password (existing)

### PWA

- `app/manifest.ts`: name “Kan NFL Pick’em”, `display: standalone`, `start_url: "/"`, theme dark gray, background `#111827`
- Icons from existing `public/` SVGs plus Apple web-app capable metadata
- No offline-first service worker required; installability is enough

### Keep-alive

- Primary: document hitting `https://<render-host>/api/health` every 5 minutes (UptimeRobot or cron-job.org)
- Repo: GitHub Action on a schedule calling the same URL via `KEEPALIVE_URL` secret, plus `workflow_dispatch`
- Honest note in README: GitHub cron is not always 5-minute-accurate; an external uptime ping is the reliable keep-warm

### Admin override

Commissioner picks a week, sees that week’s games as “AWAY @ HOME — kickoff”, chooses home / away / TIE (or clear). POST still uses internal `gameId` under the hood.

## Domain programs (new)

- `listAvatars()` / `isValidAvatarId(id)`
- `updateProfile(userId, { displayName?, avatarId? })`
- `getDashboard(userId)`
- `getWeekTrends(week)` — revealed games only
- `getTeamPickers(gameId, pickedTeam)` — 404 if game unrevealed

Typed errors: existing set plus `ValidationError` for taken names / bad avatar. Unrevealed game on team-pickers → `NotFound`.

## Errors & edge cases

| Situation | Behavior |
|-----------|----------|
| Duplicate display name | 400 “That display name is taken” |
| Avatar id not in catalog | 400 |
| Trends for a week with no revealed games | Empty state, not an error |
| Team-pickers before kickoff | 404 |
| Dashboard with no sync | Empty week, 0 games left, no next lock |
| Health DB down | 503 (existing); keep-alive will alert |
| Name change | Leaderboard, nav, trends, dashboard update on next load |

## Testing

- Avatars: catalog contains 32 teams + 4 fun; invalid id rejected
- `updateProfile`: unique case-insensitive name; other user unchanged
- Trends: locked-unrevealed game excluded; revealed included; percentages
- Team pickers: empty before kickoff (NotFound); names after
- Dashboard: counts unlocked unpicked games; next lock is min future kickoff
- Existing lock/reveal/scoring tests stay green

## Success criteria

- Signed-in `/` is a useful dashboard
- Trends matches old-app social value without leaking unrevealed picks
- Players can change name and pick a preset avatar; both show on board/trends/nav
- App is installable on a phone home screen
- README explains the 5-minute health ping; a GitHub workflow exists
- Commissioner can override a winner by picking a game from a list

## Implementation notes

1. Schema `avatar_id` + unique display name + catalog + `updateProfile`
2. Account UI + avatar on nav/leaderboard
3. Trends domain, APIs, page
4. Dashboard on `/`
5. PWA manifest
6. Admin game picker
7. Keep-alive workflow + README
