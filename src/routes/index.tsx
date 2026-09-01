import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ClipboardList, Package, Star, Users, Warehouse } from "lucide-react";
import { useAccess } from "@/components/access-gate";
import { Kpi, Panel } from "@/components/app-shell";
import { Badge, orderLabel, orderTone, qualityLabel, qualityTone } from "@/components/ui/badge";
import { canAccess } from "@/lib/access";
import { useT } from "@/lib/i18n";
import { getDashboard } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { daysUntil, fecha, money, qty } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

const STARS = [
  { to: "/compras", label: "Purchase Orders", icon: ClipboardList },
  { to: "/ventas", label: "Sales Orders", icon: ClipboardList },
  { to: "/inventario", label: "Inventory", icon: Warehouse },
  { to: "/productos", label: "Products & SKUs", icon: Package, search: { tab: "catalog" as const } },
  { to: "/clientes", label: "Customers", icon: Users },
  { to: "/gastos", label: "Expenses", icon: ArrowUpRight },
  { to: "/cxc", label: "Credits", icon: ArrowDownLeft },
] as const;

const FLOW = [
  {
    n: "1",
    to: "/productos" as const,
    search: { tab: "catalog" as const },
    title: "Products & SKUs",
    body: "Create the product, then each pack × count (PAPA-MARA-CAJA-10CT).",
  },
  {
    n: "2",
    to: "/clientes" as const,
    title: "Preferred SKUs",
    body: "On a customer or vendor, pin the SKUs they buy or grow, plus their item code.",
  },
  {
    n: "3",
    to: "/compras" as const,
    title: "Purchase Orders",
    body: "Send the OC by email or WhatsApp, then receive into lots.",
  },
  {
    n: "4",
    to: "/inventario" as const,
    search: { tab: "units" as const },
    title: "Available Units",
    body: "Stock on lots — not the catalog. Lots appear after you receive a PO.",
  },
  {
    n: "5",
    to: "/ventas" as const,
    title: "Sales Orders",
    body: "Sell from those SKUs, then invoice the customer.",
  },
  {
    n: "6",
    to: "/cxc" as const,
    search: { tab: "invoices" as const },
    title: "Invoices",
    body: "Send invoices and statements by email or WhatsApp from the same row.",
  },
];

function Home() {
  const { data, loading } = useAsync(() => getDashboard(), []);
  const t = useT();
  const access = useAccess();
  const stars = STARS.filter((s) => canAccess(access, s.to));
  const flow = FLOW.filter((s) => canAccess(access, s.to));

  return (
    <div className="p-5">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("Favorites")}</h1>
          <p className="text-sm text-muted">{t("Starred workspaces for Plein Produce LLC")}</p>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
        {stars.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.to}
              to={s.to}
              search={"search" in s ? s.search : undefined}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-3 hover:border-primary/40"
            >
              <Star className="size-3.5 fill-warn text-warn" />
              <Icon className="size-5 text-primary" />
              <span className="text-sm font-medium">{t(s.label)}</span>
            </Link>
          );
        })}
      </div>
      <div className="mb-6">
        <h2 className="mb-2 text-sm font-semibold">{t("How Cosecha runs")}</h2>
        <p className="mb-3 text-sm text-muted">
          {t("Catalog is the item. Inventory is the lot. Send lives on every order and invoice.")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {flow.map((step) => (
            <Link
              key={step.n}
              to={step.to}
              search={"search" in step ? step.search : undefined}
              className="flex gap-3 rounded-lg border border-border bg-surface p-3 hover:border-primary/40"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {step.n}
              </span>
              <span>
                <span className="block text-sm font-medium">{t(step.title)}</span>
                <span className="mt-0.5 block text-xs text-muted">{t(step.body)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cash" value={loading || !data ? "—" : money(data.cash)} tone={!data ? undefined : data.cash >= 0 ? "ok" : "danger"} />
        <Kpi label="Receivable" value={loading || !data ? "—" : money(data.cxc)} />
        <Kpi
          label="Payable"
          value={loading || !data ? "—" : money(data.cxp)}
          hint={
            data && data.porRemitir > 0.009
              ? `Por remitir a productores ${money(data.porRemitir)}`
              : undefined
          }
        />
        <Kpi label="Inventory" value={loading || !data ? "—" : money(data.inventoryValue)} />
      </div>
      {data?.corte ? (
        <p className="mt-2 text-xs text-muted">
          {t("Opening as of {d} · Chase {chase} and JEAMS {jeams} from Ingresos, Egresos and Chase — Cargas is catalog only.", {
            d: fecha(data.corte.as_of),
            chase: money(data.corte.chase),
            jeams: money(data.corte.jeams),
          })}
        </p>
      ) : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("Lots needing attention")}</h2>
            <Link to="/inventario" className="text-xs text-link">
              {t("Inventory")}
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
                      {days == null ? t("No date") : days < 0 ? t("Past {n}d", { n: -days }) : t("{n}d", { n: days })}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {loading ? <p className="text-sm text-muted">{t("Loading lots…")}</p> : null}
            {!loading && !data?.aging.length ? <p className="text-sm text-muted">{t("No lots on hold.")}</p> : null}
          </div>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("Open sales")}</h2>
            <Link to="/ventas" className="text-xs text-link">
              {t("Sales Orders")}
            </Link>
          </div>
          {!data || data.openSales.length === 0 ? (
            <p className="text-sm text-muted">{loading ? t("Loading sales…") : t("No open sales orders.")}</p>
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
