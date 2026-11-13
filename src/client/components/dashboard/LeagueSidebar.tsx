import { Badge } from "#/components/ui/Badge";
import { Brand } from "#/components/ui/Brand";
import { Button } from "#/components/ui/Button";
import { SelectionButton } from "#/components/ui/SelectionButton";
import { MyTeams } from "./MyTeams";
import { RowRemoveButton } from "./RowRemoveButton";
import { Logout01Icon, PlusSignIcon, SparklesIcon, TrophyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { FollowedLeague } from "#/lib/api/sports";
import type { MyTeamsProps } from "./MyTeams";

type LeagueSidebarProps = MyTeamsProps & {
  userName: string;
  leagues: FollowedLeague[];
  activeLeagueId: string | null;
  onLeagueChange: (leagueId: string | null) => void;
  onAddLeague: () => void;
  onRemoveLeague: (leagueId: string) => void;
  isRemovingLeague: boolean;
  leagueRemovalError: string | null;
  onSignOut: () => Promise<void>;
};

export function LeagueSidebar({
  userName,
  leagues,
  activeLeagueId,
  onLeagueChange,
  onAddLeague,
  onRemoveLeague,
  isRemovingLeague,
  leagueRemovalError,
  onSignOut,
  ...teamProps
}: LeagueSidebarProps) {
  return (
    <aside className="league-sidebar sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-r bg-card lg:flex">
      <div className="sidebar-brand shrink-0 border-b p-4">
        <Brand />
      </div>

      <div className="sidebar-content min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="mb-1 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <h2 className="eyebrow">My leagues</h2>
            <Badge>{leagues.length}</Badge>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onAddLeague}
            disabled={isRemovingLeague}
            aria-label="Add a league"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          </Button>
        </div>

        <nav className="p-1" aria-label="Followed leagues">
          {leagueRemovalError ? (
            <p className="alert-error mb-2" role="alert">
              {leagueRemovalError}
            </p>
          ) : null}
          {leagues.length ? (
            <SelectionButton
              variant="navigation"
              aria-pressed={activeLeagueId === null}
              onClick={() => onLeagueChange(null)}
            >
              <span className="icon-surface size-6">
                <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
              </span>
              <span className="truncate font-medium">All followed</span>
            </SelectionButton>
          ) : null}
          {leagues.map((league) => (
            <div
              key={league.leagueId}
              className="removable-row flex min-w-0 items-center gap-2 rounded-lg pr-2"
            >
              <SelectionButton
                variant="navigation"
                className="min-w-0 flex-1"
                aria-pressed={activeLeagueId === league.leagueId}
                onClick={() => onLeagueChange(league.leagueId)}
                title={league.leagueName}
              >
                <span className="icon-surface size-6 overflow-hidden">
                  {league.badgeUrl ? (
                    <img src={league.badgeUrl} alt="" className="size-5 object-contain" />
                  ) : (
                    <HugeiconsIcon icon={TrophyIcon} className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{league.leagueName}</span>
              </SelectionButton>
              <RowRemoveButton
                onClick={() => onRemoveLeague(league.leagueId)}
                disabled={isRemovingLeague || teamProps.isSavingTeams}
                aria-label={`Remove ${league.leagueName} from followed leagues`}
              />
            </div>
          ))}
          {!leagues.length ? (
            <SelectionButton
              variant="card"
              onClick={onAddLeague}
              className="mt-2 justify-center border-dashed py-8"
            >
              Add your first league
            </SelectionButton>
          ) : null}
        </nav>
        <div className="sidebar-team-section mt-3 border-t pt-3">
          <MyTeams {...teamProps} />
        </div>
      </div>

      <div className="sidebar-footer shrink-0 border-t p-3">
        <div className="flex items-center gap-2 rounded-xl px-2 py-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium">{userName}</span>
          <Button variant="ghost" size="icon-sm" onClick={onSignOut} aria-label="Sign out">
            <HugeiconsIcon icon={Logout01Icon} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
