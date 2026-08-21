import type { ReactNode } from "react";
import { CALIDAD_LABEL, cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ok: "bg-ok/12 text-ok",
  warn: "bg-surface-2 text-muted",
  danger: "bg-danger/12 text-danger",
  mute: "bg-surface-2 text-muted",
  unpaid: "bg-rose-100 text-rose-700",
};

export function Badge({ children, tone = "mute" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function orderTone(status: string) {
  const s = status.toLowerCase();
  if (s === "completed" || s === "active" || s === "paid" || s === "recibido" || s === "converted" || s === "fulfilled" || s === "received")
    return "ok" as const;
  if (s === "partial" || s === "confirmed" || s === "open") return "warn" as const;
  if (s === "cancelled" || s === "expired" || s === "depleted" || s === "overdue" || s === "unpaid") return "danger" as const;
  return "mute" as const;
}

export function orderLabel(status: string) {
  const map: Record<string, string> = {
    draft: "Draft",
    confirmed: "Confirmed",
    partial: "Partial",
    completed: "Fulfilled",
    received: "Received",
    cancelled: "Cancelled",
    active: "Active",
    depleted: "Depleted",
    expired: "Expired",
    open: "Unpaid",
    converted: "Converted",
    paid: "Paid",
    overdue: "Overdue",
    unpaid: "Unpaid",
  };
  return map[status] ?? status;
}

export function qualityTone(state: string | null | undefined) {
  const s = (state || "sano").toLowerCase();
  if (s === "sano") return "ok" as const;
  if (s === "retenido") return "warn" as const;
  if (s === "castigado") return "danger" as const;
  return "mute" as const;
}

export function qualityLabel(state: string | null | undefined) {
  return CALIDAD_LABEL[(state || "sano").toLowerCase()] ?? state ?? "Sound";
}

export function RoleBadges({ proveedor, cliente }: { proveedor?: boolean; cliente?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {proveedor ? <Badge tone="ok">Vendor</Badge> : null}
      {cliente ? <Badge>Customer</Badge> : null}
    </span>
  );
}
