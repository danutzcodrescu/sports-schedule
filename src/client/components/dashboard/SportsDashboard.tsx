import { saveFavouriteTeams } from "#/lib/api/sports";
import { leagueEventsQuery } from "#/lib/api/sports-queries";
import { AddLeagueDialog } from "./AddLeagueDialog";
import { AddTeamDialog } from "./AddTeamDialog";
import { DashboardHeader } from "./DashboardHeader";
import { sortAndDeduplicateEvents } from "./event-utils";
import { EventSchedule } from "./EventSchedule";
import { FilterCommandDialog } from "./FilterCommandDialog";
import { LeagueSidebar } from "./LeagueSidebar";
import { useEventSchedule } from "./useEventSchedule";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useMutation, useQueries } from "@tanstack/react-query";
import { useState } from "react";

import type { FavouriteTeam, FollowedLeague } from "#/lib/api/sports";

type SportsDashboardProps = {
  userName: string;
  leagues: FollowedLeague[];
  favouriteTeams: FavouriteTeam[];
  onTeamsChanged: () => Promise<void>;
  onLeaguesChanged: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SportsDashboard({
  userName,
  leagues,
  favouriteTeams,
  onTeamsChanged,
  onLeaguesChanged,
  onSignOut,
}: SportsDashboardProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [isTeamDialogOpen, setTeamDialogOpen] = useState(false);
  const [isFilterDialogOpen, setFilterDialogOpen] = useState(false);
  useHotkey("Mod+K", () => setFilterDialogOpen((open) => !open), {
    enabled: !isDialogOpen && !isTeamDialogOpen,
    requireReset: true,
  });
  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      saveFavouriteTeams(favouriteTeams.filter((team) => team.teamId !== teamId)),
    onSuccess: onTeamsChanged,
  });
  const eventQueries = useQueries({
    queries: leagues.map((league) => leagueEventsQuery(league.leagueId)),
  });

  const allEvents = sortAndDeduplicateEvents(eventQueries.flatMap((query) => query.data ?? []));
  const isLoading = eventQueries.some((query) => query.isPending);
  const hasError = eventQueries.length > 0 && eventQueries.every((query) => query.isError);
  const schedule = useEventSchedule({
    leagues,
    favouriteTeams,
    events: allEvents,
    isLoading,
    hasError,
  });
  const { selectedTeam, selectedLeagueId, changeSelection } = schedule;
  const changeLeague = (leagueId: string | null) => changeSelection({ type: "league", leagueId });
  const teamProps = {
    teams: favouriteTeams,
    activeTeamId: selectedTeam?.teamId ?? null,
    onTeamChange: (teamId: string) => changeSelection({ type: "team", teamId }),
    onAddTeam: () => {
      removeTeamMutation.reset();
      setTeamDialogOpen(true);
    },
    onRemoveTeam: (teamId: string) => removeTeamMutation.mutate(teamId),
    isSavingTeams: removeTeamMutation.isPending,
    hasTeamsError: removeTeamMutation.isError,
  };

  return (
    <div className="safe-area min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-app">
        <LeagueSidebar
          {...teamProps}
          userName={userName}
          leagues={leagues}
          activeLeagueId={selectedLeagueId}
          onLeagueChange={changeLeague}
          onAddLeague={() => setDialogOpen(true)}
          onSignOut={onSignOut}
        />

        <main className="@container/dashboard min-w-0 flex-1">
          <DashboardHeader
            {...teamProps}
            onSearch={() => setFilterDialogOpen(true)}
            leagues={leagues}
            activeLeagueId={selectedLeagueId}
            onLeagueChange={changeLeague}
            onAddLeague={() => setDialogOpen(true)}
            onSignOut={onSignOut}
          />
          <EventSchedule
            schedule={schedule}
            isLoading={isLoading}
            hasError={hasError}
            hasLeagues={Boolean(leagues.length)}
            onAddLeague={() => setDialogOpen(true)}
          />
        </main>
      </div>

      <FilterCommandDialog
        open={isFilterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        leagues={leagues}
        teams={favouriteTeams}
        activeLeagueId={selectedLeagueId}
        activeTeamId={selectedTeam?.teamId ?? null}
        onLeagueChange={changeLeague}
        onTeamChange={teamProps.onTeamChange}
        onClearTeam={() => changeSelection({ type: "clear-team" })}
      />

      {isDialogOpen ? (
        <AddLeagueDialog
          followedLeagues={leagues}
          onOpenChange={setDialogOpen}
          onSaved={onLeaguesChanged}
        />
      ) : null}
      {isTeamDialogOpen ? (
        <AddTeamDialog
          followedLeagues={leagues}
          favouriteTeams={favouriteTeams}
          onOpenChange={setTeamDialogOpen}
          onSaved={onTeamsChanged}
          onAddLeague={() => {
            setTeamDialogOpen(false);
            setDialogOpen(true);
          }}
        />
      ) : null}
    </div>
  );
}
