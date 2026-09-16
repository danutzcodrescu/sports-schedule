import { Badge } from "#/components/ui/Badge";
import { getEventStart, getEventStatus } from "./event-utils";
import { TrophyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { SportsEvent } from "#/lib/api/sports";

type EventCardProps = {
  event: SportsEvent;
  now: Date;
};

export function EventCard({ event, now }: EventCardProps) {
  const start = getEventStart(event);
  const status = getEventStatus(event, now);
  const hasTeams = Boolean(event.strHomeTeam || event.strAwayTeam);
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);

  return (
    <article
      className="panel event-card-size relative isolate flex min-w-0 overflow-hidden p-4 data-[live=true]:border-live/50"
      data-live={status === "live"}
    >
      {event.strThumb ? (
        <img
          src={event.strThumb}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover opacity-10"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-card/50 to-card" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon icon={TrophyIcon} className="size-4 shrink-0" />
            <span className="min-w-0 wrap-anywhere">{event.strLeague}</span>
          </div>
          {status === "live" ? (
            <Badge variant="live">
              <span className="size-1.5 rounded-full bg-live" />
              Live
            </Badge>
          ) : (
            <span className="shrink-0 tabular-nums">{time}</span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center py-4 @2xl/schedule:py-6">
          {hasTeams ? (
            <div className="space-y-4">
              <TeamRow name={event.strHomeTeam} badge={event.strHomeTeamBadge} />
              <TeamRow name={event.strAwayTeam} badge={event.strAwayTeamBadge} />
            </div>
          ) : (
            <div>
              <h4 className="section-title wrap-anywhere">{event.strEvent}</h4>
              {event.intRound ? (
                <p className="mt-2 text-sm text-muted-foreground">Round {event.intRound}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
          <span className="min-w-0 wrap-anywhere">{event.strVenue || event.strSport}</span>
          <Badge
            className="capitalize"
            variant={status === "live" ? "live" : status === "finished" ? "default" : "accent"}
          >
            {status}
          </Badge>
        </div>
      </div>
    </article>
  );
}

function TeamRow({ name, badge }: { name: string | null; badge: string | null }) {
  if (!name) return null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="icon-surface size-10 @2xl/schedule:size-12">
        {badge ? (
          <img src={badge} alt="" className="size-8 object-contain @2xl/schedule:size-10" />
        ) : (
          <HugeiconsIcon icon={TrophyIcon} className="size-5" />
        )}
      </span>
      <span className="min-w-0 text-base font-semibold wrap-anywhere">{name}</span>
    </div>
  );
}
