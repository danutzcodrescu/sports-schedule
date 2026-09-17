import { Badge } from "#/components/ui/Badge";
import { Button } from "#/components/ui/Button";
import { SelectionButton } from "#/components/ui/SelectionButton";
import {
  filterEvents,
  filterEventsByTeams,
  formatDayHeading,
  getEventStatus,
  groupEventsByLocalDay,
  localDayKey,
} from "./event-utils";
import { EventCard } from "./EventCard";
import {
  Calendar03Icon,
  Clock01Icon,
  FavouriteIcon,
  PlusSignIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import type { FavouriteTeam, SportsEvent } from "#/lib/api/sports";
import type { ScheduleFilter, TeamFilter } from "./event-utils";

const scheduleFilters = [
  { id: "upcoming", label: "Upcoming", icon: SparklesIcon },
  { id: "live", label: "Live", icon: Clock01Icon },
  { id: "today", label: "Today", icon: Calendar03Icon },
  { id: "tomorrow", label: "Tomorrow", icon: Clock01Icon },
] as const;

type EventScheduleProps = {
  events: SportsEvent[];
  favouriteTeams: FavouriteTeam[];
  selectedTeam: FavouriteTeam | null;
  onClearTeam: () => void;
  teamFilter: TeamFilter;
  onTeamFilterChange: (filter: TeamFilter) => void;
  isLoading: boolean;
  hasError: boolean;
  hasLeagues: boolean;
  onAddLeague: () => void;
};

export function EventSchedule({
  events,
  favouriteTeams,
  selectedTeam,
  onClearTeam,
  teamFilter,
  onTeamFilterChange,
  isLoading,
  hasError,
  hasLeagues,
  onAddLeague,
}: EventScheduleProps) {
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>("upcoming");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const updateCurrentTime = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };

    document.addEventListener("visibilitychange", updateCurrentTime);
    return () => document.removeEventListener("visibilitychange", updateCurrentTime);
  }, []);

  const teamEvents = filterEventsByTeams(
    events,
    selectedTeam ? "favourites" : teamFilter,
    new Set(selectedTeam ? [selectedTeam.teamId] : favouriteTeams.map((team) => team.teamId)),
  );
  const isFilteringTeams =
    Boolean(selectedTeam) || (teamFilter === "favourites" && favouriteTeams.length > 0);
  const changeTeamFilter = (filter: TeamFilter) => {
    onTeamFilterChange(filter);
    onClearTeam();
  };
  const visibleEvents = filterEvents(teamEvents, activeFilter, now);
  const eventGroups = groupEventsByLocalDay(visibleEvents);
  const liveCount = teamEvents.filter((event) => getEventStatus(event, now) === "live").length;

  return (
    <section className="page-padding">
      <div className="flex flex-col gap-3 @4xl/dashboard:flex-row @4xl/dashboard:items-center @4xl/dashboard:justify-between">
        <div className="filter-grid" role="group" aria-label="Schedule period">
          {scheduleFilters.map((filter) => (
            <SelectionButton
              key={filter.id}
              aria-pressed={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >
              <HugeiconsIcon icon={filter.icon} className="size-4" />
              {filter.label}
              {filter.id === "live" && liveCount ? <Badge variant="live">{liveCount}</Badge> : null}
            </SelectionButton>
          ))}
        </div>
        <div
          className="grid grid-cols-2 gap-2 @xl/dashboard:flex"
          role="group"
          aria-label="Schedule teams"
        >
          <SelectionButton
            aria-pressed={!selectedTeam && teamFilter === "favourites"}
            onClick={() => changeTeamFilter("favourites")}
          >
            <HugeiconsIcon icon={FavouriteIcon} className="size-4" />
            Favourites
          </SelectionButton>
          <SelectionButton
            aria-pressed={!selectedTeam && teamFilter === "all"}
            onClick={() => changeTeamFilter("all")}
          >
            All
          </SelectionButton>
        </div>
      </div>

      <div className="panel @container/schedule mt-4 p-4 @2xl/dashboard:mt-6 @2xl/dashboard:min-h-schedule @2xl/dashboard:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4 @2xl/schedule:pb-6">
          <div>
            <h2 className="section-title capitalize">{activeFilter}</h2>
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              {isLoading
                ? "Loading events..."
                : `${visibleEvents.length} scheduled ${visibleEvents.length === 1 ? "event" : "events"}`}
              {selectedTeam
                ? ` · ${selectedTeam.teamName}`
                : isFilteringTeams
                  ? " · Favourite teams"
                  : ""}
            </p>
          </div>
          <Badge>Your local time</Badge>
        </div>

        {isLoading ? (
          <EventLoadingState />
        ) : eventGroups.length ? (
          <div className="space-y-6 pt-4 @2xl/schedule:space-y-8 @2xl/schedule:pt-6">
            {eventGroups.map((group) => (
              <section key={localDayKey(group.date)}>
                <div className="mb-4 flex items-center gap-2">
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                  <h3 className="min-w-0 text-sm font-semibold wrap-anywhere">
                    {formatDayHeading(group.date, now)}
                  </h3>
                  <Badge>{group.events.length}</Badge>
                </div>
                <div className="event-grid">
                  {group.events.map((event) => (
                    <EventCard key={event.idEvent} event={event} now={now} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EventEmptyState
            activeFilter={activeFilter}
            hasError={hasError}
            hasLeagues={hasLeagues}
            onAddLeague={onAddLeague}
            isFilteringTeams={isFilteringTeams}
            selectedTeamName={selectedTeam?.teamName}
            onShowAll={() => changeTeamFilter("all")}
          />
        )}
      </div>
    </section>
  );
}

function EventLoadingState() {
  return (
    <div className="event-grid pt-4 @2xl/schedule:pt-6" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="event-card-size animate-pulse rounded-xl border bg-muted" />
      ))}
    </div>
  );
}

function EventEmptyState({
  activeFilter,
  hasError,
  hasLeagues,
  onAddLeague,
  isFilteringTeams,
  selectedTeamName,
  onShowAll,
}: {
  activeFilter: ScheduleFilter;
  hasError: boolean;
  hasLeagues: boolean;
  onAddLeague: () => void;
  isFilteringTeams: boolean;
  selectedTeamName?: string;
  onShowAll: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="max-w-sm">
        <span className="icon-surface mx-auto size-14">
          <HugeiconsIcon icon={Calendar03Icon} className="size-6" />
        </span>
        <h3 className="section-title mt-6">
          {hasError ? "Events could not be loaded" : `No ${activeFilter} events`}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {hasError
            ? "The schedule service is unavailable right now. Try again shortly."
            : hasLeagues
              ? selectedTeamName
                ? `${selectedTeamName} has no matching events in the selected leagues.`
                : isFilteringTeams
                  ? "Your favourite teams have no matching events in the selected leagues."
                  : "There are no matching events in your followed leagues."
              : "Follow a league to populate your personal sports schedule."}
        </p>
        {!hasLeagues ? (
          <Button className="mt-6" onClick={onAddLeague}>
            <HugeiconsIcon icon={PlusSignIcon} />
            Add a league
          </Button>
        ) : null}
        {hasLeagues && isFilteringTeams && !hasError ? (
          <Button variant="outline" className="mt-6" onClick={onShowAll}>
            Show all teams
          </Button>
        ) : null}
      </div>
    </div>
  );
}
