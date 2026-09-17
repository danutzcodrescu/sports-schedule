import { filterEvents, filterEventsByTeams, leagueHasFavouriteTeam } from "./event-utils.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

import type { SportsEvent } from "#/lib/api/sports";
import type { FavouriteTeam } from "#/lib/api/sports";

const now = new Date(2026, 8, 16, 12);
const liveStart = new Date(2026, 8, 16, 11, 30).toISOString();

function event(id: string, overrides: Partial<SportsEvent> = {}): SportsEvent {
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

function favouriteTeam(teamId: string, leagueId: string): FavouriteTeam {
  return {
    teamId,
    leagueId,
    teamName: "Favourite",
    country: null,
    badgeUrl: null,
  };
}

test("favourites match home and away IDs across followed competitions, without duplicates", () => {
  const events = [
    event("home"),
    event("away", { idLeague: "2", idHomeTeam: "30", idAwayTeam: "10" }),
    event("both", { idAwayTeam: "40" }),
    event("other", { idHomeTeam: "50", idAwayTeam: "60" }),
    event("no-ids", { idHomeTeam: null, idAwayTeam: null }),
  ];
  assert.deepEqual(
    filterEventsByTeams(events, "favourites", new Set(["10", "40"])).map((item) => item.idEvent),
    ["home", "away", "both"],
  );
});

test("no favourites falls back to the complete league schedule, including non-team events", () => {
  const events = [event("team"), event("race", { idHomeTeam: null, idAwayTeam: null })];
  assert.deepEqual(filterEventsByTeams(events, "favourites", new Set()), events);
});

test("All bypasses favourites without changing the source schedule", () => {
  const events = [event("one"), event("two", { idHomeTeam: "30" })];
  assert.deepEqual(filterEventsByTeams(events, "all", new Set(["99"])), events);
  assert.equal(events.length, 2);
});

test("favourite filtering composes with Today, Live, Upcoming, and Tomorrow", () => {
  const events = [
    event("live", { strTimestamp: liveStart }),
    event("upcoming"),
    event("tomorrow", { strTimestamp: new Date(2026, 8, 17, 13).toISOString() }),
    event("unrelated-live", { idHomeTeam: "30", strTimestamp: liveStart }),
    event("unrelated-upcoming", { idHomeTeam: "30" }),
  ];
  const favourites = filterEventsByTeams(events, "favourites", new Set(["10"]));
  const ids = (filter: Parameters<typeof filterEvents>[1]) =>
    filterEvents(favourites, filter, now).map((item) => item.idEvent);
  assert.deepEqual(ids("live"), ["live"]);
  assert.deepEqual(ids("upcoming"), ["upcoming", "tomorrow"]);
  assert.deepEqual(ids("today"), ["live", "upcoming"]);
  assert.deepEqual(ids("tomorrow"), ["tomorrow"]);
});

test("removing the last favourite restores all events", () => {
  const events = [event("one"), event("two", { idHomeTeam: "30" })];
  const favourites = new Set(["10"]);
  assert.equal(filterEventsByTeams(events, "favourites", favourites).length, 1);
  favourites.delete("10");
  assert.equal(filterEventsByTeams(events, "favourites", favourites).length, 2);
});

test("detects whether a league contains a favourite team", () => {
  const favourites = [favouriteTeam("10", "1")];
  const events = [event("cross-competition", { idLeague: "2", idHomeTeam: "10" })];

  assert.equal(leagueHasFavouriteTeam("1", favourites, []), true);
  assert.equal(leagueHasFavouriteTeam("2", favourites, events), true);
  assert.equal(leagueHasFavouriteTeam("3", favourites, events), false);
});
