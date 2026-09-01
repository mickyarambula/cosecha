import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal, Kpi } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { SendButton } from "@/components/send-doc";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  cancelSupplierBill,
  listBills,
  listGrowerPayables,
  registerPago,
  registerPagoProductor,
} from "@/lib/produce-server";
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
  const payables = useAsync(() => listGrowerPayables(), []);
  const [pago, setPago] = useState<{ id: number; number: string; saldo: number } | null>(null);
  const [pagoRem, setPagoRem] = useState<{ id: number; number: string; saldo: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cancelBill, setCancelBill] = useState<{ id: number; number: string } | null>(null);

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

  async function pagarRemision(e: React.FormEvent) {
    e.preventDefault();
    if (!pagoRem) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await registerPagoProductor({
        data: { payable_id: pagoRem.id, amount: Number(amount) },
      });
      setPagoRem(null);
      setMsg(`Pago ${r.folio} · saldo ${money(r.remaining)}`);
      await payables.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Vendor invoices matched against what was ordered and received. Opening bills from Egresos have no PO yet."
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
                {b.status !== "cancelled" && b.purchase_order_id ? (
                  <Button size="sm" variant="outline" onClick={() => setCancelBill({ id: b.id, number: b.bill_number })}>
                    Cancel
                  </Button>
                ) : null}
                <SendButton
                  title="Vendor invoice"
                  number={b.bill_number}
                  partyName={b.supplier_name}
                  email={b.supplier_email}
                  phone={b.supplier_phone}
                  docs={
                    b.purchase_order_id
                      ? [{ tipo: "oc", id: b.purchase_order_id, label: "Purchase Order" }]
                      : []
                  }
                  total={b.total}
                  size="sm"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
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
                <p className="text-xs text-muted">Paid</p>
                <p className="tabular-nums">{money(b.paid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Balance</p>
                <p className="tabular-nums font-semibold">{money(b.saldo)}</p>
              </div>
            </div>
            <CancelledNote by={b.cancelled_by} at={b.cancelled_at} reason={b.cancel_reason} />
            {b.saldo > 0.009 && b.status !== "cancelled" ? (
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

      {(payables.data ?? []).length > 0 ? (
        <div className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold">Por remitir a productores</h2>
              <p className="text-sm text-muted">
                Dinero de cargas a comisión pura ya liquidadas — no es compra a proveedor, por eso
                no entra en el balance de arriba.
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {money((payables.data ?? []).reduce((s, p) => s + p.saldo, 0))}
            </p>
          </div>
          <div className="grid gap-3">
            {(payables.data ?? []).map((p) => (
              <Panel key={p.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-muted">
                      {p.payable_number} · {p.settlement_number} · {p.po_number}
                    </p>
                    <h3 className="font-display text-lg font-semibold">{p.supplier_name}</h3>
                    <p className="text-xs text-muted">{fecha(p.issue_date)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={orderTone(p.status)}>{orderLabel(p.status)}</Badge>
                    <a
                      className="text-xs text-link"
                      href={`/doc/liq/${p.settlement_token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver liquidación
                    </a>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted">Total</p>
                    <p className="tabular-nums font-medium">{money(p.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Pagado</p>
                    <p className="tabular-nums">{money(p.paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Saldo</p>
                    <p className="tabular-nums font-semibold">{money(p.saldo)}</p>
                  </div>
                </div>
                {p.saldo > 0.009 && p.status !== "cancelled" ? (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      onClick={() => {
                        setPagoRem({ id: p.id, number: p.payable_number, saldo: p.saldo });
                        setAmount(String(p.saldo));
                      }}
                    >
                      Registrar pago
                    </Button>
                  </div>
                ) : null}
              </Panel>
            ))}
          </div>
        </div>
      ) : null}

      {cancelBill ? (
        <CancelDialog
          title={`Cancel bill ${cancelBill.number}`}
          subtitle="This does not touch inventory — it only voids the payable document."
          onClose={() => setCancelBill(null)}
          onConfirm={async (reason) => {
            await cancelSupplierBill({ data: { bill_id: cancelBill.id, reason: reason || undefined } });
            setCancelBill(null);
            await bills.reload();
          }}
        />
      ) : null}

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

      {pagoRem ? (
        <Modal title={`Pagar ${pagoRem.number}`} onClose={() => setPagoRem(null)}>
          <form className="grid gap-3" onSubmit={pagarRemision}>
            <p className="text-sm text-muted">Saldo {money(pagoRem.saldo)}</p>
            <Field label="Monto">
              <Input required type="number" min="0.01" step="0.01" max={pagoRem.saldo} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Registrar pago"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
