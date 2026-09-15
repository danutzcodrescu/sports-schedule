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

export function createSportsDbUrl(apiKey: string, endpoint: string) {
  return new URL(`${SPORTS_DB_BASE_URL}/${encodeURIComponent(apiKey)}/${endpoint}`);
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
