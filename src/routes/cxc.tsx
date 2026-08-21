import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal, Kpi } from "@/components/app-shell";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { listInvoices, registerCobro } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, qty } from "@/lib/utils";

export const Route = createFileRoute("/cxc")({ component: Page });

function Page() {
  const inv = useAsync(() => listInvoices(), []);
  const [cobro, setCobro] = useState<{ id: number; number: string; saldo: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const rows = inv.data ?? [];
  const kpis = useMemo(() => {
    const saldo = rows.reduce((s, r) => s + r.saldo, 0);
    const vencida = rows.filter((r) => r.overdue).reduce((s, r) => s + r.saldo, 0);
    const abierta = rows.filter((r) => r.saldo > 0.009).length;
    return { saldo, vencida, abierta };
  }, [rows]);

  async function cobrar(e: React.FormEvent) {
    e.preventDefault();
    if (!cobro) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await registerCobro({ data: { invoice_id: cobro.id, amount: Number(amount) } });
      setCobro(null);
      setMsg(`Cobro ${r.folio} · queda ${money(r.remaining)}`);
      await inv.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo registrar el cobro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Cuentas por cobrar" subtitle="Facturas al cliente. El cobro entra a tesorería." />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Saldo" value={money(kpis.saldo)} />
        <Kpi label="Cartera vencida" value={money(kpis.vencida)} tone={kpis.vencida ? "danger" : "ok"} />
        <Kpi label="Abiertas" value={String(kpis.abierta)} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {inv.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {inv.error ? <p className="text-sm text-danger">{inv.error}</p> : null}
      {rows.length === 0 && !inv.loading ? <p className="text-sm text-muted">Sin facturas. Factura una venta despachada.</p> : null}
      <div className="grid gap-3">
        {rows.map((i) => {
          const status = i.overdue ? "overdue" : i.status;
          return (
            <Panel key={i.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted">
                    {i.invoice_number}
                    {i.so_number ? ` · ${i.so_number}` : ""}
                  </p>
                  <h2 className="font-display text-lg font-semibold">{i.customer_name}</h2>
                  <p className="text-xs text-muted">
                    Emitida {fecha(i.issue_date)} · vence {fecha(i.due_date)}
                    {i.overdue ? ` · vencida ${i.days_overdue}d` : ""}
                  </p>
                </div>
                <Badge tone={orderTone(status)}>{orderLabel(status)}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted">Total</p>
                  <p className="tabular-nums font-medium">{money(i.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Cobrado</p>
                  <p className="tabular-nums">{money(i.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Saldo</p>
                  <p className="tabular-nums font-semibold">{money(i.saldo)}</p>
                </div>
              </div>
              {i.lines.length ? (
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {i.lines.map((l, idx) => (
                    <li key={idx}>
                      {l.description} · {qty(l.quantity, l.unit ?? undefined)} · {money(l.amount)}
                    </li>
                  ))}
                </ul>
              ) : null}
              {i.saldo > 0.009 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setCobro({ id: i.id, number: i.invoice_number, saldo: i.saldo });
                      setAmount(String(i.saldo));
                    }}
                  >
                    Registrar cobro
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/doc/$tipo/$id" params={{ tipo: "factura", id: String(i.id) }}>
                      Documento
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-3">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/doc/$tipo/$id" params={{ tipo: "factura", id: String(i.id) }}>
                      Documento
                    </Link>
                  </Button>
                </div>
              )}
            </Panel>
          );
        })}
      </div>

      {cobro ? (
        <Modal title={`Cobro ${cobro.number}`} onClose={() => setCobro(null)}>
          <form className="grid gap-3" onSubmit={cobrar}>
            <p className="text-sm text-muted">Saldo {money(cobro.saldo)}</p>
            <Field label="Monto">
              <Input required type="number" min="0.01" step="0.01" max={cobro.saldo} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Registrando…" : "Aplicar cobro"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
