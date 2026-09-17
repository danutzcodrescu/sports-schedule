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
import { getLeagueTeams, saveFavouriteTeams } from "#/lib/api/sports";
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  FavouriteIcon,
  PlusSignIcon,
  Search01Icon,
  TrophyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import type { FavouriteTeam, FollowedLeague, Team } from "#/lib/api/sports";

type AddTeamDialogProps = {
  followedLeagues: FollowedLeague[];
  favouriteTeams: FavouriteTeam[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  onAddLeague: () => void;
};

export function AddTeamDialog({
  followedLeagues,
  favouriteTeams,
  onOpenChange,
  onSaved,
  onAddLeague,
}: AddTeamDialogProps) {
  const [selectedLeague, setSelectedLeague] = useState<FollowedLeague | null>(null);
  const [selectedTeams, setSelectedTeams] = useState(
    () => new Map(favouriteTeams.map((team) => [team.teamId, team])),
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const teamsQuery = useQuery({
    queryKey: ["league-teams", selectedLeague?.leagueId],
    queryFn: () => getLeagueTeams(selectedLeague!.leagueId),
    enabled: Boolean(selectedLeague),
    staleTime: 30 * 60 * 1000,
  });
  const saveMutation = useMutation({
    mutationFn: () => saveFavouriteTeams([...selectedTeams.values()]),
    onSuccess: async () => {
      await onSaved();
      onOpenChange(false);
    },
  });
  const leagues = followedLeagues.filter((league) =>
    `${league.leagueName} ${league.sportName} ${league.country ?? ""}`
      .toLowerCase()
      .includes(deferredSearch),
  );
  const teams = (teamsQuery.data ?? []).filter((team) =>
    `${team.strTeam} ${team.strCountry ?? ""}`.toLowerCase().includes(deferredSearch),
  );
  const favouriteTeamIds = new Set(favouriteTeams.map((team) => team.teamId));
  const newSelectionCount = [...selectedTeams.keys()].filter(
    (teamId) => !favouriteTeamIds.has(teamId),
  ).length;

  function changeLeague(league: FollowedLeague | null) {
    setSelectedLeague(league);
    setSearch("");
    saveMutation.reset();
  }

  function toggleTeam(team: Team) {
    if (!selectedLeague) return;
    setSelectedTeams((previous) => {
      const next = new Map(previous);
      if (next.has(team.idTeam)) next.delete(team.idTeam);
      else
        next.set(team.idTeam, {
          teamId: team.idTeam,
          leagueId: selectedLeague.leagueId,
          teamName: team.strTeam,
          country: team.strCountry,
          badgeUrl: team.strBadge,
        });
      return next;
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!saveMutation.isPending) onOpenChange(open);
      }}
    >
      <DialogContent size="wide" mobileFullscreen className="dialog-layout overflow-hidden">
        <DialogHeader className="dialog-header-padding border-b">
          <div className="flex flex-wrap items-center gap-3">
            {selectedLeague ? (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2"
                onClick={() => changeLeague(null)}
                disabled={saveMutation.isPending}
                aria-label="Choose another league"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} />
              </Button>
            ) : null}
            <DialogTitle>Add a favourite team</DialogTitle>
            <Badge>Step {selectedLeague ? 2 : 1} of 2</Badge>
          </div>
          <DialogDescription>
            {selectedLeague
              ? `Pick teams from ${selectedLeague.leagueName}`
              : "Pick the team's league first"}
          </DialogDescription>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={`h-full rounded-full bg-primary transition-all ${selectedLeague ? "w-full" : "w-1/2"}`}
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
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              size="lg"
              className="pl-12"
              placeholder={selectedLeague ? "Search teams..." : "Search your followed leagues..."}
              aria-label={selectedLeague ? "Search teams" : "Search your followed leagues"}
            />
          </div>
          {saveMutation.isError ? (
            <div className="alert-error mb-4" role="alert">
              Your favourite teams could not be saved. Please try again.
            </div>
          ) : null}
          {!selectedLeague ? (
            <div className="space-y-2">
              {leagues.map((league) => (
                <SelectionButton
                  key={league.leagueId}
                  variant="card"
                  onClick={() => changeLeague(league)}
                  disabled={saveMutation.isPending}
                >
                  <span className="icon-surface size-10 overflow-hidden">
                    {league.badgeUrl ? (
                      <img src={league.badgeUrl} alt="" className="size-8 object-contain" />
                    ) : (
                      <HugeiconsIcon icon={TrophyIcon} className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold wrap-anywhere">{league.leagueName}</span>
                    <span className="mt-1 block text-sm text-muted-foreground wrap-anywhere">
                      {league.sportName} · {league.country || "Worldwide"}
                    </span>
                  </span>
                </SelectionButton>
              ))}
              {!leagues.length ? (
                <div className="empty-state text-sm text-muted-foreground">
                  {followedLeagues.length ? (
                    "No matching leagues found."
                  ) : (
                    <div>
                      <p>Follow a league to choose your favourite teams.</p>
                      <Button className="mt-4" onClick={onAddLeague}>
                        Add a league
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : teamsQuery.isPending ? (
            <div className="empty-state text-sm text-muted-foreground" role="status">
              Loading teams…
            </div>
          ) : teamsQuery.isError ? (
            <div className="alert-error" role="alert">
              <p>Teams could not be loaded. Please try again.</p>
              <Button variant="outline" className="mt-3" onClick={() => teamsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 @xl/dialog:grid-cols-2">
              {teams.map((team) => {
                const selected = selectedTeams.has(team.idTeam);
                return (
                  <SelectionButton
                    key={team.idTeam}
                    variant="card"
                    aria-pressed={selected}
                    onClick={() => toggleTeam(team)}
                    disabled={saveMutation.isPending || (!selected && selectedTeams.size >= 200)}
                  >
                    <span className="icon-surface size-10 overflow-hidden">
                      {team.strBadge ? (
                        <img src={team.strBadge} alt="" className="size-8 object-contain" />
                      ) : (
                        <HugeiconsIcon icon={FavouriteIcon} className="size-5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold wrap-anywhere">{team.strTeam}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {team.strCountry || selectedLeague.country || "Worldwide"}
                      </span>
                    </span>
                    <HugeiconsIcon
                      icon={selected ? CheckmarkCircle02Icon : PlusSignIcon}
                      className={`size-5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </SelectionButton>
                );
              })}
              {!teams.length ? (
                <div className="empty-state col-span-full text-sm text-muted-foreground">
                  {teamsQuery.data?.length
                    ? "No matching teams found."
                    : "No teams are available for this league. Try another league."}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="dialog-footer-padding border-t">
          {selectedLeague ? (
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : `Done · ${newSelectionCount} selected`}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Choose a league to continue</span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
