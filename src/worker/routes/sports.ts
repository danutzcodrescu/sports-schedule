import { requireAuth } from "../auth/middleware";
import { rateLimitSports } from "../rate-limit";
import {
  createSportsDbUrl,
  getLeagueEvents,
  getLeagueTeams,
  getEventScore,
  parseSportsResponse,
  parseLeaguesResponse,
} from "../services/sportsdb";
import { Hono } from "hono";

import type { AppEnv } from "../auth/middleware";

type CacheResult<T> = {
  data: T;
  status: "HIT" | "MISS";
};

const SPORTS_CACHE_KEY = "sportsdb:sports:v1";
const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;

async function getCachedJson<T>(
  cache: KVNamespace,
  key: string,
  url: URL,
  expirationTtl: number,
  parse: (value: unknown) => T,
): Promise<CacheResult<T> | null> {
  const endpoint = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);

  try {
    const cached = await cache.get<unknown>(key, "json");

    if (cached) {
      try {
        return { data: parse(cached), status: "HIT" };
      } catch {
        // Repair entries written before response validation was introduced.
      }
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error("TheSportsDB request failed", { endpoint, status: response.status });
      return null;
    }

    const data = parse(await response.json());

    await cache.put(key, JSON.stringify(data), { expirationTtl });

    return { data, status: "MISS" };
  } catch (error) {
    console.error("TheSportsDB request threw an error", { endpoint, error });
    return null;
  }
}

export const sportsRoutes = new Hono<AppEnv>()
  .use("*", requireAuth)
  .use("*", rateLimitSports)
  .get("/", async (c) => {
    const result = await getCachedJson(
      c.env.SPORTS_CACHE,
      SPORTS_CACHE_KEY,
      createSportsDbUrl(c.env.SPORTSDB_API_KEY, "all_sports.php"),
      MONTH_IN_SECONDS,
      parseSportsResponse,
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

    const result = await getCachedJson(
      c.env.SPORTS_CACHE,
      `sportsdb:leagues:${sport.toLowerCase()}:v1`,
      url,
      MONTH_IN_SECONDS,
      parseLeaguesResponse,
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

    try {
      const result = await getLeagueTeams(c.env.SPORTS_CACHE, c.env.SPORTSDB_API_KEY, leagueId);
      c.header("X-Cache", result.status);
      return c.json({ teams: result.teams });
    } catch (error) {
      console.error("Failed to fetch league teams", { leagueId, error });
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }
  })
  .get("/livescores/:eventId", async (c) => {
    c.header("Cache-Control", "no-store");
    const eventId = c.req.param("eventId");
    if (!/^\d+$/.test(eventId)) {
      return c.json({ error: "Invalid event ID" }, 400);
    }

    try {
      // shortcut: scores are cached regionally without merging concurrent misses; coordinate if quotas require it.
      const cacheKey = new Request(new URL(`/sports-score-cache/v1/${eventId}`, c.req.url));
      const cache = await caches.open("sports-scores").catch(() => undefined);
      const cached = await cache?.match(cacheKey).catch(() => undefined);
      if (cached) return c.json(await cached.json());
      const score = await getEventScore(c.env.SPORTSDB_API_KEY, eventId);
      await cache
        ?.put(
          cacheKey,
          Response.json(
            { score },
            {
              headers: { "Cache-Control": "public, max-age=30" },
            },
          ),
        )
        .catch((error) => console.warn("Failed to cache live score", { error }));
      return c.json({ score });
    } catch (error) {
      console.error("Failed to fetch event score", { eventId, error });
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }
  })
  .get("/events/:leagueId", async (c) => {
    const leagueId = c.req.param("leagueId");

    if (!/^\d+$/.test(leagueId)) {
      console.warn("Invalid league ID parameter", { endpoint: "events", leagueId });
      return c.json({ error: "Invalid league ID" }, 400);
    }

    try {
      const result = await getLeagueEvents(c.env.SPORTS_CACHE, c.env.SPORTSDB_API_KEY, leagueId);
      c.header("X-Cache", result.status);
      return c.json(result.data);
    } catch (error) {
      console.error("Failed to fetch league events", { leagueId, error });
      return c.json({ error: "TheSportsDB request failed" }, 502);
    }
  });
