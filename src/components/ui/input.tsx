import * as React from "react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Input({ className, placeholder, ...props }: React.ComponentProps<"input">) {
  const t = useT();
  return (
    <input
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-subtle",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        "disabled:bg-surface-2 disabled:text-muted",
        className,
      )}
      placeholder={placeholder ? t(placeholder) : undefined}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("label-caps", className)} {...props} />;
}

export function Textarea({ className, placeholder, ...props }: React.ComponentProps<"textarea">) {
  const t = useT();
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-subtle",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      placeholder={placeholder ? t(placeholder) : undefined}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-fg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const t = useT();
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="label-caps">{t(label)}</span>
      {children}
    </label>
  );
}
