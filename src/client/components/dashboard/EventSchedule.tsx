import { Button } from "#/components/ui/Button";
import {
  filterEvents,
  formatDayHeading,
  getEventStatus,
  groupEventsByLocalDay,
  localDayKey,
} from "./event-utils";
import { EventCard } from "./EventCard";
import {
  Calendar03Icon,
  Clock01Icon,
  PlusSignIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

import type { SportsEvent } from "#/lib/api/sports";
import type { ScheduleFilter } from "./event-utils";

const scheduleFilters = [
  { id: "upcoming", label: "Upcoming", icon: SparklesIcon },
  { id: "live", label: "Live", icon: Clock01Icon },
  { id: "today", label: "Today", icon: Calendar03Icon },
  { id: "tomorrow", label: "Tomorrow", icon: Clock01Icon },
] as const;

type EventScheduleProps = {
  events: SportsEvent[];
  isLoading: boolean;
  hasError: boolean;
  hasLeagues: boolean;
  onAddLeague: () => void;
};

export function EventSchedule({
  events,
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

  const visibleEvents = filterEvents(events, activeFilter, now);
  const eventGroups = groupEventsByLocalDay(visibleEvents);
  const liveCount = events.filter((event) => getEventStatus(event, now) === "live").length;

  return (
    <section className="px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Schedule period">
        {scheduleFilters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition ${
              activeFilter === filter.id
                ? filter.id === "live"
                  ? "border-rose-500/50 bg-rose-500/15 text-rose-400"
                  : "border-slate-200 bg-slate-100 text-slate-950"
                : "border-transparent bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            <HugeiconsIcon icon={filter.icon} className="size-4" />
            {filter.label}
            {filter.id === "live" && liveCount ? (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] leading-none text-white">
                {liveCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-6 min-h-[520px] rounded-2xl border border-white/10 bg-[#090f1d] p-5 sm:p-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <div>
            <h3 className="text-lg font-semibold capitalize">{activeFilter}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {isLoading
                ? "Loading events..."
                : `${visibleEvents.length} scheduled ${visibleEvents.length === 1 ? "event" : "events"}`}
            </p>
          </div>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
            Your local time
          </span>
        </div>

        {isLoading ? (
          <EventLoadingState />
        ) : eventGroups.length ? (
          <div className="space-y-10 pt-7">
            {eventGroups.map((group) => (
              <section key={localDayKey(group.date)}>
                <div className="mb-4 flex items-center gap-2">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-5 text-slate-500" />
                  <h4 className="font-semibold">{formatDayHeading(group.date, now)}</h4>
                  <span className="text-sm text-slate-500">· {group.events.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
          />
        )}
      </div>
    </section>
  );
}

function EventLoadingState() {
  return (
    <div className="grid grid-cols-1 gap-4 pt-7 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70"
        />
      ))}
    </div>
  );
}

function EventEmptyState({
  activeFilter,
  hasError,
  hasLeagues,
  onAddLeague,
}: {
  activeFilter: ScheduleFilter;
  hasError: boolean;
  hasLeagues: boolean;
  onAddLeague: () => void;
}) {
  return (
    <div className="grid min-h-[390px] place-items-center text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400">
          <HugeiconsIcon icon={Calendar03Icon} className="size-6" />
        </span>
        <h4 className="mt-5 text-base font-semibold">
          {hasError ? "Events could not be loaded" : `No ${activeFilter} events`}
        </h4>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {hasError
            ? "The schedule service is unavailable right now. Try again shortly."
            : hasLeagues
              ? "There are no matching events in your followed leagues."
              : "Follow a league to populate your personal sports schedule."}
        </p>
        {!hasLeagues ? (
          <Button
            variant="outline"
            size="lg"
            className="mt-5 border-slate-700 bg-slate-900 text-slate-100"
            onClick={onAddLeague}
          >
            <HugeiconsIcon icon={PlusSignIcon} />
            Add a league
          </Button>
        ) : null}
      </div>
    </div>
  );
}
