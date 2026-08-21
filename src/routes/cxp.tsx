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
      setMsg(`Pago ${r.folio} · queda ${money(r.remaining)}`);
      await bills.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Cuentas por pagar"
        subtitle="Factura del proveedor contra lo pedido y lo recibido (three-way match)."
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Saldo" value={money(kpis.saldo)} />
        <Kpi label="Abiertas" value={String(kpis.abiertas)} tone={kpis.abiertas ? "warn" : "ok"} />
        <Kpi label="Descuadre recepción" value={String(kpis.descuadre)} tone={kpis.descuadre ? "warn" : "ok"} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {bills.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {bills.error ? <p className="text-sm text-danger">{bills.error}</p> : null}
      {rows.length === 0 && !bills.loading ? (
        <p className="text-sm text-muted">Sin facturas de proveedor. Recibe una compra y captura su factura.</p>
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
                  {b.match === "cuadrado" ? "Match" : b.match === "faltante" ? "Faltante vs pedido" : "De más"}
                </Badge>
                <Badge tone={orderTone(b.status)}>{orderLabel(b.status)}</Badge>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted">Pedido</p>
                <p className="tabular-nums">{qty(b.ordered_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Recibido</p>
                <p className="tabular-nums">{qty(b.received_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Facturado</p>
                <p className="tabular-nums font-medium">{money(b.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Saldo</p>
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
                  Registrar pago
                </Button>
              </div>
            ) : null}
          </Panel>
        ))}
      </div>

      {pago ? (
        <Modal title={`Pago ${pago.number}`} onClose={() => setPago(null)}>
          <form className="grid gap-3" onSubmit={pagar}>
            <p className="text-sm text-muted">Saldo {money(pago.saldo)}</p>
            <Field label="Monto">
              <Input required type="number" min="0.01" step="0.01" max={pago.saldo} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Registrando…" : "Aplicar pago"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
