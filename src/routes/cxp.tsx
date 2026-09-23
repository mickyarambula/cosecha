import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal, Kpi } from "@/components/app-shell";
import { AgingTable, groupAging } from "@/components/aging-table";
import { fxLabel, isFx, moneyMxn, originalLabel, parseFx } from "@/lib/fx";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { SendButton } from "@/components/send-doc";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import {
  cancelSupplierBill,
  listBills,
  listGrowerPayables,
  listPayables,
  registerPago,
  registerPagoProductor,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { agingByDue, fecha, money, PAY_METHODS, qty, todayISO } from "@/lib/utils";

type Search = { tab: string };

export const Route = createFileRoute("/cxp")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "bills",
  }),
  component: Page,
});

/** Pasó su fecha compromiso. Sin plazo capturado NO cuenta como vencida. */
function vencida(due: string | null | undefined) {
  return !!due && agingByDue(due) !== "current";
}

function matchTone(m: string) {
  if (m === "cuadrado") return "ok" as const;
  if (m === "faltante") return "warn" as const;
  return "danger" as const;
}

function Page() {
  const t = useT();
  const { tab } = Route.useSearch();
  const bills = useAsync(() => listBills(), []);
  const payables = useAsync(() => listGrowerPayables(), []);
  // Peso–dólar B: los gastos en pesos también son deuda en pesos.
  const gastos = useAsync(() => listPayables(), []);
  // TC de referencia para la exposición: una cuenta que haces tú, no se guarda.
  const [fxRef, setFxRef] = useState("");
  const [pago, setPago] = useState<{
    id: number;
    number: string;
    saldo: number;
    // Peso–dólar B: una factura pactada en pesos se paga en pesos.
    currency?: string;
    saldo_fx?: number | null;
    fx_agreed?: number | null;
  } | null>(null);
  const [fxPaid, setFxPaid] = useState("");
  const [pagoRem, setPagoRem] = useState<{ id: number; number: string; saldo: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState("ACH");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cancelBill, setCancelBill] = useState<{ id: number; number: string } | null>(null);

  const rows = bills.data ?? [];
  const kpis = useMemo(() => {
    const saldo = rows.reduce((s, r) => s + r.saldo, 0);
    const abiertas = rows.filter((r) => r.saldo > 0.009).length;
    const descuadre = rows.filter((r) => r.match !== "cuadrado").length;
    // Hallazgo 51: vencido = pasó su fecha compromiso. Lo que no trae plazo
    // capturado se cuenta aparte, no como vencido.
    const vencido = rows.filter((r) => vencida(r.due_date)).reduce((s, r) => s + r.saldo, 0);
    const sinPlazo = rows.filter((r) => r.saldo > 0.009 && !r.due_date).reduce((s, r) => s + r.saldo, 0);
    return { saldo, abiertas, descuadre, vencido, sinPlazo };
  }, [rows]);

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (!pago) return;
    setSaving(true);
    setMsg(null);
    try {
      const enPesos = pago.currency === "MXN";
      const r = await registerPago({
        data: enPesos
          ? {
              bill_id: pago.id,
              amount_fx: Number(amount),
              fx_paid: parseFx(fxPaid),
              pay_date: payDate,
              method: payMethod,
              reference: payRef.trim() || undefined,
            }
          : { bill_id: pago.id, amount: Number(amount), pay_date: payDate, method: payMethod, reference: payRef.trim() || undefined },
      });
      setPago(null);
      setMsg(
        `Pago ${r.folio} · restante ${money(r.remaining)}` +
          (Math.abs(r.fx_result) > 0.009
            ? ` · ${r.fx_result > 0 ? "ganancia" : "pérdida"} cambiaria ${money(Math.abs(r.fx_result))}`
            : ""),
      );
      await bills.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo registrar el pago");
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
        data: { payable_id: pagoRem.id, amount: Number(amount), pay_date: payDate, method: payMethod, reference: payRef.trim() || undefined },
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

  // Hallazgo 51: CxP no tenía antigüedad. Los 62 documentos del corte traen su
  // vencimiento real del V8, así que esta pestaña sirve desde el primer día.
  if (tab === "aging") {
    return (
      <div>
        <PageHeader
          title="Payables aging"
          subtitle="Lo que le debes a cada proveedor por fecha compromiso. Lo pagado no cuenta."
        />
        <AgingTable header="Vendor name" groups={groupAging<(typeof rows)[number]>(rows, (r) => r.supplier_name)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Vendor invoices matched against what was ordered and received. Opening bills from Egresos have no PO yet."
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Balance" value={money(kpis.saldo)} />
        <Kpi label="Overdue" value={money(kpis.vencido)} tone={kpis.vencido > 0.009 ? "danger" : "ok"} />
        <Kpi label="No terms" value={money(kpis.sinPlazo)} tone={kpis.sinPlazo > 0.009 ? "warn" : "ok"} />
        <Kpi label="Open" value={String(kpis.abiertas)} tone={kpis.abiertas ? "warn" : "ok"} />
        <Kpi label="Receive mismatch" value={String(kpis.descuadre)} tone={kpis.descuadre ? "warn" : "ok"} />
      </div>
      {(() => {
        // Peso–dólar B: cuánto debes EN PESOS hoy, cuánto vale al TC pactado,
        // y —si tecleas un TC— cuánto saldría de Chase a ese TC. Aquí no se
        // pronostica nada: el TC de referencia lo pones tú y no se guarda.
        const enPesos = [
          ...rows.filter((b) => b.currency === "MXN" && (b.saldo_fx ?? 0) > 0.009 && b.status !== "cancelled")
            .map((b) => ({ pesos: b.saldo_fx as number, usd: b.saldo })),
          ...(gastos.data ?? []).filter((g) => g.currency === "MXN" && (g.saldo_fx ?? 0) > 0.009)
            .map((g) => ({ pesos: g.saldo_fx as number, usd: g.saldo })),
        ];
        if (!enPesos.length) return null;
        const pesos = enPesos.reduce((s, x) => s + x.pesos, 0);
        const usd = enPesos.reduce((s, x) => s + x.usd, 0);
        const tc = parseFx(fxRef);
        const aTc = isFx(fxRef) ? pesos / (tc as number) : null;
        return (
          <Panel className="mb-5 p-4">
            <p className="label-caps">{t("Pesos exposure")}</p>
            <div className="mt-2 flex flex-wrap items-end gap-6 text-sm tabular-nums">
              <div>
                <p className="text-2xl font-semibold">{moneyMxn(pesos)}</p>
                <p className="text-muted">
                  que debes en pesos · {money(usd)} al TC pactado ({enPesos.length} documentos)
                </p>
              </div>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted">Si pagaras a este TC</span>
                <Input className="w-28" placeholder="17.50" value={fxRef} onChange={(e) => setFxRef(e.target.value)} />
              </label>
              {aTc != null ? (
                <div>
                  <p>Saldrían de Chase <strong>{money(aTc)}</strong></p>
                  <p className={usd - aTc >= 0 ? "text-ok" : "text-danger"}>
                    {usd - aTc >= 0 ? "ganarías" : "perderías"} {money(Math.abs(usd - aTc))} contra lo pactado
                  </p>
                </div>
              ) : null}
            </div>
          </Panel>
        );
      })()}
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {bills.loading ? <p className="text-sm text-muted">{t("Loading…")}</p> : null}
      {bills.error ? <p className="text-sm text-danger">{bills.error}</p> : null}
      {rows.length === 0 && !bills.loading ? (
        <p className="text-sm text-muted">
          {t("No vendor invoices yet. Receive a purchase and capture its invoice.")}
        </p>
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
                  {fecha(b.issue_date)} ·{" "}
                  {b.due_date ? (
                    <>
                      vence {fecha(b.due_date)}
                      {vencida(b.due_date) ? <span className="ml-1 text-danger">vencida</span> : null}
                    </>
                  ) : (
                    <span className="text-warn">sin plazo capturado</span>
                  )}
                </p>
                {b.currency === "MXN" ? (
                  <p className="text-xs text-muted">
                    Pactada en pesos: {originalLabel({ currency: b.currency, amount_fx: b.total_fx, fx: b.fx_agreed })} — congelada a ese TC.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone={matchTone(b.match)}>
                  {b.match === "cuadrado" ? "Matched" : b.match === "faltante" ? "Short vs ordered" : "Over received"}
                </Badge>
                <Badge tone={orderTone(b.status)}>{orderLabel(b.status)}</Badge>
                {b.status !== "cancelled" && b.purchase_order_id ? (
                  <Button size="sm" variant="outline" onClick={() => setCancelBill({ id: b.id, number: b.bill_number })}>
                    Cancel
                  </Button>
                ) : null}
                <SendButton
                  title={t("Vendor invoice")}
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
                <p className="text-xs text-muted">{t("Ordered")}</p>
                <p className="tabular-nums">{qty(b.ordered_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">{t("Received")}</p>
                <p className="tabular-nums">{qty(b.received_qty)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">{t("Invoiced")}</p>
                <p className="tabular-nums font-medium">{money(b.total)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">{t("Amount paid")}</p>
                <p className="tabular-nums">{money(b.paid)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">{t("Balance")}</p>
                <p className="tabular-nums font-semibold">{money(b.saldo)}</p>
              </div>
            </div>
            <CancelledNote by={b.cancelled_by} at={b.cancelled_at} reason={b.cancel_reason} />
            {b.saldo > 0.009 && b.status !== "cancelled" ? (
              <div className="mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setPago({
                      id: b.id,
                      number: b.bill_number,
                      saldo: b.saldo,
                      currency: b.currency,
                      saldo_fx: b.saldo_fx,
                      fx_agreed: b.fx_agreed,
                    });
                    // En pesos se propone lo que se debe en pesos; el TC del
                    // banco nunca se precarga — sale del estado de cuenta.
                    setAmount(String(b.currency === "MXN" && b.saldo_fx != null ? b.saldo_fx : b.saldo));
                    setFxPaid("");
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
                      {p.payable_number} · {p.supplement_number ?? p.settlement_number} · {p.po_number}
                      {p.supplement_number ? (
                        <span className="ml-2 font-sans normal-case">
                          complementaria de {p.settlement_number}
                        </span>
                      ) : null}
                    </p>
                    <h3 className="font-display text-lg font-semibold">{p.supplier_name}</h3>
                    <p className="text-xs text-muted">{fecha(p.issue_date)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={orderTone(p.status)}>{orderLabel(p.status)}</Badge>
                    <a
                      className="text-xs text-link"
                      href={`/doc/liq/${p.supplement_token ?? p.settlement_token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.supplement_number ? "Ver complementaria" : "Ver liquidación"}
                    </a>
                  </div>
                </div>
                {p.against_advances && p.saldo > 0.009 && p.status !== "cancelled" ? (
                  <p className="mt-2 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-warn">
                    Adelanto en contra del productor: {p.against_advances.numbers} por{" "}
                    {money(p.against_advances.balance)} (saldo a favor de Plein por una cuenta
                    complementaria negativa, sin salida de caja). Esta remisión sigue abierta al mismo
                    tiempo; el adelanto se recupera contra la siguiente liquidación.
                  </p>
                ) : null}
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
          title={`Cancelar factura ${cancelBill.number}`}
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
        <Modal title={`Pagar ${pago.number}`} onClose={() => setPago(null)}>
          <form className="grid gap-3" onSubmit={pagar}>
            {pago.currency === "MXN" ? (
              (() => {
                const pesos = Number(amount) || 0;
                const tc = parseFx(fxPaid);
                const ok = isFx(fxPaid) && pesos > 0;
                const cierra = pago.saldo_fx != null && pesos >= pago.saldo_fx - 0.005;
                const aplicado = cierra ? pago.saldo : pago.fx_agreed ? Math.min(pesos / pago.fx_agreed, pago.saldo) : 0;
                const caja = ok ? pesos / (tc as number) : 0;
                const dif = aplicado - caja;
                return (
                  <>
                    <p className="text-sm text-muted">
                      Pactada en pesos al {fxLabel(pago.fx_agreed)}. Debes {moneyMxn(pago.saldo_fx)} ({money(pago.saldo)}).
                    </p>
                    <Field label="Pesos paid">
                      <Input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </Field>
                    <Field label="Exchange rate at payment">
                      <Input required placeholder={t("Pesos per dollar")} value={fxPaid} onChange={(e) => setFxPaid(e.target.value)} />
                    </Field>
                    <div className="rounded-md border border-border bg-surface-2 p-3 text-sm tabular-nums">
                      {ok ? (
                        <>
                          <div className="flex justify-between"><span>{t("Applied to the bill")}</span><span>{money(aplicado)}</span></div>
                          <div className="flex justify-between"><span>{t("Out of Chase")}</span><span>{money(caja)}</span></div>
                          <div className={`mt-1 flex justify-between border-t border-border pt-1 font-medium ${dif >= 0 ? "text-ok" : "text-danger"}`}>
                            <span>{dif >= 0 ? t("Exchange gain") : t("Exchange loss")}</span>
                            <span>{money(Math.abs(dif))}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">
                          Captura los pesos y el tipo de cambio que aparece en tu estado de cuenta de Chase.
                        </span>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <>
                <p className="text-sm text-muted">Saldo {money(pago.saldo)}</p>
                <Field label="Amount">
                  <Input required type="number" min="0.01" step="0.01" max={pago.saldo} value={amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
              </>
            )}
            <Field label="Payment date">
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference">
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={t("Check # / deposit")} />
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
            <Field label="Payment date">
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </Field>
            <Field label="Method">
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Reference">
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder={t("Check # / deposit")} />
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
