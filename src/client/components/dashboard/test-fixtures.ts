import type { FavouriteTeam, FollowedLeague, SportsEvent } from "#/lib/api/sports";

export function makeEvent(id: string, overrides: Partial<SportsEvent> = {}): SportsEvent {
  return {
    idEvent: id,
    strEvent: "Home vs Away",
    strSport: "Soccer",
    idLeague: "1",
    strLeague: "League",
    strSeason: null,
    dateEvent: "2026-09-16",
    strTime: null,
    strTimestamp: new Date(2026, 8, 16, 13).toISOString(),
    idHomeTeam: "10",
    strHomeTeam: "Home",
    strHomeTeamBadge: null,
    idAwayTeam: "20",
    strAwayTeam: "Away",
    strAwayTeamBadge: null,
    strThumb: null,
    strVenue: null,
    intRound: null,
    ...overrides,
  };
}

export function makeFavouriteTeam(teamId: string, leagueId: string): FavouriteTeam {
  return { teamId, leagueId, teamName: "Favourite", country: null, badgeUrl: null };
}

export function makeLeague(leagueId: string): FollowedLeague {
  return {
    leagueId,
    leagueName: `League ${leagueId}`,
    sportName: "Soccer",
    country: null,
    badgeUrl: null,
  };
}
