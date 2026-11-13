import { Button } from "#/components/ui/Button";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";

import type { ComponentProps } from "react";

export function RowRemoveButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn("row-remove hover:text-destructive", className)}
      {...props}
    >
      <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
    </Button>
  );
}
