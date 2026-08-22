import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/icon.png"
      alt="Plein Produce"
      className={cn("h-8 w-8 rounded-md object-cover", className)}
    />
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/wordmark.png"
      alt="Plein Produce"
      className={cn("h-10 w-auto bg-transparent object-contain object-left", className)}
    />
  );
}
