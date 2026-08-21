import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ClipboardList, Star, Users, Warehouse } from "lucide-react";
import { Kpi, Panel } from "@/components/app-shell";
import { Badge, orderLabel, orderTone, qualityLabel, qualityTone } from "@/components/ui/badge";
import { getDashboard } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { daysUntil, money, qty } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

const STARS = [
  { to: "/compras", label: "Purchase Orders", icon: ClipboardList },
  { to: "/ventas", label: "Sales Orders", icon: ClipboardList },
  { to: "/inventario", label: "Inventory", icon: Warehouse },
  { to: "/clientes", label: "Customers", icon: Users },
  { to: "/gastos", label: "Expenses", icon: ArrowUpRight },
  { to: "/cxc", label: "Credits", icon: ArrowDownLeft },
] as const;

function Home() {
  const { data, loading } = useAsync(() => getDashboard(), []);

  return (
    <div className="p-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Favorites</h1>
          <p className="text-sm text-muted">Starred workspaces for Plein Produce LLC</p>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STARS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-3 hover:border-primary/40"
            >
              <Star className="size-3.5 fill-warn text-warn" />
              <Icon className="size-5 text-primary" />
              <span className="text-sm font-medium">{s.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cash" value={loading || !data ? "—" : money(data.cash)} tone={!data ? undefined : data.cash >= 0 ? "ok" : "danger"} />
        <Kpi label="Receivable" value={loading || !data ? "—" : money(data.cxc)} />
        <Kpi label="Payable" value={loading || !data ? "—" : money(data.cxp)} />
        <Kpi label="Inventory" value={loading || !data ? "—" : money(data.inventoryValue)} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Lots needing attention</h2>
            <Link to="/inventario" className="text-xs text-link">
              Inventory
            </Link>
          </div>
          <div className="space-y-2">
            {(data?.aging ?? []).map((lot) => {
              const days = daysUntil(lot.best_by_date);
              return (
                <div key={lot.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{lot.product_name}</p>
                    <p className="text-xs text-muted">
                      {lot.lot_number} · {qty(lot.current_qty, lot.unit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={qualityTone(lot.quality_state)}>{qualityLabel(lot.quality_state)}</Badge>
                    <Badge tone={days == null ? "mute" : days < 0 ? "danger" : days <= 4 ? "warn" : "ok"}>
                      {days == null ? "No date" : days < 0 ? `Past ${-days}d` : `${days}d`}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {loading ? <p className="text-sm text-muted">Loading lots…</p> : null}
            {!loading && !(data?.aging.length) ? <p className="text-sm text-muted">No lots on hold.</p> : null}
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Open sales</h2>
            <Link to="/ventas" className="text-xs text-link">
              Sales Orders
            </Link>
          </div>
          {!data || data.openSales.length === 0 ? (
            <p className="text-sm text-muted">{loading ? "Loading sales…" : "No open sales orders."}</p>
          ) : (
            <div className="space-y-2">
              {data.openSales.map((so) => (
                <div key={so.so_number} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{so.so_number}</p>
                    <p className="text-xs text-muted">{so.customer}</p>
                  </div>
                  <Badge tone={orderTone(so.status)}>{orderLabel(so.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
