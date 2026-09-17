import { Button } from "#/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/DropdownMenu";
import { MyTeams } from "./MyTeams";
import {
  ArrowDown01Icon,
  Logout01Icon,
  PlusSignIcon,
  SparklesIcon,
  TrophyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import type { FollowedLeague } from "#/lib/api/sports";
import type { MyTeamsProps } from "./MyTeams";

type DashboardHeaderProps = MyTeamsProps & {
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
  ...teamProps
}: DashboardHeaderProps) {
  const activeLeague = leagues.find((league) => league.leagueId === activeLeagueId);

  return (
    <header className="page-padding border-b bg-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1 text-primary">Personal schedule</p>
          <h1 className="page-title">{activeLeague?.leagueName || "Your sports timeline"}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          <Button variant="outline" size="icon" onClick={onAddLeague} aria-label="Add a league">
            <HugeiconsIcon icon={PlusSignIcon} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSignOut} aria-label="Sign out">
            <HugeiconsIcon icon={Logout01Icon} />
          </Button>
        </div>
      </div>

      {leagues.length ? (
        <div className="mt-4 lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Followed leagues"
              render={<Button variant="outline" className="w-full min-w-0 justify-between" />}
            >
              <LeagueIcon league={activeLeague} />
              <span className="min-w-0 flex-1 truncate text-left">
                {activeLeague?.leagueName || "All followed"}
              </span>
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent aria-label="Followed leagues">
              <DropdownMenuRadioGroup
                value={activeLeagueId ?? ""}
                onValueChange={(value) => onLeagueChange(value || null)}
              >
                <DropdownMenuRadioItem value="" closeOnClick>
                  <LeagueIcon />
                  <span className="min-w-0 wrap-anywhere">All followed</span>
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {leagues.map((league) => (
                  <DropdownMenuRadioItem key={league.leagueId} value={league.leagueId} closeOnClick>
                    <LeagueIcon league={league} />
                    <span className="min-w-0 wrap-anywhere">{league.leagueName}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
      <details className="mt-3 rounded-lg border lg:hidden">
        <summary className="touch-target cursor-pointer px-3 py-3 text-sm font-medium">
          My teams · {teamProps.teams.length}
        </summary>
        <div className="border-t p-2">
          <MyTeams {...teamProps} />
        </div>
      </details>
    </header>
  );
}

function LeagueIcon({ league }: { league?: FollowedLeague }) {
  return league?.badgeUrl ? (
    <img src={league.badgeUrl} alt="" className="size-5 shrink-0 object-contain" />
  ) : (
    <HugeiconsIcon icon={league ? TrophyIcon : SparklesIcon} className="size-5 shrink-0" />
  );
}
