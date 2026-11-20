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

export type LiveScore = {
  idEvent: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
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
