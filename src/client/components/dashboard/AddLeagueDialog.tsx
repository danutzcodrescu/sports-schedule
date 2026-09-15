import { Button } from "#/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/Dialog";
import { Input } from "#/components/ui/Input";
import { followLeague, getLeagues, getSports, unfollowLeague } from "#/lib/api/sports";
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Globe02Icon,
  PlusSignIcon,
  Search01Icon,
  TrophyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useReducer } from "react";

import type { FollowedLeague, League, Sport } from "#/lib/api/sports";

type AddLeagueDialogProps = {
  followedLeagues: FollowedLeague[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
};

type DialogState =
  | {
      step: "sports";
      selectedSport: null;
      selectedLeagues: Map<string, League>;
      search: string;
    }
  | {
      step: "leagues";
      selectedSport: Sport;
      selectedLeagues: Map<string, League>;
      search: string;
    };

type DialogAction =
  | { type: "searchChanged"; search: string }
  | { type: "sportSelected"; sport: Sport }
  | { type: "leagueToggled"; league: League }
  | { type: "wentBack" };

function asLeague(league: FollowedLeague): League {
  return {
    idLeague: league.leagueId,
    strLeague: league.leagueName,
    strSport: league.sportName,
    strCountry: league.country,
    strBadge: league.badgeUrl,
  };
}

function createInitialState(followedLeagues: FollowedLeague[]): DialogState {
  return {
    step: "sports",
    selectedSport: null,
    selectedLeagues: new Map(followedLeagues.map((league) => [league.leagueId, asLeague(league)])),
    search: "",
  };
}

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "searchChanged":
      return { ...state, search: action.search };
    case "sportSelected":
      return { ...state, step: "leagues", selectedSport: action.sport, search: "" };
    case "leagueToggled": {
      const selectedLeagues = new Map(state.selectedLeagues);

      if (selectedLeagues.has(action.league.idLeague)) {
        selectedLeagues.delete(action.league.idLeague);
      } else {
        selectedLeagues.set(action.league.idLeague, action.league);
      }

      return { ...state, selectedLeagues };
    }
    case "wentBack":
      return { ...state, step: "sports", selectedSport: null, search: "" };
  }
}

export function AddLeagueDialog({ followedLeagues, onOpenChange, onSaved }: AddLeagueDialogProps) {
  const [state, dispatch] = useReducer(dialogReducer, followedLeagues, createInitialState);
  const sportsQuery = useQuery({
    queryKey: ["sports"],
    queryFn: getSports,
    staleTime: 30 * 60 * 1000,
  });
  const leaguesQuery = useQuery({
    queryKey: ["leagues", state.selectedSport?.strSport],
    queryFn: () => getLeagues(state.selectedSport!.strSport),
    enabled: state.step === "leagues",
    staleTime: 10 * 60 * 1000,
  });
  const saveMutation = useMutation({
    mutationFn: async ({
      additions,
      removals,
    }: {
      additions: League[];
      removals: FollowedLeague[];
    }) =>
      Promise.all([
        ...additions.map((league) => followLeague(league.idLeague)),
        ...removals.map((league) => unfollowLeague(league.leagueId)),
      ]),
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
  });
  const deferredSearch = useDeferredValue(state.search.trim().toLowerCase());
  const sports = sportsQuery.data ?? [];
  const leagues = leaguesQuery.data ?? [];
  const isLoading = state.step === "sports" ? sportsQuery.isPending : leaguesQuery.isPending;
  const loadError = state.step === "sports" ? sportsQuery.isError : leaguesQuery.isError;
  const error = saveMutation.isError
    ? "Your leagues could not be saved. Please try again."
    : loadError
      ? state.step === "sports"
        ? "Sports could not be loaded. Please try again."
        : "Leagues could not be loaded. Please try again."
      : null;

  const filteredSports = sports.filter((sport) =>
    sport.strSport.toLowerCase().includes(deferredSearch),
  );
  const filteredLeagues = leagues.filter((league) =>
    `${league.strLeague} ${league.strCountry ?? ""}`.toLowerCase().includes(deferredSearch),
  );

  function selectSport(sport: Sport) {
    dispatch({ type: "sportSelected", sport });
  }

  function toggleLeague(league: League) {
    dispatch({ type: "leagueToggled", league });
  }

  function saveLeagues() {
    const originalIds = new Set(followedLeagues.map((league) => league.leagueId));
    const additions = [...state.selectedLeagues.values()].filter(
      (league) => !originalIds.has(league.idLeague),
    );
    const removals = followedLeagues.filter(
      (league) => !state.selectedLeagues.has(league.leagueId),
    );

    saveMutation.mutate({ additions, removals });
  }

  function goBack() {
    saveMutation.reset();
    dispatch({ type: "wentBack" });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="dark h-[min(780px,calc(100dvh-1.5rem))] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border border-white/10 bg-[#0a1020] text-slate-50">
        <DialogHeader className="border-b border-white/10 px-6 py-6 pr-16 sm:px-8">
          <div className="flex items-center gap-3">
            {state.step === "leagues" ? (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 text-slate-300"
                onClick={goBack}
                aria-label="Choose another sport"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} />
              </Button>
            ) : null}
            <DialogTitle className="text-2xl">Add a league</DialogTitle>
            <span className="text-sm font-medium text-slate-400">
              Step {state.step === "sports" ? 1 : 2} of 2
            </span>
          </div>
          <DialogDescription className="text-base text-slate-400">
            {state.step === "sports"
              ? "Pick a sport to browse its leagues"
              : `Pick leagues to follow — ${state.selectedSport.strSport}`}
          </DialogDescription>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-slate-100 transition-[width] duration-300"
              style={{ width: state.step === "sports" ? "50%" : "100%" }}
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-5 sm:px-8">
          <div className="relative mb-5">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-400"
            />
            <Input
              value={state.search}
              onChange={(event) => dispatch({ type: "searchChanged", search: event.target.value })}
              size="lg"
              className="h-12 border-slate-700 bg-slate-950/60 pl-12 text-base text-slate-100 placeholder:text-slate-500"
              placeholder={
                state.step === "sports"
                  ? "Search sports..."
                  : `Search ${state.selectedSport.strSport} leagues...`
              }
              aria-label={state.step === "sports" ? "Search sports" : "Search leagues"}
            />
          </div>

          {error ? (
            <div
              className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid h-48 place-items-center text-sm text-slate-400">Loading…</div>
          ) : state.step === "sports" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSports.map((sport) => (
                <button
                  key={sport.idSport}
                  type="button"
                  onClick={() => selectSport(sport)}
                  className="group flex min-h-24 items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/35 px-5 text-left transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-slate-800 text-slate-300 group-hover:text-white">
                    <HugeiconsIcon icon={TrophyIcon} className="size-5" />
                  </span>
                  <span className="font-semibold text-slate-100">{sport.strSport}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLeagues.map((league) => {
                const selected = state.selectedLeagues.has(league.idLeague);

                return (
                  <button
                    key={league.idLeague}
                    type="button"
                    onClick={() => toggleLeague(league)}
                    aria-pressed={selected}
                    className="flex w-full items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/35 p-4 text-left transition hover:border-slate-500 hover:bg-slate-800/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200 aria-pressed:border-slate-500 aria-pressed:bg-slate-800"
                  >
                    <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-900">
                      {league.strBadge ? (
                        <img src={league.strBadge} alt="" className="size-10 object-contain" />
                      ) : (
                        <HugeiconsIcon icon={TrophyIcon} className="size-5 text-slate-400" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-100">
                        {league.strLeague}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                        <HugeiconsIcon icon={Globe02Icon} className="size-3.5" />
                        {league.strCountry || "Worldwide"}
                      </span>
                    </span>
                    <HugeiconsIcon
                      icon={selected ? CheckmarkCircle02Icon : PlusSignIcon}
                      className={selected ? "size-6 text-emerald-400" : "size-6 text-slate-400"}
                    />
                  </button>
                );
              })}
              {!filteredLeagues.length ? (
                <div className="grid h-40 place-items-center text-sm text-slate-400">
                  No matching leagues found.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-white/10 px-6 py-4 sm:px-8">
          {state.step === "leagues" ? (
            <Button
              size="lg"
              className="h-10 bg-slate-100 px-5 text-sm text-slate-950 hover:bg-white"
              onClick={saveLeagues}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : `Done · ${state.selectedLeagues.size} selected`}
            </Button>
          ) : (
            <span className="text-sm text-slate-500">Choose a sport to continue</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
