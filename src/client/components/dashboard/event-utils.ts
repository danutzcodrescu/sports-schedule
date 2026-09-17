import type { SportsEvent } from "#/lib/api/sports";

export type ScheduleFilter = "upcoming" | "live" | "today" | "tomorrow";
export type TeamFilter = "favourites" | "all";
export type EventStatus = "live" | "upcoming" | "finished";
export type EventGroup = { date: Date; events: SportsEvent[] };

const DEFAULT_EVENT_DURATION_MINUTES = 180;
const EVENT_DURATION_MINUTES: Record<string, number> = {
  soccer: 135,
  basketball: 180,
  "american football": 240,
  baseball: 240,
  "ice hockey": 180,
  rugby: 150,
  motorsport: 180,
};

export function getEventStart(event: SportsEvent) {
  if (event.strTimestamp) {
    // TheSportsDB timestamps are UTC but do not include a timezone suffix.
    const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(event.strTimestamp);
    const timestamp = new Date(`${event.strTimestamp}${hasTimeZone ? "" : "Z"}`);
    if (!Number.isNaN(timestamp.getTime())) return timestamp;
  }

  const time = (event.strTime || "00:00:00").replace(/Z$/, "");
  return new Date(`${event.dateEvent}T${time}Z`);
}

export function getEventStatus(event: SportsEvent, now: Date): EventStatus {
  const start = getEventStart(event);
  const duration =
    EVENT_DURATION_MINUTES[event.strSport.toLowerCase()] ?? DEFAULT_EVENT_DURATION_MINUTES;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "finished";
}

export function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatDayHeading(date: Date, now: Date) {
  if (isSameLocalDay(date, now)) return "Today";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(date, tomorrow)) return "Tomorrow";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function sortAndDeduplicateEvents(events: SportsEvent[]) {
  return events
    .filter(
      (event, index) =>
        events.findIndex((candidate) => candidate.idEvent === event.idEvent) === index,
    )
    .sort((left, right) => getEventStart(left).getTime() - getEventStart(right).getTime());
}

export function filterEvents(events: SportsEvent[], filter: ScheduleFilter, now: Date) {
  return events.filter((event) => {
    const start = getEventStart(event);
    const status = getEventStatus(event, now);

    if (filter === "live") return status === "live";
    if (filter === "today") return isSameLocalDay(start, now);
    if (filter === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return isSameLocalDay(start, tomorrow);
    }
    return status === "upcoming";
  });
}

export function filterEventsByTeams(
  events: SportsEvent[],
  filter: TeamFilter,
  favouriteTeamIds: Set<string>,
) {
  if (filter === "all" || !favouriteTeamIds.size) return events;
  return events.filter(
    (event) =>
      (event.idHomeTeam !== null && favouriteTeamIds.has(event.idHomeTeam)) ||
      (event.idAwayTeam !== null && favouriteTeamIds.has(event.idAwayTeam)),
  );
}

export function groupEventsByLocalDay(events: SportsEvent[]) {
  return events.reduce<EventGroup[]>((groups, event) => {
    const date = getEventStart(event);
    const lastGroup = groups.at(-1);

    if (lastGroup && localDayKey(lastGroup.date) === localDayKey(date)) {
      lastGroup.events.push(event);
    } else {
      groups.push({ date, events: [event] });
    }
    return groups;
  }, []);
}
