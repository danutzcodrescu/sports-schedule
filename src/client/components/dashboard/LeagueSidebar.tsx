import { Badge } from "#/components/ui/Badge";
import { Brand } from "#/components/ui/Brand";
import { Button } from "#/components/ui/Button";
import { SelectionButton } from "#/components/ui/SelectionButton";
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
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-r bg-card lg:flex">
      <div className="shrink-0 border-b p-6">
        <Brand />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <h2 className="eyebrow">My leagues</h2>
            <Badge>{leagues.length}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onAddLeague} aria-label="Add a league">
            <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1" aria-label="Followed leagues">
          {leagues.length ? (
            <SelectionButton
              variant="navigation"
              aria-pressed={activeLeagueId === null}
              onClick={() => onLeagueChange(null)}
            >
              <span className="icon-surface size-8">
                <HugeiconsIcon icon={SparklesIcon} className="size-4" />
              </span>
              <span className="truncate font-medium">All followed</span>
            </SelectionButton>
          ) : null}
          {leagues.map((league) => (
            <SelectionButton
              variant="navigation"
              key={league.leagueId}
              aria-pressed={activeLeagueId === league.leagueId}
              onClick={() => onLeagueChange(league.leagueId)}
            >
              <span className="icon-surface size-8 overflow-hidden">
                {league.badgeUrl ? (
                  <img src={league.badgeUrl} alt="" className="size-7 object-contain" />
                ) : (
                  <HugeiconsIcon icon={TrophyIcon} className="size-4" />
                )}
              </span>
              <span className="truncate font-medium">{league.leagueName}</span>
            </SelectionButton>
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
      </div>

      <div className="shrink-0 border-t p-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-control shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{userName}</span>
          <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sign out">
            <HugeiconsIcon icon={Logout01Icon} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
