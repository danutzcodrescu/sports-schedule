import { getLeagueEvents } from "#/lib/api/sports";
import { AddLeagueDialog } from "./AddLeagueDialog";
import { DashboardHeader } from "./DashboardHeader";
import { sortAndDeduplicateEvents } from "./event-utils";
import { EventSchedule } from "./EventSchedule";
import { LeagueSidebar } from "./LeagueSidebar";
import { useQueries } from "@tanstack/react-query";
import { useState } from "react";

import type { FollowedLeague } from "#/lib/api/sports";

type SportsDashboardProps = {
  userName: string;
  leagues: FollowedLeague[];
  onLeaguesChanged: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SportsDashboard({
  userName,
  leagues,
  onLeaguesChanged,
  onSignOut,
}: SportsDashboardProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const eventQueries = useQueries({
    queries: leagues.map((league) => ({
      queryKey: ["league-events", league.leagueId],
      queryFn: () => getLeagueEvents(league.leagueId),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const allEvents = sortAndDeduplicateEvents(eventQueries.flatMap((query) => query.data ?? []));
  const events = activeLeagueId
    ? allEvents.filter((event) => event.idLeague === activeLeagueId)
    : allEvents;
  const isLoading = eventQueries.some((query) => query.isPending);
  const hasError = eventQueries.length > 0 && eventQueries.every((query) => query.isError);

  return (
    <div className="safe-area min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-app">
        <LeagueSidebar
          userName={userName}
          leagues={leagues}
          activeLeagueId={activeLeagueId}
          onLeagueChange={setActiveLeagueId}
          onAddLeague={() => setDialogOpen(true)}
          onSignOut={onSignOut}
        />

        <main className="@container/dashboard min-w-0 flex-1">
          <DashboardHeader
            leagues={leagues}
            activeLeagueId={activeLeagueId}
            onLeagueChange={setActiveLeagueId}
            onAddLeague={() => setDialogOpen(true)}
            onSignOut={onSignOut}
          />
          <EventSchedule
            events={events}
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
    </div>
  );
}
