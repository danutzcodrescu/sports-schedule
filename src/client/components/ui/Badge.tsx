import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        accent: "bg-accent text-accent-foreground",
        live: "bg-live/15 text-live",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
