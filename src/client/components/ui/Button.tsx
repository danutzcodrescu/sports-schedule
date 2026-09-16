import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "touch-target group/button inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control px-4 text-sm",
        xs: "h-control-xs gap-1 px-2 text-xs",
        sm: "h-control-sm px-3 text-sm",
        lg: "h-control-lg px-5 text-base",
        icon: "size-control",
        "icon-xs": "size-control-xs",
        "icon-sm": "size-control-sm",
        "icon-lg": "size-control-lg [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
