import { eventScoreQuery } from "#/lib/api/sports-queries";
import {
  filterEvents,
  filterEventsByTeams,
  getEventStatus,
  groupEventsByLocalDay,
  leagueHasFavouriteTeam,
  shouldFallBackToAllTeams,
} from "./event-utils";
import { focusManager, useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { FavouriteTeam, FollowedLeague, SportsEvent } from "#/lib/api/sports";
import type { ScheduleFilter, TeamFilter } from "./event-utils";

const LIVE_SCORE_POLL_INTERVAL = 60 * 1000;

export type EventScore = { home: string; away: string; status: string };

type ScheduleSelection = {
  leagueId: string | null;
  teamId: string | null;
  teamFilter: TeamFilter;
  period: ScheduleFilter;
};

type ScheduleChange =
  | { type: "league"; leagueId: string | null }
  | { type: "team"; teamId: string }
  | { type: "clear-team" }
  | { type: "teams"; filter: TeamFilter }
  | { type: "period"; filter: ScheduleFilter };

type ScheduleContext = {
  leagues: FollowedLeague[];
  favouriteTeams: FavouriteTeam[];
  events: SportsEvent[];
  isLoading: boolean;
  hasError: boolean;
};

export function useEventSchedule(context: ScheduleContext) {
  const { leagues, favouriteTeams, events: allEvents, isLoading, hasError } = context;
  const [selection, setSelection] = useState<ScheduleSelection>({
    leagueId: null,
    teamId: null,
    teamFilter: "favourites",
    period: "upcoming",
  });
  const { now, isWindowFocused } = useFocusedClock();
  const favouriteTeamIds = new Set(favouriteTeams.map((team) => team.teamId));
  const { selectedTeam, selectedLeagueId, events } = resolveSelection(selection);
  const teamEvents = filterEventsByTeams(
    events,
    selectedTeam ? "favourites" : selection.teamFilter,
    selectedTeam ? new Set([selectedTeam.teamId]) : favouriteTeamIds,
  );
  const visibleEvents = filterEvents(teamEvents, selection.period, now);
  const liveScores = useQueries({
    queries: (isLoading ? [] : visibleEvents)
      .filter((event) => getEventStatus(event, now) === "live")
      .map((event) => ({
        ...eventScoreQuery(event.idEvent),
        enabled: isWindowFocused,
        refetchInterval: LIVE_SCORE_POLL_INTERVAL,
      })),
  });
  const liveScoresByEvent = new Map<string, EventScore>();
  for (const { data } of liveScores) {
    if (data) {
      liveScoresByEvent.set(data.idEvent, {
        home: data.intHomeScore ?? "0",
        away: data.intAwayScore ?? "0",
        status: data.strStatus || "live",
      });
    }
  }

  function resolveSelection(current: ScheduleSelection) {
    const selectedTeam = favouriteTeams.find((team) => team.teamId === current.teamId) ?? null;
    const selectedLeagueId = leagues.some((league) => league.leagueId === current.leagueId)
      ? current.leagueId
      : null;
    return {
      selectedTeam,
      selectedLeagueId,
      events: selectedLeagueId
        ? allEvents.filter((event) => event.idLeague === selectedLeagueId)
        : allEvents,
    };
  }

  function changeSelection(change: ScheduleChange) {
    setSelection((current) => {
      const { selectedTeam, events } = resolveSelection(current);
      switch (change.type) {
        case "league":
          return change.leagueId &&
            !leagueHasFavouriteTeam(change.leagueId, favouriteTeams, allEvents)
            ? { ...current, leagueId: change.leagueId, teamFilter: "all", teamId: null }
            : { ...current, leagueId: change.leagueId };
        case "team":
          return {
            ...current,
            teamId: selectedTeam?.teamId === change.teamId ? null : change.teamId,
          };
        case "clear-team":
          return { ...current, teamId: null };
        case "teams":
          return { ...current, teamFilter: change.filter, teamId: null };
        case "period":
          return {
            ...current,
            period: change.filter,
            teamFilter:
              !isLoading &&
              !hasError &&
              !selectedTeam &&
              current.teamFilter === "favourites" &&
              shouldFallBackToAllTeams(events, change.filter, favouriteTeamIds, now)
                ? "all"
                : current.teamFilter,
          };
      }
    });
  }

  return {
    selectedTeam,
    selectedLeagueId,
    teamFilter: selection.teamFilter,
    activeFilter: selection.period,
    isFilteringTeams:
      Boolean(selectedTeam) || (selection.teamFilter === "favourites" && favouriteTeams.length > 0),
    visibleEvents,
    eventGroups: groupEventsByLocalDay(visibleEvents),
    liveCount: teamEvents.filter((event) => getEventStatus(event, now) === "live").length,
    liveScoresByEvent,
    now,
    changeSelection,
  };
}

function useFocusedClock() {
  const [clock, setClock] = useState(() => ({
    now: new Date(),
    isWindowFocused: focusManager.isFocused(),
  }));

  useEffect(() => {
    const unsubscribe = focusManager.subscribe((isWindowFocused) => {
      setClock((current) => ({
        now: isWindowFocused ? new Date() : current.now,
        isWindowFocused,
      }));
    });
    const interval = window.setInterval(() => {
      if (focusManager.isFocused()) setClock({ now: new Date(), isWindowFocused: true });
    }, LIVE_SCORE_POLL_INTERVAL);

    return () => {
      window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  return clock;
}
