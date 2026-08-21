import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi, Panel } from "@/components/app-shell";
import { FilterField, FilterRow } from "@/components/product-picker";
import { poShort } from "@/lib/nav";
import { getDashboard, listPurchasedLots, listSalesOrders } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, todayISO } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/reportes")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "department",
  }),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const dash = useAsync(() => getDashboard(), []);
  const sales = useAsync(() => listSalesOrders(), []);
  const purchased = useAsync(() => listPurchasedLots(), []);
  const rows = sales.data ?? [];

  const byCustomer = useMemo(() => {
    const map = new Map<string, { orders: number; units: number; sales: number; cost: number }>();
    for (const so of rows) {
      const cur = map.get(so.customer_name) ?? { orders: 0, units: 0, sales: 0, cost: 0 };
      cur.orders += 1;
      for (const l of so.lines) {
        cur.units += l.quantity_ordered;
        cur.sales += l.quantity_ordered * l.unit_price;
        cur.cost += l.quantity_ordered * (l.unit_cost || 0);
      }
      map.set(so.customer_name, cur);
    }
    return [...map.entries()];
  }, [rows]);

  const dept = useMemo(() => {
    const units = rows.reduce((s, so) => s + so.lines.reduce((a, l) => a + l.quantity_ordered, 0), 0);
    const salesT = rows.reduce((s, so) => s + so.lines.reduce((a, l) => a + l.quantity_ordered * l.unit_price, 0), 0);
    const cost = rows.reduce((s, so) => s + so.lines.reduce((a, l) => a + l.quantity_ordered * (l.unit_cost || 0), 0), 0);
    const profit = salesT - cost;
    return { orders: rows.length, units, salesT, cost, profit, margin: salesT ? (profit / salesT) * 100 : 0, markup: cost ? (profit / cost) * 100 : 0 };
  }, [rows]);

  if (tab === "overview") {
    const d = dash.data;
    return (
      <div className="p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Cash" value={money(d?.cash)} />
          <Kpi label="Accounts receivable" value={money(d?.cxc)} />
          <Kpi label="Accounts payable" value={money(d?.cxp)} />
          <Kpi label="Inventory value" value={money(d?.inventoryValue)} />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {(d?.alerts ?? []).map((a, i) => (
            <Link key={`${a.kind}-${i}`} to={a.href as "/compras"} className="block">
              <Panel className="p-4 hover:border-primary/40">
                <p className="text-xs text-muted">{a.title}</p>
                <p className="text-sm font-medium">{a.detail}</p>
              </Panel>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "customer") {
    return (
      <div>
        <FilterRow>
          <FilterField label="SO requested date">
            <InputDate />
          </FilterField>
        </FilterRow>
        <Table
          cols={["Customer", "# Orders", "Inv. units sold", "T/ Inv. sales", "T/ Cost", "T/ Profit", "% Profit"]}
          rows={byCustomer.map(([name, r]) => [
            name,
            String(r.orders),
            String(r.units),
            money(r.sales),
            money(r.cost),
            money(r.sales - r.cost),
            r.sales ? `${(((r.sales - r.cost) / r.sales) * 100).toFixed(1)}%` : "—",
          ])}
        />
      </div>
    );
  }

  if (tab === "user") {
    return (
      <div>
        <FilterRow>
          <FilterField label="SO requested date">
            <InputDate />
          </FilterField>
        </FilterRow>
        <Table
          cols={["Sales rep", "# Orders", "Inv. units sold", "T/ Inv. sales", "T/ Cost", "T/ Profit", "% Profit"]}
          rows={[
            [
              "Juan Mercado",
              String(dept.orders),
              String(dept.units),
              money(dept.salesT),
              money(dept.cost),
              money(dept.profit),
              `${dept.margin.toFixed(1)}%`,
            ],
          ]}
        />
      </div>
    );
  }

  if (tab === "purchased") {
    const lots = purchased.data ?? [];
    const cog = lots.reduce((s, l) => s + l.t_cost, 0);
    const units = lots.reduce((s, l) => s + l.total_qty, 0);
    const pos = new Set(lots.map((l) => l.po_number).filter(Boolean)).size;
    return (
      <div>
        <div className="px-5 pt-5">
          <h1 className="text-xl font-semibold">Purchased Lots</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Received purchase lots based on received date. Unreceived purchase lots are not included. Returns, regardless of date,
            are reflected in the Returned Qty column.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          <Kpi label="Cost of goods received" value={money(cog)} />
          <Kpi label="Units received" value={String(units)} />
          <Kpi label="Purchase orders received" value={String(pos)} />
          <Kpi label="Cost of goods returned" value={money(0)} />
        </div>
        <Table
          cols={["Lot #", "Item", "PO #", "Vendor", "BOL #", "Received", "Total qty", "Returned qty", "Total COG"]}
          rows={lots.map((l) => [
            l.lot_number,
            `${l.product_name}${l.pack_name ? ` — ${l.pack_name}` : ""}${l.origin ? ` · ${l.origin}` : ""}`,
            l.po_number ? poShort(l.po_number) : "—",
            l.vendor || "—",
            l.bol || "—",
            fecha(l.received_date),
            String(l.total_qty),
            String(l.returned_qty),
            money(l.t_cost),
          ])}
        />
      </div>
    );
  }

  if (tab === "vendor" || tab === "inventory" || tab === "items") {
    const itemRows = rows.flatMap((so) =>
      so.lines.map((l) => [
        l.product_name,
        so.customer_name,
        String(l.quantity_ordered),
        money(l.unit_price),
        money(l.quantity_ordered * l.unit_price),
        money(l.quantity_ordered * (l.unit_cost || 0)),
      ]),
    );
    const title =
      tab === "vendor" ? "Sales by Vendor" : tab === "inventory" ? "Sales by Inventory" : "Item Detail";
    return (
      <div>
        <div className="px-5 pt-5">
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <FilterRow>
          <FilterField label="SO requested date">
            <InputDate />
          </FilterField>
        </FilterRow>
        <Table cols={["Item", "Customer", "Units", "Price", "Sales", "Cost"]} rows={itemRows} />
      </div>
    );
  }

  return (
    <div>
      <div className="px-5 pt-5">
        <h1 className="text-xl font-semibold">Sales by Department</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          This report groups sales data based on the departments associated with the inventory on a sales order item. Cost data
          for inventory items is based on the purchase cost of both wasted and sold units, plus expenses (if enabled).
        </p>
      </div>
      <FilterRow>
        <FilterField label="SO requested date">
          <InputDate />
        </FilterField>
        <FilterField label="Sales rep">
          <select className="flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm">
            <option>All sales reps</option>
          </select>
        </FilterField>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="inline-flex h-5 w-9 items-center rounded-full bg-action p-0.5">
            <span className="ml-auto size-4 rounded-full bg-white" />
          </span>
          View report with expenses
        </label>
      </FilterRow>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-xs text-muted">
            <tr>
              {[
                "Name",
                "# Orders",
                "Inv. Units Sold",
                "T/ Inv. Sales",
                "Non-Inv. Units Sold",
                "T/ Non-Inv. Sales",
                "Avg. Sales",
                "T/ Cost",
                "Avg. Cost",
                "T/ Profit",
                "Avg. Profit",
                "% Profit",
                "% Markup",
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border bg-surface">
              <td className="px-3 py-2">Uncategorized</td>
              <td className="px-3 py-2">{dept.orders}</td>
              <td className="px-3 py-2">{dept.units}</td>
              <td className="px-3 py-2">{money(dept.salesT)}</td>
              <td className="px-3 py-2">0</td>
              <td className="px-3 py-2">{money(0)}</td>
              <td className="px-3 py-2">{money(dept.orders ? dept.salesT / dept.orders : 0)}</td>
              <td className="px-3 py-2">{money(dept.cost)}</td>
              <td className="px-3 py-2">{money(dept.orders ? dept.cost / dept.orders : 0)}</td>
              <td className="px-3 py-2">{money(dept.profit)}</td>
              <td className="px-3 py-2">{money(dept.orders ? dept.profit / dept.orders : 0)}</td>
              <td className="px-3 py-2">{dept.margin.toFixed(2)}%</td>
              <td className="px-3 py-2">{dept.markup.toFixed(0)}%</td>
            </tr>
            <tr className="bg-surface-2 font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2">{dept.orders}</td>
              <td className="px-3 py-2">{dept.units}</td>
              <td className="px-3 py-2">{money(dept.salesT)}</td>
              <td className="px-3 py-2">0</td>
              <td className="px-3 py-2">{money(0)}</td>
              <td className="px-3 py-2">{money(dept.orders ? dept.salesT / dept.orders : 0)}</td>
              <td className="px-3 py-2">{money(dept.cost)}</td>
              <td className="px-3 py-2">{money(dept.orders ? dept.cost / dept.orders : 0)}</td>
              <td className="px-3 py-2">{money(dept.profit)}</td>
              <td className="px-3 py-2">{money(dept.orders ? dept.profit / dept.orders : 0)}</td>
              <td className="px-3 py-2">{dept.margin.toFixed(2)}%</td>
              <td className="px-3 py-2">{dept.markup.toFixed(0)}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InputDate() {
  return <input type="date" defaultValue={todayISO()} className="flex h-9 w-full rounded-md border border-border bg-surface px-3 text-sm" />;
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-y border-border bg-surface-2 text-xs text-muted">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border bg-surface">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
