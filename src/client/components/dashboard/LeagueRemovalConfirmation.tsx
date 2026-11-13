import { Button } from "#/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/Dialog";

import type { useLeagueRemoval } from "./useLeagueRemoval";

export function LeagueRemovalConfirmation({
  removal,
}: {
  removal: ReturnType<typeof useLeagueRemoval>;
}) {
  const multipleLeagues = (removal.confirmation?.request.leagueIds.length ?? 0) > 1;
  return (
    <Dialog
      open={removal.confirmation !== null}
      onOpenChange={(open) => {
        if (!open) removal.cancel();
      }}
    >
      <DialogContent showCloseButton={!removal.isPending}>
        <DialogHeader className="dialog-header-padding">
          <DialogTitle>
            {multipleLeagues
              ? "Remove leagues and favourite teams?"
              : "Remove league and favourite teams?"}
          </DialogTitle>
          <DialogDescription>
            These favourite teams do not belong to another league you follow. Removing{" "}
            {multipleLeagues ? "these leagues" : "the league"} will also remove them from your
            favourites.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-body-padding min-h-0 overflow-y-auto">
          <ul className="space-y-2">
            {removal.confirmation?.teams.map((team) => (
              <li key={team.teamId} className="text-sm font-medium wrap-anywhere">
                {team.teamName}
              </li>
            ))}
          </ul>
          {removal.error ? (
            <p className="alert-error mt-3" role="alert">
              {removal.error}
            </p>
          ) : null}
        </div>
        <DialogFooter className="dialog-footer-padding">
          <Button variant="outline" onClick={removal.cancel} disabled={removal.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={removal.confirm} disabled={removal.isPending}>
            {removal.isPending
              ? "Removing…"
              : multipleLeagues
                ? "Remove leagues and teams"
                : "Remove league and teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
