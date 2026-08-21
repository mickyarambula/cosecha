import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { PageHeader, Panel, Kpi } from "@/components/app-shell";
import { Badge, orderLabel, orderTone, qualityLabel, qualityTone } from "@/components/ui/badge";
import { getDashboard } from "@/lib/produce-server";
import { daysUntil, money, qty } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => getDashboard(),
  component: Home,
});

function Home() {
  const data = Route.useLoaderData();

  return (
    <div>
      <PageHeader
        title="Tablero"
        subtitle="Calidad, cartera y caja — lo que hay que mover hoy."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Caja" value={money(data.cash)} tone={data.cash >= 0 ? "ok" : "danger"} />
        <Kpi label="Por cobrar" value={money(data.cxc)} tone={data.cxc > 0 ? "warn" : "ok"} hint="CxC abierta" />
        <Kpi label="Por pagar" value={money(data.cxp)} tone={data.cxp > 0 ? "warn" : "ok"} hint="CxP abierta" />
        <Kpi label="Inventario" value={money(data.inventoryValue)} />
        <Kpi
          label="Lotes retenidos"
          value={String(data.counts.retenidos)}
          tone={data.counts.retenidos ? "warn" : "ok"}
          hint="No se pueden vender"
        />
        <Kpi label="Órdenes abiertas" value={`${data.counts.pos} OC · ${data.counts.sos} OV`} />
      </div>

      {data.alerts.length ? (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Hoy</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {data.alerts.map((a, i) => {
              const tone = a.kind === "calidad" || a.kind === "cxc" ? "warn" : "mute";
              return (
                <Link
                  key={`${a.kind}-${a.title}-${i}`}
                  to={a.href as "/compras" | "/inventario" | "/cxc"}
                  className="block"
                >
                  <Panel className="p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start gap-3">
                      <span className={tone === "warn" ? "text-warn" : "text-muted"}>
                        <AlertTriangle className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted">{a.title}</p>
                        <p className="text-sm font-medium">{a.detail}</p>
                      </div>
                    </div>
                  </Panel>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Aging y calidad</h2>
            <Link to="/inventario" className="text-xs font-medium text-primary">
              Inventario
            </Link>
          </div>
          <div className="space-y-2">
            {data.aging.map((lot) => {
              const days = daysUntil(lot.best_by_date);
              const tone = days == null ? "mute" : days < 0 ? "danger" : days <= 4 ? "warn" : "ok";
              return (
                <div key={lot.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{lot.product_name}</p>
                    <p className="text-xs text-muted">
                      {lot.lot_number} · {qty(lot.current_qty, lot.unit)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={qualityTone(lot.quality_state)}>{qualityLabel(lot.quality_state)}</Badge>
                    <Badge tone={tone}>{days == null ? "Sin fecha" : days < 0 ? `Vencido ${-days}d` : `${days}d`}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Ventas abiertas</h2>
            <Link to="/ventas" className="text-xs font-medium text-primary">
              Ventas
            </Link>
          </div>
          {data.openSales.length === 0 ? (
            <p className="text-sm text-muted">No hay pedidos pendientes de surtir.</p>
          ) : (
            <div className="space-y-2">
              {data.openSales.map((so) => (
                <div key={so.so_number} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{so.so_number}</p>
                    <p className="text-xs text-muted">{so.customer}</p>
                  </div>
                  <Badge tone={orderTone(so.status)}>{orderLabel(so.status)}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Link to="/cxc" className="rounded-md bg-surface-2 px-2 py-3 text-xs font-medium text-muted hover:text-fg">
              <ArrowDownLeft className="mx-auto mb-1 size-4 text-primary" />
              CxC
            </Link>
            <Link to="/cxp" className="rounded-md bg-surface-2 px-2 py-3 text-xs font-medium text-muted hover:text-fg">
              <ArrowUpRight className="mx-auto mb-1 size-4 text-primary" />
              CxP
            </Link>
            <Link to="/tesoreria" className="rounded-md bg-surface-2 px-2 py-3 text-xs font-medium text-muted hover:text-fg">
              <Wallet className="mx-auto mb-1 size-4 text-primary" />
              Caja
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
