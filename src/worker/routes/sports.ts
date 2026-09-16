import { requireAuth } from "../auth/middleware";
import { rateLimitSports } from "../rate-limit";
import { createSportsDbUrl } from "../services/sportsdb";
import { Hono } from "hono";

import type { AppEnv } from "../auth/middleware";

type SportsResponse = {
  sports: Array<{
    idSport: string;
    strSport: string;
    strFormat: string;
    strSportThumb: string | null;
    strSportDescription: string | null;
  }>;
};

type TeamsResponse = {
  teams: Array<{
    idTeam: string;
    strTeam: string;
    strSport: string;
    idLeague: string;
    strLeague: string;
    strBadge: string | null;
  }> | null;
};

type EventsResponse = {
  events: Array<{
    idEvent: string;
    strEvent: string;
    strSport: string;
    idLeague: string;
    strLeague: string;
    strSeason: string | null;
    dateEvent: string;
    strTime: string | null;
    strTimestamp: string | null;
    idHomeTeam: string | null;
    strHomeTeam: string | null;
    strHomeTeamBadge: string | null;
    idAwayTeam: string | null;
    strAwayTeam: string | null;
    strAwayTeamBadge: string | null;
    strThumb: string | null;
    strVenue: string | null;
    intRound: string | null;
    strStatus: string | null;
  }> | null;
};

type LeaguesResponse = {
  countries: Array<{
    idLeague: string;
    strLeague: string;
    strSport: string;
    strCountry: string | null;
    strBadge: string | null;
  }> | null;
};

type CacheResult<T> = {
  data: T;
  status: "HIT" | "MISS";
};

const SPORTS_CACHE_KEY = "sportsdb:sports:v1";
const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;
const THREE_DAYS_IN_SECONDS = 60 * 60 * 24 * 3;

async function getCachedJson<T>(
  cache: KVNamespace,
  key: string,
  url: URL,
  expirationTtl: number,
): Promise<CacheResult<T> | null> {
  const endpoint = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);

  try {
    const cached = await cache.get<T>(key, "json");

    if (cached) {
      return { data: cached, status: "HIT" };
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error("TheSportsDB request failed", { endpoint, status: response.status });
      return null;
    }

    const data = (await response.json()) as T;

    await cache.put(key, JSON.stringify(data), { expirationTtl });

    return { data, status: "MISS" };
  } catch (error) {
    console.error("TheSportsDB request threw an error", { endpoint, error });
    return null;
  }
}

function leagueUrl(apiKey: string, endpoint: string, leagueId: string) {
  const url = createSportsDbUrl(apiKey, endpoint);
  url.searchParams.set("id", leagueId);
  return url;
}

export const sportsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .use("*", rateLimitSports)
  .get("/", async (c) => {
    const result = await getCachedJson<SportsResponse>(
      c.env.SPORTS_CACHE,
      SPORTS_CACHE_KEY,
      createSportsDbUrl(c.env.SPORTSDB_API_KEY, "all_sports.php"),
      MONTH_IN_SECONDS,
    );

    if (!result) {
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    c.header("X-Cache", result.status);
    return c.json(result.data);
  })
  .get("/leagues/:sport", async (c) => {
    const sport = c.req.param("sport").trim();

    if (!sport || sport.length > 64) {
      console.warn("Invalid sport parameter", { sport });
      return c.json({ error: "Invalid sport" }, 400);
    }

    const url = createSportsDbUrl(c.env.SPORTSDB_API_KEY, "search_all_leagues.php");
    url.searchParams.set("s", sport);

    const result = await getCachedJson<LeaguesResponse>(
      c.env.SPORTS_CACHE,
      `sportsdb:leagues:${sport.toLowerCase()}:v1`,
      url,
      MONTH_IN_SECONDS,
    );

    if (!result) {
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    c.header("X-Cache", result.status);
    return c.json({
      leagues: (result.data.countries ?? []).map((league) => ({
        idLeague: league.idLeague,
        strLeague: league.strLeague,
        strSport: league.strSport,
        strCountry: league.strCountry,
        strBadge: league.strBadge,
      })),
    });
  })
  .get("/teams/:leagueId", async (c) => {
    const leagueId = c.req.param("leagueId");

    if (!/^\d+$/.test(leagueId)) {
      console.warn("Invalid league ID parameter", { endpoint: "teams", leagueId });
      return c.json({ error: "Invalid league ID" }, 400);
    }

    const result = await getCachedJson<TeamsResponse>(
      c.env.SPORTS_CACHE,
      `sportsdb:teams:${leagueId}:v1`,
      leagueUrl(c.env.SPORTSDB_API_KEY, "lookup_all_teams.php", leagueId),
      MONTH_IN_SECONDS,
    );

    if (!result) {
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    c.header("X-Cache", result.status);
    return c.json(result.data);
  })
  .get("/events/:leagueId", async (c) => {
    const leagueId = c.req.param("leagueId");

    if (!/^\d+$/.test(leagueId)) {
      console.warn("Invalid league ID parameter", { endpoint: "events", leagueId });
      return c.json({ error: "Invalid league ID" }, 400);
    }

    const result = await getCachedJson<EventsResponse>(
      c.env.SPORTS_CACHE,
      `sportsdb:events:${leagueId}:v1`,
      leagueUrl(c.env.SPORTSDB_API_KEY, "eventsnextleague.php", leagueId),
      THREE_DAYS_IN_SECONDS,
    );

    if (!result) {
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }

    c.header("X-Cache", result.status);
    return c.json(result.data);
  });
