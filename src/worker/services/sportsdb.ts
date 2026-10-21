export type LeagueDetails = {
  id: string;
  name: string;
  sportName: string;
  country: string | null;
  badgeUrl: string | null;
  syncedAt: number;
};

type LeagueLookupResponse = {
  leagues: Array<{
    idLeague: string;
    strLeague: string;
    strSport: string;
    strCountry: string | null;
    strBadge: string | null;
  }> | null;
};

const SPORTS_DB_BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;
const THREE_DAYS_IN_SECONDS = 60 * 60 * 24 * 3;

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

export type LiveScore = {
  idEvent: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
};

export type TeamDetails = {
  idTeam: string;
  strTeam: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  strCountry: string | null;
  strBadge: string | null;
};

export async function getLeagueTeams(cache: KVNamespace, apiKey: string, leagueId: string) {
  const cacheKey = `sportsdb:teams:${leagueId}:v2`;
  const cached = await cache.get<{ teams: TeamDetails[] | null }>(cacheKey, "json");
  if (cached) return { teams: cached.teams ?? [], status: "HIT" };

  // The list endpoint accepts league IDs via `id`; `l` is for league names.
  const url = createSportsDbUrl(apiKey, "search_all_teams.php");
  url.searchParams.set("id", leagueId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { teams: TeamDetails[] | null };
  await cache.put(cacheKey, JSON.stringify(body), { expirationTtl: MONTH_IN_SECONDS });
  return { teams: body.teams ?? [], status: "MISS" };
}

export function createSportsDbUrl(apiKey: string, endpoint: string) {
  return new URL(`${SPORTS_DB_BASE_URL}/${encodeURIComponent(apiKey)}/${endpoint}`);
}

export async function getEventScore(apiKey: string, eventId: string) {
  const url = createSportsDbUrl(apiKey, "lookupevent.php");
  url.searchParams.set("id", eventId);
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`TheSportsDB request failed with status ${response.status}`);
  }

  const body = (await response.json()) as { events: LiveScore[] | null };
  const event = body.events?.find((item) => item.idEvent === eventId);
  if (!event) return null;

  return {
    idEvent: event.idEvent,
    intHomeScore: event.intHomeScore ?? null,
    intAwayScore: event.intAwayScore ?? null,
    strStatus: event.strStatus ?? null,
  };
}

function leagueEventsCacheKey(leagueId: string) {
  return `sportsdb:events:${leagueId}:v1`;
}

export async function getLeagueEvents(cache: KVNamespace, apiKey: string, leagueId: string) {
  const cached = await cache.get<EventsResponse>(leagueEventsCacheKey(leagueId), "json");
  if (cached) return { data: cached, status: "HIT" };

  return { data: await refreshLeagueEvents(cache, apiKey, leagueId), status: "MISS" };
}

export async function refreshLeagueEvents(cache: KVNamespace, apiKey: string, leagueId: string) {
  const url = createSportsDbUrl(apiKey, "eventsnextleague.php");
  url.searchParams.set("id", leagueId);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed with status ${response.status}`);
  }

  const data = (await response.json()) as EventsResponse;
  await cache.put(leagueEventsCacheKey(leagueId), JSON.stringify(data), {
    expirationTtl: THREE_DAYS_IN_SECONDS,
  });

  return data;
}

export async function getLeagueDetails(cache: KVNamespace, apiKey: string, leagueId: string) {
  const cacheKey = `sportsdb:league:${leagueId}:v1`;
  const cached = await cache.get<LeagueDetails>(cacheKey, "json");

  if (cached) return cached;

  const url = createSportsDbUrl(apiKey, "lookupleague.php");
  url.searchParams.set("id", leagueId);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TheSportsDB request failed with status ${response.status}`);
  }

  const body = (await response.json()) as LeagueLookupResponse;
  const result = body.leagues?.find((item) => item.idLeague === leagueId);

  if (!result) return null;

  const league: LeagueDetails = {
    id: result.idLeague,
    name: result.strLeague,
    sportName: result.strSport,
    country: result.strCountry,
    badgeUrl: result.strBadge,
    syncedAt: Date.now(),
  };

  await cache.put(cacheKey, JSON.stringify(league), { expirationTtl: MONTH_IN_SECONDS });

  return league;
}
