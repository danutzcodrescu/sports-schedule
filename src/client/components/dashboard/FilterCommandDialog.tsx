import { Badge } from "#/components/ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/Dialog";
import { inputVariants } from "#/components/ui/Input";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { FavouriteIcon, Search01Icon, SparklesIcon, TrophyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useId, useRef } from "react";

import type { FavouriteTeam, FollowedLeague } from "#/lib/api/sports";

type FilterCommandDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagues: FollowedLeague[];
  teams: FavouriteTeam[];
  activeLeagueId: string | null;
  activeTeamId: string | null;
  onLeagueChange: (leagueId: string | null) => void;
  onTeamChange: (teamId: string) => void;
  onClearTeam: () => void;
};

type FilterCommand = {
  value: string;
  label: string;
  description: string;
  badgeUrl?: string | null;
  icon: typeof TrophyIcon;
  active: boolean;
  onSelect: () => void;
};

type FilterGroup = {
  label: string;
  items: FilterCommand[];
};

export function FilterCommandDialog({
  open,
  onOpenChange,
  leagues,
  teams,
  activeLeagueId,
  activeTeamId,
  onLeagueChange,
  onTeamChange,
  onClearTeam,
}: FilterCommandDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();
  const { contains } = Autocomplete.useFilter({ sensitivity: "base" });
  const groups: FilterGroup[] = [
    {
      label: "My leagues",
      items: [
        {
          value: "all-leagues",
          label: "All followed leagues",
          description: "Show events across your followed leagues",
          icon: SparklesIcon,
          active: activeLeagueId === null,
          onSelect: () => onLeagueChange(null),
        },
        ...leagues.map((league) => ({
          value: `league-${league.leagueId}`,
          label: league.leagueName,
          description: [league.sportName, league.country].filter(Boolean).join(" · "),
          badgeUrl: league.badgeUrl,
          icon: TrophyIcon,
          active: activeLeagueId === league.leagueId,
          onSelect: () => onLeagueChange(league.leagueId),
        })),
      ],
    },
    {
      label: "My teams",
      items: teams.map((team) => ({
        value: `team-${team.teamId}`,
        label: team.teamName,
        description: [
          leagues.find((league) => league.leagueId === team.leagueId)?.leagueName,
          team.country,
        ]
          .filter(Boolean)
          .join(" · "),
        badgeUrl: team.badgeUrl,
        icon: FavouriteIcon,
        active: activeTeamId === team.teamId,
        onSelect: () => onTeamChange(team.teamId),
      })),
    },
  ];

  if (activeTeamId) {
    groups.push({
      label: "Filters",
      items: [
        {
          value: "clear-team",
          label: "Clear team filter",
          description: "Restore your Favourites / All selection",
          icon: SparklesIcon,
          active: false,
          onSelect: onClearTeam,
        },
      ],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-layout overflow-hidden" initialFocus={inputRef}>
        <Autocomplete.Root
          open
          inline
          items={groups}
          autoHighlight="always"
          keepHighlight
          itemToStringValue={(item) => item.label}
          filter={(item, query) => contains(`${item.label} ${item.description}`, query.trim())}
        >
          <DialogHeader className="dialog-header-padding border-b">
            <DialogTitle>Filter leagues and teams</DialogTitle>
            <DialogDescription>Search your followed leagues and favourite teams.</DialogDescription>
            <div className="relative mt-3">
              <HugeiconsIcon
                icon={Search01Icon}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <Autocomplete.Input
                ref={inputRef}
                className={inputVariants({ className: "pl-10" })}
                placeholder="Search leagues or teams…"
                aria-label="Search leagues and teams"
                aria-describedby={instructionsId}
              />
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain p-2">
            <Autocomplete.Empty>
              <div className="empty-state text-sm text-muted-foreground">
                No matching leagues or teams found.
              </div>
            </Autocomplete.Empty>
            <Autocomplete.List>
              {(group: FilterGroup) => (
                <Autocomplete.Group key={group.label} items={group.items} className="mb-2">
                  <Autocomplete.GroupLabel className="eyebrow px-3 py-2">
                    {group.label}
                  </Autocomplete.GroupLabel>
                  <Autocomplete.Collection>
                    {(item: FilterCommand) => (
                      <Autocomplete.Item
                        key={item.value}
                        value={item}
                        className="touch-target flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        onClick={() => {
                          item.onSelect();
                          onOpenChange(false);
                        }}
                      >
                        <span className="icon-surface size-8 overflow-hidden">
                          {item.badgeUrl ? (
                            <img src={item.badgeUrl} alt="" className="size-6 object-contain" />
                          ) : (
                            <HugeiconsIcon icon={item.icon} className="size-4" aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium wrap-anywhere">{item.label}</span>
                          <span className="block text-xs text-muted-foreground wrap-anywhere">
                            {item.description}
                          </span>
                        </span>
                        {item.active ? <Badge>Active</Badge> : null}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              )}
            </Autocomplete.List>
          </div>

          <p
            id={instructionsId}
            className="dialog-footer-padding border-t text-xs text-muted-foreground"
          >
            ↑ ↓ to navigate · Enter to select · Esc to close
          </p>
        </Autocomplete.Root>
      </DialogContent>
    </Dialog>
  );
}
