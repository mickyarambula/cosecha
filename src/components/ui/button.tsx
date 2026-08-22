import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  {
    variants: {
      variant: {
        default: "bg-action text-action-fg hover:bg-action/90",
        brand: "bg-primary text-primary-fg hover:bg-primary/90",
        outline: "border border-border bg-surface text-fg hover:bg-surface-2",
        ghost: "text-fg hover:bg-surface-2",
        danger: "bg-danger text-primary-fg hover:bg-danger/90",
        link: "text-link hover:underline px-0 min-h-0 h-auto",
      },
      size: {
        default: "h-10 min-h-10 px-4",
        sm: "h-8 min-h-8 px-3 text-xs",
        icon: "size-10 min-h-10 p-0",
        lg: "h-11 min-h-11 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  const t = useT();
  const content = typeof children === "string" ? t(children) : children;
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} {...props}>
      {content}
    </Comp>
  );
}
