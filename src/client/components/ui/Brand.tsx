import { TrophyIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-control shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <HugeiconsIcon icon={TrophyIcon} className="size-5" />
      </span>
      <div>
        <p className="section-title">Sports Center</p>
        <p className="text-xs text-muted-foreground">Your leagues, one place</p>
      </div>
    </div>
  );
}
