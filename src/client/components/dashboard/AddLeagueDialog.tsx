import { Badge } from "#/components/ui/Badge";
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
import { SelectionButton } from "#/components/ui/SelectionButton";
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
      <DialogContent size="wide" mobileFullscreen className="dialog-layout overflow-hidden">
        <DialogHeader className="dialog-header-padding border-b">
          <div className="flex flex-wrap items-center gap-3">
            {state.step === "leagues" ? (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2"
                onClick={goBack}
                aria-label="Choose another sport"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} />
              </Button>
            ) : null}
            <DialogTitle>Add a league</DialogTitle>
            <Badge>Step {state.step === "sports" ? 1 : 2} of 2</Badge>
          </div>
          <DialogDescription>
            {state.step === "sports"
              ? "Pick a sport to browse its leagues"
              : `Pick leagues to follow — ${state.selectedSport.strSport}`}
          </DialogDescription>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-primary transition-all ${state.step === "sports" ? "w-1/2" : "w-full"}`}
            />
          </div>
        </DialogHeader>

        <div className="dialog-body-padding min-h-0 overflow-y-auto overscroll-contain">
          <div className="relative mb-4">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={state.search}
              onChange={(event) => dispatch({ type: "searchChanged", search: event.target.value })}
              size="lg"
              className="pl-12"
              placeholder={
                state.step === "sports"
                  ? "Search sports..."
                  : `Search ${state.selectedSport.strSport} leagues...`
              }
              aria-label={state.step === "sports" ? "Search sports" : "Search leagues"}
            />
          </div>

          {error ? (
            <div className="alert-error mb-4" role="alert">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="empty-state text-sm text-muted-foreground" role="status">
              Loading…
            </div>
          ) : state.step === "sports" ? (
            <div className="grid gap-4 @xl/dialog:grid-cols-2 @4xl/dialog:grid-cols-3">
              {filteredSports.map((sport) => (
                <SelectionButton
                  variant="card"
                  key={sport.idSport}
                  onClick={() => selectSport(sport)}
                  className="min-h-24"
                >
                  <span className="icon-surface size-10">
                    <HugeiconsIcon icon={TrophyIcon} className="size-5" />
                  </span>
                  <span className="min-w-0 font-semibold wrap-anywhere">{sport.strSport}</span>
                </SelectionButton>
              ))}
              {!filteredSports.length ? (
                <div className="empty-state col-span-full text-sm text-muted-foreground">
                  No matching sports found.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLeagues.map((league) => {
                const selected = state.selectedLeagues.has(league.idLeague);

                return (
                  <SelectionButton
                    variant="card"
                    key={league.idLeague}
                    onClick={() => toggleLeague(league)}
                    aria-pressed={selected}
                  >
                    <span className="icon-surface size-12 overflow-hidden">
                      {league.strBadge ? (
                        <img src={league.strBadge} alt="" className="size-10 object-contain" />
                      ) : (
                        <HugeiconsIcon icon={TrophyIcon} className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold wrap-anywhere">{league.strLeague}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <HugeiconsIcon icon={Globe02Icon} className="size-4 shrink-0" />
                        <span className="min-w-0 wrap-anywhere">
                          {league.strCountry || "Worldwide"}
                        </span>
                      </span>
                    </span>
                    <HugeiconsIcon
                      icon={selected ? CheckmarkCircle02Icon : PlusSignIcon}
                      className={
                        selected
                          ? "size-5 shrink-0 text-primary"
                          : "size-5 shrink-0 text-muted-foreground"
                      }
                    />
                  </SelectionButton>
                );
              })}
              {!filteredLeagues.length ? (
                <div className="empty-state text-sm text-muted-foreground">
                  No matching leagues found.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="dialog-footer-padding border-t">
          {state.step === "leagues" ? (
            <Button onClick={saveLeagues} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : `Done · ${state.selectedLeagues.size} selected`}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Choose a sport to continue</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
