import { Button } from "#/components/ui/Button";
import { Logout01Icon, PlusSignIcon, SparklesIcon, TrophyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { FollowedLeague } from "#/lib/api/sports";

type LeagueSidebarProps = {
  userName: string;
  leagues: FollowedLeague[];
  activeLeagueId: string | null;
  onLeagueChange: (leagueId: string | null) => void;
  onAddLeague: () => void;
  onSignOut: () => Promise<void>;
};

export function LeagueSidebar({
  userName,
  leagues,
  activeLeagueId,
  onLeagueChange,
  onAddLeague,
  onSignOut,
}: LeagueSidebarProps) {
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-white/10 bg-[#090f1d] md:flex">
      <div className="border-b border-white/10 px-6 py-7">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-950">
            <HugeiconsIcon icon={TrophyIcon} className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-lg font-semibold">Sports Center</h1>
            <p className="text-xs text-slate-500">Your leagues, one place</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
        <div className="mb-3 flex items-center justify-between px-2">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">
            My leagues
            <span className="rounded-full bg-slate-800 px-2 py-0.5 tracking-normal text-slate-300">
              {leagues.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-slate-300 hover:bg-slate-800 hover:text-white"
            onClick={onAddLeague}
            aria-label="Add a league"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Followed leagues">
          {leagues.length ? (
            <button
              type="button"
              aria-pressed={activeLeagueId === null}
              onClick={() => onLeagueChange(null)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800/70 hover:text-white aria-pressed:bg-slate-100 aria-pressed:text-slate-950"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300">
                <HugeiconsIcon icon={SparklesIcon} className="size-4" />
              </span>
              <span className="truncate font-medium">All followed</span>
            </button>
          ) : null}
          {leagues.map((league) => (
            <button
              key={league.leagueId}
              type="button"
              aria-pressed={activeLeagueId === league.leagueId}
              onClick={() => onLeagueChange(league.leagueId)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800/70 hover:text-white aria-pressed:bg-slate-100 aria-pressed:text-slate-950"
            >
              <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900">
                {league.badgeUrl ? (
                  <img src={league.badgeUrl} alt="" className="size-7 object-contain" />
                ) : (
                  <HugeiconsIcon icon={TrophyIcon} className="size-4 text-slate-500" />
                )}
              </span>
              <span className="truncate font-medium">{league.leagueName}</span>
            </button>
          ))}
          {!leagues.length ? (
            <button
              type="button"
              onClick={onAddLeague}
              className="mt-2 w-full rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-500 transition hover:border-slate-500 hover:text-slate-300"
            >
              Add your first league
            </button>
          ) : null}
        </nav>
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 place-items-center rounded-full bg-slate-800 text-sm font-semibold">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{userName}</span>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-500 hover:text-white"
            onClick={onSignOut}
            aria-label="Sign out"
          >
            <HugeiconsIcon icon={Logout01Icon} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
