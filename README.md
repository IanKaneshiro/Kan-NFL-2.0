# Kan NFL Pick’em 2.0

Private brother pick’em for the NFL regular season (weeks 1–18).

- **Auth:** allowlisted users, one-time setup link → password, self-service login/logout (iron-session, 90 days)
- **Picks:** per-game lock at kickoff; others’ picks reveal after kickoff
- **Scores:** free ESPN scoreboard API (server-side), points derived from correct picks
- **Deploy:** Render web + Postgres (same shape as `ians-mcp`); local SQLite

Design: `docs/superpowers/specs/2026-08-08-kan-nfl-pickem-design.md`  
Plan: `docs/superpowers/plans/2026-08-08-kan-nfl-pickem.md`

## Local setup

```bash
cp .env.example .env
# SESSION_SECRET must be >= 32 chars
# DATABASE_URL=file:./data/local.db
# SEASON_YEAR=2026

npm install
npm run db:apply
npm run seed
npm run dev
```

- Login: http://localhost:3000/login  
  - Commissioner (seed): `commissioner@example.com` / `changeme` (or `SEED_COMMISSIONER_PASSWORD`)
  - Seed prints `/setup?token=…` links for sample brothers
- Health: http://localhost:3000/api/health

```bash
npm test
npm run build
```

## Season ops

1. Admin → add brothers (email + display name)
2. Generate **Setup / reset link** and share once in the family chat
3. They set a password and use login all season
4. **Sync week** (or 1–18) after schedule is published; auto-sync also runs throttled on picks/leaderboard load
5. After MNF, sync again so finals/winners land; leaderboard updates automatically
6. Rare wrong score: **Override winner** with internal game id from the DB/UI (or set after inspecting picks payload)

## Render

1. Blueprint: `render.yaml` (or Web Service + Postgres)
2. Build: `npm ci --include=dev && npm run build` · Start: `npm run start` · Health: `/api/health`
3. Set `SEASON_YEAR` and confirm `SESSION_SECRET` / `DATABASE_URL`
4. Shell after first deploy:

```bash
npm run db:apply
SEED_COMMISSIONER_PASSWORD='…' npm run seed
```

## Stack

Next.js 15 · Drizzle (Postgres / SQLite) · Effect · iron-session · bcryptjs · vitest · ESPN site API (no key)
