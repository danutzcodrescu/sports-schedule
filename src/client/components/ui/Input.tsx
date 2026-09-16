import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva } from "class-variance-authority";
import { cn } from "cn";

import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

const inputVariants = cva(
  "w-full min-w-0 rounded-md border border-input bg-background text-foreground transition-colors file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
  {
    variants: {
      size: {
        default: "h-control px-3 py-2 text-base file:text-sm",
        lg: "h-control-lg px-4 py-3 text-base file:text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function Input({
  className,
  size = "default",
  type,
  ...props
}: Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  );
}

export { Input, inputVariants };
