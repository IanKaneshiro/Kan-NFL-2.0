import type { NormalizedGame } from "./types";

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  winner?: boolean;
  team?: {
    abbreviation?: string;
    displayName?: string;
    name?: string;
  };
};

type EspnStatus = {
  type?: {
    state?: string;
    completed?: boolean;
    name?: string;
  };
};

type EspnEvent = {
  id?: string;
  date?: string;
  competitions?: Array<{
    competitors?: EspnCompetitor[];
    status?: EspnStatus;
  }>;
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

function mapStatus(
  state: string | undefined,
  completed: boolean | undefined,
): NormalizedGame["status"] {
  if (completed || state === "post") return "final";
  if (state === "in") return "in_progress";
  return "scheduled";
}

export function mapEspnScoreboard(
  json: unknown,
  seasonYear: number,
  week: number,
): NormalizedGame[] {
  const board = json as EspnScoreboard;
  const events = board.events ?? [];
  const out: NormalizedGame[] = [];

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp || !event.id || !event.date) continue;
    const competitors = comp.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home?.team?.abbreviation || !away?.team?.abbreviation) continue;

    const status = mapStatus(
      comp.status?.type?.state,
      comp.status?.type?.completed,
    );

    let winnerTeam: string | null = null;
    if (status === "final") {
      if (home.winner) winnerTeam = home.team.abbreviation;
      else if (away.winner) winnerTeam = away.team.abbreviation;
      else {
        const hs = Number(home.score);
        const as = Number(away.score);
        if (Number.isFinite(hs) && Number.isFinite(as) && hs !== as) {
          winnerTeam = hs > as ? home.team.abbreviation : away.team.abbreviation;
        }
      }
    }

    out.push({
      externalId: String(event.id),
      seasonYear,
      week,
      kickoffAt: new Date(event.date),
      homeTeam: home.team.abbreviation,
      awayTeam: away.team.abbreviation,
      homeName: home.team.displayName ?? home.team.name,
      awayName: away.team.displayName ?? away.team.name,
      status,
      winnerTeam,
    });
  }

  return out;
}
