import { getEventStart } from "../../shared/event-time.ts";

import type { League, LiveScore, Sport, SportsEvent } from "../../shared/sports.ts";

export type { LiveScore };

export type LeagueDetails = {
  id: string;
  name: string;
  sportName: string;
  country: string | null;
  badgeUrl: string | null;
  syncedAt: number;
};

const SPORTS_DB_BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const MONTH_IN_SECONDS = 60 * 60 * 24 * 30;
const THREE_DAYS_IN_SECONDS = 60 * 60 * 24 * 3;
const EVENT_REQUEST_MAX_RETRIES = 3;
const EVENT_REQUEST_RETRY_STATUSES = new Set([429, 502, 503, 504]);
const EVENT_REQUEST_BUDGET_MS = 20_000;

type EventsResponse = {
  events: (SportsEvent & { strStatus?: string | null })[] | null;
};

function hasFields(value: unknown, strings: string[], nullableStrings: string[]) {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    strings.every((key) => typeof item[key] === "string" && item[key].length > 0) &&
    nullableStrings.every((key) => item[key] == null || typeof item[key] === "string")
  );
}

function parseList<T>(
  value: unknown,
  field: string,
  validItem: (item: unknown) => boolean,
): T[] | null {
  if (!value || typeof value !== "object") throw new Error("Invalid TheSportsDB response");
  const body = value as Record<string, unknown>;
  if (
    body.error ||
    (body[field] !== null && (!Array.isArray(body[field]) || !body[field].every(validItem)))
  ) {
    throw new Error("Invalid TheSportsDB response");
  }
  return body[field] as T[] | null;
}

export function parseSportsResponse(value: unknown) {
  return {
    sports:
      parseList<Sport>(value, "sports", (item) =>
        hasFields(
          item,
          ["idSport", "strSport", "strFormat"],
          ["strSportThumb", "strSportDescription"],
        ),
      ) ?? [],
  };
}

export function parseLeaguesResponse(value: unknown) {
  return {
    countries: parseList<League>(value, "countries", (item) =>
      hasFields(item, ["idLeague", "strLeague", "strSport"], ["strCountry", "strBadge"]),
    ),
  };
}

function parseEventsResponse(value: unknown): EventsResponse {
  const events = parseList<SportsEvent>(value, "events", (item) => {
    if (
      !hasFields(
        item,
        ["idEvent", "strEvent", "strSport", "idLeague", "strLeague", "dateEvent"],
        [
          "strSeason",
          "strTime",
          "strTimestamp",
          "idHomeTeam",
          "strHomeTeam",
          "strHomeTeamBadge",
          "idAwayTeam",
          "strAwayTeam",
          "strAwayTeamBadge",
          "strThumb",
          "strVenue",
          "intRound",
          "strStatus",
        ],
      )
    )
      return false;
    return Number.isFinite(getEventStart(item as SportsEvent).getTime());
  });
  return { events };
}

export type TeamDetails = {
  idTeam: string;
  strTeam: string;
  strSport: string;
  idLeague: string;
  strLeague: string;
  strCountry: string | null;
  strBadge: string | null;
} & Partial<Record<`idLeague${2 | 3 | 4 | 5 | 6 | 7}`, string | null>>;

const SECONDARY_LEAGUE_FIELDS = [
  "idLeague2",
  "idLeague3",
  "idLeague4",
  "idLeague5",
  "idLeague6",
  "idLeague7",
] as const;

export function getTeamLeagueIds(team: TeamDetails) {
  return [team.idLeague, ...SECONDARY_LEAGUE_FIELDS.map((field) => team[field])].filter(
    (id): id is string => typeof id === "string" && /^\d+$/.test(id),
  );
}

function isTeamDetails(value: unknown): value is TeamDetails {
  if (!value || typeof value !== "object") return false;
  const team = value as Record<string, unknown>;
  return (
    ["idTeam", "idLeague", "strTeam", "strSport", "strLeague"].every(
      (key) => typeof team[key] === "string" && team[key].length > 0,
    ) &&
    /^\d+$/.test(String(team.idTeam)) &&
    /^\d+$/.test(String(team.idLeague)) &&
    ["strCountry", "strBadge"].every(
      (key) => team[key] === null || typeof team[key] === "string",
    ) &&
    SECONDARY_LEAGUE_FIELDS.every(
      (key) =>
        team[key] === undefined ||
        team[key] === null ||
        team[key] === "" ||
        (typeof team[key] === "string" && /^\d+$/.test(team[key])),
    )
  );
}

function parseTeamCatalogue(value: unknown) {
  if (!value || typeof value !== "object" || !("teams" in value))
    throw new Error("Invalid TheSportsDB team catalogue");
  if ("error" in value && value.error) throw new Error("Invalid TheSportsDB team catalogue");
  if (value.teams === null) return { teams: [] as TeamDetails[], hasCatalogue: false };
  if (!Array.isArray(value.teams) || !value.teams.every(isTeamDetails))
    throw new Error("Invalid TheSportsDB team catalogue");
  return { teams: value.teams, hasCatalogue: true };
}

export async function getLeagueTeams(cache: KVNamespace, apiKey: string, leagueId: string) {
  const cacheKey = `sportsdb:teams:${leagueId}:v2`;
  const cached = await cache.get<unknown>(cacheKey, "json");
  if (cached !== null) return { ...parseTeamCatalogue(cached), status: "HIT" };

  // The list endpoint accepts league IDs via `id`; `l` is for league names.
  const url = createSportsDbUrl(apiKey, "search_all_teams.php");
  url.searchParams.set("id", leagueId);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  const catalogue = parseTeamCatalogue(body);
  await cache.put(cacheKey, JSON.stringify(body), { expirationTtl: MONTH_IN_SECONDS });
  return { ...catalogue, status: "MISS" };
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

  const events = parseList<LiveScore>(await response.json(), "events", (item) =>
    hasFields(item, ["idEvent"], ["intHomeScore", "intAwayScore", "strStatus"]),
  );
  const event = events?.find((item) => item.idEvent === eventId);
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
  if (cached) {
    try {
      return { data: parseEventsResponse(cached), status: "HIT" };
    } catch {
      // Repair entries written before response validation was introduced.
    }
  }

  return { data: await refreshLeagueEvents(cache, apiKey, leagueId), status: "MISS" };
}

function eventRequestRetryDelay(response: Response, retry: number) {
  const backoff = 1_000 * 2 ** retry * (0.5 + Math.random() * 0.5);
  const retryAfter = response.headers.get("Retry-After");
  if (!retryAfter) return backoff;

  const seconds = Number(retryAfter);
  const serverDelay = Number.isFinite(seconds)
    ? Math.max(0, seconds * 1_000)
    : Math.max(0, Date.parse(retryAfter) - Date.now());

  return Number.isFinite(serverDelay) ? Math.max(backoff, serverDelay) : backoff;
}

async function fetchLeagueEventsResponse(url: URL) {
  const deadline = Date.now() + EVENT_REQUEST_BUDGET_MS;
  const signal = AbortSignal.timeout(EVENT_REQUEST_BUDGET_MS);
  for (let retry = 0; ; retry += 1) {
    const response = await fetch(url, { signal });
    if (response.ok) return response;

    const delay =
      retry < EVENT_REQUEST_MAX_RETRIES && EVENT_REQUEST_RETRY_STATUSES.has(response.status)
        ? eventRequestRetryDelay(response, retry)
        : null;

    // Release every failed response, including exhausted retries, so later leagues can connect.
    await response.body?.cancel();
    if (delay === null || Date.now() + delay >= deadline) {
      throw new Error(`TheSportsDB request failed with status ${response.status}`);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
}

export async function refreshLeagueEvents(cache: KVNamespace, apiKey: string, leagueId: string) {
  const url = createSportsDbUrl(apiKey, "eventsnextleague.php");
  url.searchParams.set("id", leagueId);

  const response = await fetchLeagueEventsResponse(url);

  const data = parseEventsResponse(await response.json());
  await cache.put(leagueEventsCacheKey(leagueId), JSON.stringify(data), {
    expirationTtl: THREE_DAYS_IN_SECONDS,
  });

  return data;
}

export async function getLeagueDetails(cache: KVNamespace, apiKey: string, leagueId: string) {
  const cacheKey = `sportsdb:league:${leagueId}:v1`;
  const cached = await cache.get<LeagueDetails>(cacheKey, "json");

  if (
    cached &&
    hasFields(cached, ["id", "name", "sportName"], ["country", "badgeUrl"]) &&
    cached.id === leagueId &&
    Number.isFinite(cached.syncedAt)
  )
    return cached;

  const url = createSportsDbUrl(apiKey, "lookupleague.php");
  url.searchParams.set("id", leagueId);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TheSportsDB request failed with status ${response.status}`);
  }

  const leagues = parseList<League>(await response.json(), "leagues", (item) =>
    hasFields(item, ["idLeague", "strLeague", "strSport"], ["strCountry", "strBadge"]),
  );
  const result = leagues?.find((item) => item.idLeague === leagueId);

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
