import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi, Panel } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";
import { poShort } from "@/lib/nav";
import { getVendorPortal } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, pct } from "@/lib/utils";

export const Route = createFileRoute("/portal/$id")({
  component: Page,
});

function Page() {
  const t = useT();
  const { id } = Route.useParams();
  const portal = useAsync(() => getVendorPortal({ data: { token: id } }), [id]);
  const d = portal.data;
  const level = d?.level ?? "po";
  // C-2c: con liquidación emitida el productor ve el congelado, no el vivo.
  const liq = d?.liquidation ?? null;

  if (portal.loading) return <p className="p-6 text-sm text-muted">{t("Loading vendor portal…")}</p>;
  if (portal.error) return <p className="p-6 text-sm text-danger">{portal.error}</p>;
  if (!d) return null;

  return (
    <div className="mx-auto max-w-6xl p-5">
      <p className="mb-3 text-xs text-muted">
        Esta vista es idéntica a lo que ve un proveedor en el Portal de Proveedor si compartes la vista{" "}
        {level === "po" ? "de OC" : level === "basic" ? "de OC + ventas básicas" : "de OC + ventas detalladas"}.
      </p>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{t("Navigate to")}</p>
          <h1 className="text-xl font-semibold">
            {COMPANY.legalName} {t("Summary")} · {t("Customer PO #")} {poShort(d.po_number)}
          </h1>
        </div>
        <Link to="/compras" className="text-sm text-link">
          {t("Back to purchase orders")}
        </Link>
      </div>

      {liq ? (
        <Panel className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Cuenta rendida al productor</p>
          <p className="mt-1 text-sm">
            Liquidación <span className="font-mono">{liq.settlement_number}</span> emitida el {fecha(liq.issue_date)} —
            neto al productor <strong className="tabular-nums">{money(liq.net_to_grower)}</strong>, pago final{" "}
            <strong className="tabular-nums">{money(liq.final_payment)}</strong>{" "}
            <a href={`/doc/liq/${liq.share_token}`} target="_blank" rel="noreferrer" className="text-link">
              Ver cuenta
            </a>
          </p>
          {liq.supplements.map((x) => (
            <p key={x.supplement_number} className="mt-1 text-sm">
              Complementaria <span className="font-mono">{x.supplement_number}</span> emitida el {fecha(x.issue_date)} —
              neto <strong className="tabular-nums">{money(x.net_to_grower)}</strong>
              {x.balance_due > 0.009 ? (
                <>
                  , saldo a favor de Plein <strong className="tabular-nums">{money(x.balance_due)}</strong>
                </>
              ) : (
                <>
                  , pago final <strong className="tabular-nums">{money(x.final_payment)}</strong>
                </>
              )}{" "}
              <a href={`/doc/liq/${x.share_token}`} target="_blank" rel="noreferrer" className="text-link">
                Ver cuenta
              </a>
            </p>
          ))}
          <p className="mt-2 text-xs text-muted">
            Las cifras de abajo son las de los documentos emitidos
            {liq.supplements.length ? ` (liquidación y ${liq.supplements.length} complementaria${liq.supplements.length === 1 ? "" : "s"})` : ""}
            ; lo que se venda o gaste después se rinde en la siguiente cuenta complementaria.
          </p>
        </Panel>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total sales" value={money(liq ? liq.revenue_total : d.revenue)} />
        <Kpi label="Purchaser expenses" value={money(liq ? liq.grower_expenses_total : d.expenses)} />
        <Kpi
          label="Commission $"
          value={money(liq ? liq.commission_total : d.profit)}
          hint={pct(liq ? (liq.revenue_total > 0 ? (liq.commission_total / liq.revenue_total) * 100 : 0) : d.profit_pct)}
          tone="ok"
        />
        <Kpi label={liq ? "Neto al productor" : "Remaining balance"} value={money(liq ? liq.net_total : d.balance_due)} />
      </div>

      <Panel className="mt-4">
        <p className="mb-3 text-sm font-semibold">{t("Order Detail")}</p>
        <div className="mb-3 grid gap-2 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase text-muted">{t("Vendor")}</p>
            <p>{d.supplier_name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted">{t("Requested date")}</p>
            <p>{fecha(d.expected_date)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted">{t("Customer PO #")}</p>
            <p>{poShort(d.po_number)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted">{t("BOL #")}</p>
            <p>{d.bol || "—"}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                {["Item", "Lot #", "B/E", "Avg $/U", "T/Sales $", "Sold", "Wasted", "Returned", "Remaining", "Qty", "Cost/U", "Total cost"].map(
                  (h) => (
                    <th key={h} className="px-2 py-2">
                      {t(h)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {d.lots.map((l, i) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="px-2 py-2">
                    {i + 1}. {l.product_name}
                    {l.pack_name ? ` — ${l.pack_name}` : ""}
                  </td>
                  <td className="px-2 py-2 text-link">{l.lot_number}</td>
                  <td className="px-2 py-2">{l.pas ? "PAS" : money(l.cost_unit)}</td>
                  <td className="px-2 py-2">{l.sold ? money(l.revenue / l.sold) : "—"}</td>
                  <td className="px-2 py-2">{money(l.revenue)}</td>
                  <td className="px-2 py-2">{l.sold}</td>
                  <td className="px-2 py-2">{l.waste}</td>
                  <td className="px-2 py-2">{l.rts}</td>
                  <td className="px-2 py-2">{l.remaining}</td>
                  <td className="px-2 py-2">{l.total}</td>
                  <td className="px-2 py-2">{l.pas ? <Badge tone="danger">PAS</Badge> : money(l.cost_unit)}</td>
                  <td className="px-2 py-2">{l.pas ? money(0) : money(l.t_cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {level !== "po" ? (
        <Panel className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{t("Sales")}</p>
            <span className="text-sm text-muted">
              {t("Total sales")} {money(liq ? liq.revenue_total : d.revenue)}
              {liq ? " (documentos emitidos)" : ""}
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                {["Requested date", "Item", "Lot #", "Status", "Type", "Qty", "$/Unit", "Total"].map((h) => (
                  <th key={h} className="px-2 py-2">
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.sales.map((s, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-2 py-2">{fecha(s.order_date)}</td>
                  <td className="px-2 py-2">{s.item}</td>
                  <td className="px-2 py-2">{s.lot_number}</td>
                  <td className="px-2 py-2 text-danger">{s.status}</td>
                  <td className="px-2 py-2">{s.type}</td>
                  <td className="px-2 py-2">{s.qty}</td>
                  <td className="px-2 py-2">{money(s.unit_price)}</td>
                  <td className="px-2 py-2">{money(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {level !== "po" ? (
        <Panel className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">{t("Expenses")}</p>
            <span className="text-sm text-muted">
              {t("Total expenses")} {money(liq ? liq.grower_expenses_total : d.expenses)}
              {liq ? " (al productor, documentos emitidos)" : ""}
            </span>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                {["Type", "Notes", "Total"].map((h) => (
                  <th key={h} className="px-2 py-2">
                    {t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.expense_rows.map((e, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-2 py-2">{e.category}</td>
                  <td className="px-2 py-2 text-muted">{e.notes || "—"}</td>
                  <td className="px-2 py-2">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : null}

      <Panel className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{t("Payments")}</p>
          <span className="text-sm text-muted">
            {t("Total payments")} {money(d.paid)} · {t("Remaining")} {money(d.balance_due)}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{t("No payments found.")}</p>
      </Panel>
    </div>
  );
}
