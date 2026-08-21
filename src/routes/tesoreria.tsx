import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel, Kpi } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { listCash } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money } from "@/lib/utils";

export const Route = createFileRoute("/tesoreria")({ component: Page });

function kindTone(kind: string) {
  if (kind === "cobro") return "ok" as const;
  if (kind === "pago") return "danger" as const;
  return "mute" as const;
}

function kindLabel(kind: string) {
  if (kind === "cobro") return "Receipt";
  if (kind === "pago") return "Payment";
  if (kind === "ajuste") return "Adjustment";
  return kind;
}

function Page() {
  const cash = useAsync(() => listCash(), []);
  const data = cash.data;
  const movs = data?.movements ?? [];
  const cobros = movs.filter((m) => m.kind === "cobro").reduce((s, m) => s + m.amount, 0);
  const pagos = movs.filter((m) => m.kind === "pago").reduce((s, m) => s + m.amount, 0);

  return (
    <div>
      <PageHeader title="Debt aging" subtitle="Cash movements. Receipts and vendor payments stay on the ledger." />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Balance" value={money(data?.balance ?? 0)} tone={(data?.balance ?? 0) >= 0 ? "ok" : "danger"} />
        <Kpi label="Receipts" value={money(cobros)} tone="ok" />
        <Kpi label="Payments" value={money(pagos)} tone="danger" />
      </div>
      {cash.loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {cash.error ? <p className="text-sm text-danger">{cash.error}</p> : null}
      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Folio</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Counterparty</th>
                <th className="px-4 py-3 font-medium">Ref</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{m.folio}</td>
                  <td className="px-4 py-3">{fecha(m.mov_date)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={kindTone(m.kind)}>{kindLabel(m.kind)}</Badge>
                  </td>
                  <td className="px-4 py-3">{m.counterparty ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {m.invoice_number ? (
                      <Link to="/cxc" className="text-primary">
                        {m.invoice_number}
                      </Link>
                    ) : m.bill_number ? (
                      <Link to="/cxp" className="text-primary">
                        {m.bill_number}
                      </Link>
                    ) : (
                      <span className="text-muted">{m.notes ?? "—"}</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${m.amount < 0 ? "text-danger" : "text-ok"}`}>
                    {money(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
