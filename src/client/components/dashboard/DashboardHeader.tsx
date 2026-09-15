import { Button } from "#/components/ui/Button";
import { Logout01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { FollowedLeague } from "#/lib/api/sports";

type DashboardHeaderProps = {
  leagues: FollowedLeague[];
  activeLeagueId: string | null;
  onLeagueChange: (leagueId: string | null) => void;
  onAddLeague: () => void;
  onSignOut: () => Promise<void>;
};

export function DashboardHeader({
  leagues,
  activeLeagueId,
  onLeagueChange,
  onAddLeague,
  onSignOut,
}: DashboardHeaderProps) {
  const activeLeague = leagues.find((league) => league.leagueId === activeLeagueId);

  return (
    <header className="border-b border-white/10 bg-[#080d19]/90 px-5 py-5 backdrop-blur sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-emerald-400 uppercase">
            Personal schedule
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {activeLeague?.leagueName || "Your sports timeline"}
          </h2>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="outline"
            size="icon-lg"
            className="border-slate-700 bg-slate-900 text-slate-100"
            onClick={onAddLeague}
            aria-label="Add a league"
          >
            <HugeiconsIcon icon={PlusSignIcon} />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            className="text-slate-400"
            onClick={onSignOut}
            aria-label="Sign out"
          >
            <HugeiconsIcon icon={Logout01Icon} />
          </Button>
        </div>
      </div>

      {leagues.length ? (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
          <button
            type="button"
            aria-pressed={activeLeagueId === null}
            onClick={() => onLeagueChange(null)}
            className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs aria-pressed:bg-slate-100 aria-pressed:text-slate-950"
          >
            All followed
          </button>
          {leagues.map((league) => (
            <button
              type="button"
              key={league.leagueId}
              aria-pressed={activeLeagueId === league.leagueId}
              onClick={() => onLeagueChange(league.leagueId)}
              className="flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs aria-pressed:bg-slate-100 aria-pressed:text-slate-950"
            >
              {league.badgeUrl ? (
                <img src={league.badgeUrl} alt="" className="size-4 object-contain" />
              ) : null}
              {league.leagueName}
            </button>
          ))}
        </div>
      ) : null}
    </header>
  );
}
