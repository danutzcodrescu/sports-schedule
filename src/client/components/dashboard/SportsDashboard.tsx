import { saveFavouriteTeams } from "#/lib/api/sports";
import { leagueEventsQuery } from "#/lib/api/sports-queries";
import { AddLeagueDialog } from "./AddLeagueDialog";
import { AddTeamDialog } from "./AddTeamDialog";
import { DashboardHeader } from "./DashboardHeader";
import { sortAndDeduplicateEvents } from "./event-utils";
import { EventSchedule } from "./EventSchedule";
import { LeagueSidebar } from "./LeagueSidebar";
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
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const selectedTeam = favouriteTeams.find((team) => team.teamId === activeTeamId) ?? null;
  const selectedLeagueId = leagues.some((league) => league.leagueId === activeLeagueId)
    ? activeLeagueId
    : null;
  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) =>
      saveFavouriteTeams(favouriteTeams.filter((team) => team.teamId !== teamId)),
    onSuccess: onTeamsChanged,
  });
  const teamProps = {
    teams: favouriteTeams,
    activeTeamId: selectedTeam?.teamId ?? null,
    onTeamChange: (teamId: string) =>
      setActiveTeamId(selectedTeam?.teamId === teamId ? null : teamId),
    onAddTeam: () => {
      removeTeamMutation.reset();
      setTeamDialogOpen(true);
    },
    onRemoveTeam: (teamId: string) => removeTeamMutation.mutate(teamId),
    isSavingTeams: removeTeamMutation.isPending,
    hasTeamsError: removeTeamMutation.isError,
  };
  const eventQueries = useQueries({
    queries: leagues.map((league) => leagueEventsQuery(league.leagueId)),
  });

  const allEvents = sortAndDeduplicateEvents(eventQueries.flatMap((query) => query.data ?? []));
  const events = selectedLeagueId
    ? allEvents.filter((event) => event.idLeague === selectedLeagueId)
    : allEvents;
  const isLoading = eventQueries.some((query) => query.isPending);
  const hasError = eventQueries.length > 0 && eventQueries.every((query) => query.isError);

  return (
    <div className="safe-area min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-app">
        <LeagueSidebar
          {...teamProps}
          userName={userName}
          leagues={leagues}
          activeLeagueId={selectedLeagueId}
          onLeagueChange={setActiveLeagueId}
          onAddLeague={() => setDialogOpen(true)}
          onSignOut={onSignOut}
        />

        <main className="@container/dashboard min-w-0 flex-1">
          <DashboardHeader
            {...teamProps}
            leagues={leagues}
            activeLeagueId={selectedLeagueId}
            onLeagueChange={setActiveLeagueId}
            onAddLeague={() => setDialogOpen(true)}
            onSignOut={onSignOut}
          />
          <EventSchedule
            events={events}
            favouriteTeams={favouriteTeams}
            selectedTeam={selectedTeam}
            onClearTeam={() => setActiveTeamId(null)}
            isLoading={isLoading}
            hasError={hasError}
            hasLeagues={Boolean(leagues.length)}
            onAddLeague={() => setDialogOpen(true)}
          />
        </main>
      </div>

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
