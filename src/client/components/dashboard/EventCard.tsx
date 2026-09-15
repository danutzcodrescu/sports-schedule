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
      className={`relative isolate flex min-h-72 overflow-hidden rounded-2xl border bg-[#0c1322] p-5 transition hover:-translate-y-0.5 hover:border-slate-600 ${
        status === "live"
          ? "border-rose-500/60 shadow-[0_0_28px_rgba(244,63,94,0.08)]"
          : "border-slate-700/80"
      }`}
    >
      {event.strThumb ? (
        <img
          src={event.strThumb}
          alt=""
          className="absolute inset-0 -z-10 size-full object-cover opacity-[0.07]"
        />
      ) : null}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-900/20 via-[#0c1322]/85 to-[#0c1322]" />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-400">
          <div className="flex min-w-0 items-center gap-2">
            <HugeiconsIcon icon={TrophyIcon} className="size-5 shrink-0 text-slate-500" />
            <span className="truncate">{event.strLeague}</span>
          </div>
          {status === "live" ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 font-semibold tracking-wide text-rose-400 uppercase">
              <span className="size-1.5 rounded-full bg-rose-400" />
              Live
            </span>
          ) : (
            <span className="shrink-0 tabular-nums">{time}</span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center py-6">
          {hasTeams ? (
            <div className="space-y-4">
              <TeamRow name={event.strHomeTeam} badge={event.strHomeTeamBadge} />
              <TeamRow name={event.strAwayTeam} badge={event.strAwayTeamBadge} />
            </div>
          ) : (
            <div>
              <h4 className="line-clamp-3 text-xl leading-tight font-semibold text-slate-100">
                {event.strEvent}
              </h4>
              {event.intRound ? (
                <p className="mt-2 text-sm text-slate-400">Round {event.intRound}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-700/70 pt-4 text-xs text-slate-500">
          <span className="truncate">{event.strVenue || event.strSport}</span>
          <span
            className={`shrink-0 rounded-lg px-2.5 py-1.5 font-semibold capitalize ${
              status === "live"
                ? "bg-rose-500 text-white"
                : status === "finished"
                  ? "bg-slate-800 text-slate-400"
                  : "bg-slate-100 text-slate-950"
            }`}
          >
            {status}
          </span>
        </div>
      </div>
    </article>
  );
}

function TeamRow({ name, badge }: { name: string | null; badge: string | null }) {
  if (!name) return null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center">
        {badge ? (
          <img src={badge} alt="" className="size-10 object-contain" />
        ) : (
          <HugeiconsIcon icon={TrophyIcon} className="size-6 text-slate-600" />
        )}
      </span>
      <span className="truncate text-lg font-semibold text-slate-100">{name}</span>
    </div>
  );
}
