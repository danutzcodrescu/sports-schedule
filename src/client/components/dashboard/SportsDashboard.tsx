import { Button } from "#/components/ui/Button";
import { AddLeagueDialog } from "./AddLeagueDialog";
import {
  Calendar03Icon,
  Clock01Icon,
  Logout01Icon,
  PlusSignIcon,
  SparklesIcon,
  TrophyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import type { FollowedLeague } from "#/lib/api/sports";

type SportsDashboardProps = {
  userName: string;
  leagues: FollowedLeague[];
  onLeaguesChanged: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

const scheduleFilters = [
  { id: "upcoming", label: "Upcoming", icon: SparklesIcon },
  { id: "today", label: "Today", icon: Calendar03Icon },
  { id: "tomorrow", label: "Tomorrow", icon: Clock01Icon },
] as const;

export function SportsDashboard({
  userName,
  leagues,
  onLeaguesChanged,
  onSignOut,
}: SportsDashboardProps) {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] =
    useState<(typeof scheduleFilters)[number]["id"]>("upcoming");

  return (
    <div className="dark min-h-dvh bg-[#070b16] text-slate-100">
      <div className="mx-auto flex min-h-dvh max-w-[1600px]">
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
                onClick={() => setDialogOpen(true)}
                aria-label="Add a league"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
              </Button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Followed leagues">
              {leagues.map((league) => (
                <button
                  key={league.leagueId}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800/70 hover:text-white"
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
                  onClick={() => setDialogOpen(true)}
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

        <main className="min-w-0 flex-1">
          <header className="border-b border-white/10 bg-[#080d19]/90 px-5 py-5 backdrop-blur sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold tracking-[0.16em] text-emerald-400 uppercase">
                  Personal schedule
                </p>
                <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                  Your sports timeline
                </h2>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="border-slate-700 bg-slate-900 text-slate-100"
                  onClick={() => setDialogOpen(true)}
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

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {leagues.map((league) => (
                <span
                  key={league.leagueId}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs"
                >
                  {league.badgeUrl ? (
                    <img src={league.badgeUrl} alt="" className="size-4 object-contain" />
                  ) : null}
                  {league.leagueName}
                </span>
              ))}
            </div>
          </header>

          <section className="px-5 py-6 sm:px-8 sm:py-8">
            <div
              className="flex gap-2 overflow-x-auto pb-2"
              role="tablist"
              aria-label="Schedule period"
            >
              {scheduleFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-transparent bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-400 transition hover:text-white aria-selected:border-slate-600 aria-selected:bg-slate-100 aria-selected:text-slate-950"
                >
                  <HugeiconsIcon icon={filter.icon} className="size-4" />
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="mt-6 min-h-[520px] rounded-2xl border border-white/10 bg-[#090f1d] p-6 sm:p-8">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <h3 className="text-lg font-semibold capitalize">{activeFilter}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Events from {leagues.length} followed{" "}
                    {leagues.length === 1 ? "league" : "leagues"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                  Events next
                </span>
              </div>

              <div className="grid min-h-[390px] place-items-center text-center">
                <div className="max-w-sm">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-slate-400">
                    <HugeiconsIcon icon={Calendar03Icon} className="size-6" />
                  </span>
                  <h4 className="mt-5 text-base font-semibold">Event schedules are coming next</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Your followed leagues are ready. The next step will populate this view with live
                    and upcoming events.
                  </p>
                  {!leagues.length ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="mt-5 border-slate-700 bg-slate-900 text-slate-100"
                      onClick={() => setDialogOpen(true)}
                    >
                      <HugeiconsIcon icon={PlusSignIcon} />
                      Add a league
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
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
