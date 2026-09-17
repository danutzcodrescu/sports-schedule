import { Badge } from "#/components/ui/Badge";
import { Button } from "#/components/ui/Button";
import { SelectionButton } from "#/components/ui/SelectionButton";
import {
  Cancel01Icon,
  FavouriteIcon,
  PlusSignIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { FavouriteTeam } from "#/lib/api/sports";

export type MyTeamsProps = {
  teams: FavouriteTeam[];
  activeTeamId: string | null;
  onTeamChange: (teamId: string) => void;
  onAddTeam: () => void;
  onRemoveTeam: (teamId: string) => void;
  isSavingTeams: boolean;
  hasTeamsError: boolean;
};

export function MyTeams({
  teams,
  activeTeamId,
  onTeamChange,
  onAddTeam,
  onRemoveTeam,
  isSavingTeams,
  hasTeamsError,
}: MyTeamsProps) {
  return (
    <section className="min-w-0" aria-label="My teams">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={UserGroupIcon} className="size-4 text-muted-foreground" />
          <h2 className="eyebrow">My teams</h2>
          {teams.length ? <Badge>{teams.length}</Badge> : null}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onAddTeam}
          disabled={isSavingTeams}
          aria-label="Add a favourite team"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
        </Button>
      </div>
      {hasTeamsError ? (
        <p className="alert-error mb-2" role="alert">
          Could not remove the team. Please try again.
        </p>
      ) : null}
      {teams.length ? (
        <ul className="p-1">
          {teams.map((team) => (
            <li key={team.teamId} className="flex min-w-0 items-center gap-2 rounded-lg pr-2">
              <SelectionButton
                variant="navigation"
                className="flex-1"
                aria-pressed={activeTeamId === team.teamId}
                onClick={() => onTeamChange(team.teamId)}
                title={team.teamName}
              >
                <span className="icon-surface size-6 overflow-hidden">
                  {team.badgeUrl ? (
                    <img src={team.badgeUrl} alt="" className="size-5 object-contain" />
                  ) : (
                    <HugeiconsIcon icon={FavouriteIcon} className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{team.teamName}</span>
              </SelectionButton>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemoveTeam(team.teamId)}
                disabled={isSavingTeams}
                aria-label={`Remove ${team.teamName} from favourites`}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="sidebar-team-empty flex flex-col items-center gap-3 px-2 py-4 text-center">
          <HugeiconsIcon icon={FavouriteIcon} className="size-7 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No favourite teams yet</p>
          <Button variant="secondary" size="sm" onClick={onAddTeam}>
            Add a team
          </Button>
        </div>
      )}
    </section>
  );
}
