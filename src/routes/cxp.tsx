import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal, Kpi } from "@/components/app-shell";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { listBills, registerPago } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, qty } from "@/lib/utils";

export const Route = createFileRoute("/cxp")({ component: Page });

function matchTone(m: string) {
  if (m === "cuadrado") return "ok" as const;
  if (m === "faltante") return "warn" as const;
  return "danger" as const;
}

function Page() {
  const bills = useAsync(() => listBills(), []);
  const [pago, setPago] = useState<{ id: number; number: string; saldo: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = bills.data ?? [];
  const kpis = useMemo(() => {
    const saldo = rows.reduce((s, r) => s + r.saldo, 0);
    const abiertas = rows.filter((r) => r.saldo > 0.009).length;
    const descuadre = rows.filter((r) => r.match !== "cuadrado").length;
    return { saldo, abiertas, descuadre };
  }, [rows]);

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (!pago) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await registerPago({ data: { bill_id: pago.id, amount: Number(amount) } });
      setPago(null);
      setMsg(`Payment ${r.folio} · remaining ${money(r.remaining)}`);
      await bills.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Vendor invoices matched against what was ordered and received."
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Balance" value={money(kpis.saldo)} />
        <Kpi label="Open" value={String(kpis.abiertas)} tone={kpis.abiertas ? "warn" : "ok"} />
        <Kpi label="Receive mismatch" value={String(kpis.descuadre)} tone={kpis.descuadre ? "warn" : "ok"} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {bills.loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {bills.error ? <p className="text-sm text-danger">{bills.error}</p> : null}
      {rows.length === 0 && !bills.loading ? (
        <p className="text-sm text-muted">No vendor invoices yet. Receive a purchase and capture its invoice.</p>
      ) : null}
      <div className="grid gap-3">
        {rows.map((b) => (
          <Panel key={b.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-muted">
                  {b.bill_number}
                  {b.po_number ? ` · ${b.po_number}` : ""}
                </p>
                <h2 className="font-display text-lg font-semibold">{b.supplier_name}</h2>
                <p className="text-xs text-muted">
                  {fecha(b.issue_date)} · vence {fecha(b.due_date)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={matchTone(b.match)}>
                  {b.match === "cuadrado" ? "Match" : b.match === "faltante" ? "Short vs ordered" : "Over received"}
                </Badge>
                <Badge tone={orderTone(b.status)}>{orderLabel(b.status)}</Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted">Ordered</p>
                <p className="tabular-nums">{qty(b.ordered_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Received</p>
                <p className="tabular-nums">{qty(b.received_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Invoiced</p>
                <p className="tabular-nums font-medium">{money(b.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Balance</p>
                <p className="tabular-nums font-semibold">{money(b.saldo)}</p>
              </div>
            </div>
            {b.saldo > 0.009 ? (
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setPago({ id: b.id, number: b.bill_number, saldo: b.saldo });
                    setAmount(String(b.saldo));
                  }}
                >
                  Record payment
                </Button>
              </div>
            ) : null}
          </Panel>
        ))}
      </div>

      {pago ? (
        <Modal title={`Pay ${pago.number}`} onClose={() => setPago(null)}>
          <form className="grid gap-3" onSubmit={pagar}>
            <p className="text-sm text-muted">Balance {money(pago.saldo)}</p>
            <Field label="Amount">
              <Input required type="number" min="0.01" step="0.01" max={pago.saldo} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Apply payment"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
