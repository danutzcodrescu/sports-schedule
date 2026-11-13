import { Button } from "#/components/ui/Button";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";

import type { ComponentProps } from "react";

export function RowRemoveButton({
  busy = false,
  className,
  onClick,
  ...props
}: ComponentProps<typeof Button> & { busy?: boolean }) {
  // Native `disabled` adds the base button's `disabled:opacity-50` utility.
  // Utilities layer after components, so it would override the hidden state of
  // every row's control and show all ×s until the pending change finishes.
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn("row-remove hover:text-destructive", className)}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
    </Button>
  );
}
