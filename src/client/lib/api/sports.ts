export type Sport = {
  idSport: string;
  strSport: string;
  strFormat: string;
  strSportThumb: string | null;
  strSportDescription: string | null;
};

export type League = {
  idLeague: string;
  strLeague: string;
  strSport: string;
  strCountry: string | null;
  strBadge: string | null;
};

export type FollowedLeague = {
  leagueId: string;
  leagueName: string;
  sportName: string;
  country: string | null;
  badgeUrl: string | null;
};

export type SportsEvent = {
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
};

export type Team = {
  idTeam: string;
  strTeam: string;
  strCountry: string | null;
  strBadge: string | null;
};

export type FavouriteTeam = {
  teamId: string;
  leagueId: string;
  teamName: string;
  country: string | null;
  badgeUrl: string | null;
};

export async function getLeagueTeams(leagueId: string) {
  const response = await getJson<{ teams: Team[] | null }>(
    `/api/sports/teams/${encodeURIComponent(leagueId)}`,
  );
  return response.teams ?? [];
}

export async function getFavouriteTeams() {
  const response = await getJson<{ teams: FavouriteTeam[] }>("/api/favourite-teams");
  return response.teams;
}

export function saveFavouriteTeams(teams: FavouriteTeam[]) {
  return getJson<{ saved: boolean }>("/api/favourite-teams", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teams: teams.map(({ teamId, leagueId }) => ({ teamId, leagueId })) }),
  });
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getSports() {
  const response = await getJson<{ sports: Sport[] }>("/api/sports");
  return response.sports;
}

export async function getLeagues(sport: string) {
  const response = await getJson<{ leagues: League[] }>(
    `/api/sports/leagues/${encodeURIComponent(sport)}`,
  );
  return response.leagues;
}

export async function getFollowedLeagues() {
  const response = await getJson<{ leagues: FollowedLeague[] }>("/api/followed-leagues");
  return response.leagues;
}

export async function getLeagueEvents(leagueId: string) {
  const response = await getJson<{ events: SportsEvent[] | null }>(
    `/api/sports/events/${encodeURIComponent(leagueId)}`,
  );
  return response.events ?? [];
}

export function followLeague(leagueId: string) {
  return getJson<{ league: FollowedLeague }>("/api/followed-leagues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leagueId }),
  });
}

export async function unfollowLeague(leagueId: string) {
  const response = await fetch(`/api/followed-leagues/${encodeURIComponent(leagueId)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}
