import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const selectionVariants = cva(
  "touch-target flex min-w-0 touch-manipulation items-center border text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-foreground aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:hover:bg-accent aria-pressed:hover:text-accent-foreground",
  {
    variants: {
      variant: {
        pill: "min-h-control shrink-0 justify-center gap-2 rounded-full border-border bg-card px-4 py-2 text-muted-foreground",
        navigation:
          "w-full gap-2 rounded-lg border-transparent px-2 py-1.5 text-left text-xs text-muted-foreground",
        card: "w-full gap-4 rounded-xl border-border bg-card p-4 text-left text-foreground",
      },
    },
    defaultVariants: { variant: "pill" },
  },
);

export function SelectionButton({
  className,
  variant,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof selectionVariants>) {
  return (
    <button type={type} className={cn(selectionVariants({ variant }), className)} {...props} />
  );
}
