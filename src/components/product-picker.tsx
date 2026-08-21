import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SkuOption } from "@/components/sku-select";
import { cn } from "@/lib/utils";

export function ProductPicker({
  skus,
  onAdd,
  onClose,
  extra,
  stock,
}: {
  skus: SkuOption[];
  onAdd: (sku: SkuOption) => void;
  onClose: () => void;
  extra?: React.ReactNode;
  stock?: Record<number, { ats: number; oh: number; price?: number }>;
}) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return skus.slice(0, 80);
    return skus.filter((x) => `${x.product_name} ${x.variety ?? ""} ${x.empaque ?? ""} ${x.calibre ?? ""} ${x.unit}`.toLowerCase().includes(s)).slice(0, 80);
  }, [skus, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-fg/40 p-0 sm:p-8" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none bg-surface shadow-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <Search className="size-4 text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setHi(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHi((v) => Math.min(v + 1, rows.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHi((v) => Math.max(v - 1, 0));
              }
              if (e.key === "Enter" && rows[hi]) {
                e.preventDefault();
                onAdd(rows[hi]);
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder="Search product, pack, variety…"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Unit</th>
                <th className="px-4 py-2 font-medium">Label</th>
                {stock ? (
                  <>
                    <th className="px-4 py-2 font-medium">Default price</th>
                    <th className="px-4 py-2 text-right font-medium">ATS</th>
                    <th className="px-4 py-2 text-right font-medium">O/H</th>
                  </>
                ) : null}
                <th className="w-28 px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr
                  key={`${s.product_id}-${s.id}`}
                  className={cn("border-b border-border/70", i === hi && "bg-action/8")}
                  onMouseEnter={() => setHi(i)}
                >
                  <td className="px-4 py-2 font-medium text-link">
                    {s.product_name}
                    {s.variety ? ` ${s.variety}` : ""}
                  </td>
                  <td className="px-4 py-2 text-muted">{s.empaque || s.unit || s.name}</td>
                  <td className="px-4 py-2 text-muted">{s.calibre || "—"}</td>
                  {stock ? (
                    <>
                      <td className="px-4 py-2">
                        {stock[s.product_id]?.price != null ? `$${(stock[s.product_id]?.price ?? 0).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">{stock[s.product_id]?.ats ?? 0}</td>
                      <td className="px-4 py-2 text-right">{stock[s.product_id]?.oh ?? 0}</td>
                    </>
                  ) : null}
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" onClick={() => onAdd(s)}>
                      Add
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">No matching inventory items.</p> : null}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted">
          <span>
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5">Enter</kbd> to add the highlighted row
          </span>
          {extra ?? <span>Add new inventory item</span>}
        </div>
      </div>
    </div>
  );
}

export function FilterRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-border bg-surface px-4 py-3 sm:px-5">{children}</div>
  );
}

export function FilterField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-36 flex-col gap-1", className)}>
      <span className="label-caps">{label}</span>
      {children}
    </label>
  );
}

export function EmptyOrders({ onNew, kind = "purchase" }: { onNew?: () => void; kind?: "purchase" | "sales" }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <svg viewBox="0 0 80 80" className="mb-4 size-20 text-subtle" aria-hidden>
        <circle cx="40" cy="28" r="10" fill="currentColor" opacity="0.18" />
        <path d="M24 62c4-12 10-18 16-18s12 6 16 18" fill="currentColor" opacity="0.18" />
        <rect x="30" y="44" width="20" height="14" rx="2" fill="currentColor" opacity="0.28" />
      </svg>
      <p className="text-lg font-medium text-muted">No orders found</p>
      <p className="mt-1 max-w-md text-sm text-subtle">
        {kind === "sales"
          ? "Here you'll see sales orders for your account. Create a new order to sell from inventory by clicking "
          : "Here you'll see purchase orders made for your account. You can create new orders and notify vendors by clicking "}
        <button type="button" className="text-link" onClick={onNew}>
          New Order
        </button>
        .
      </p>
    </div>
  );
}
