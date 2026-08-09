import { Effect } from "effect";
import { NflApiError } from "@/domain/errors";
import { mapEspnScoreboard } from "./map-espn";
import type { NormalizedGame } from "./types";

export function fetchEspnWeek(
  seasonYear: number,
  week: number,
): Effect.Effect<NormalizedGame[], NflApiError> {
  return Effect.tryPromise({
    try: async () => {
      const url = new URL(
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
      );
      url.searchParams.set("seasontype", "2");
      url.searchParams.set("week", String(week));
      url.searchParams.set("dates", String(seasonYear));

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        throw new NflApiError({
          message: `ESPN scoreboard HTTP ${res.status}`,
        });
      }
      const json = await res.json();
      return mapEspnScoreboard(json, seasonYear, week);
    },
    catch: (e) =>
      e instanceof NflApiError
        ? e
        : new NflApiError({ message: String(e) }),
  });
}
