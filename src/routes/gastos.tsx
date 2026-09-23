import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarSplit, Drawer, Modal, TabActions } from "@/components/app-shell";
import { AgingTable, groupAging } from "@/components/aging-table";
import { isFx, originalLabel, parseFx } from "@/lib/fx";
import { ConceptSelect } from "@/components/concepts";
import { FilterField, FilterRow } from "@/components/product-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { poShort } from "@/lib/nav";
import {
  cancelExpense,
  connectExpensePo,
  createExpense,
  disconnectExpensePo,
  setExpenseSplit,
  listExpenseLinks,
  listExpenses,
  listPayables,
  listPurchaseOrders,
  listSuppliers,
  listVendorPayments,
  registerVendorPayment,
  updateExpense,
  type PayableRow,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { agingBucket, agingByDue, errorMessage, fecha, money, PAY_METHODS, qty, todayISO } from "@/lib/utils";

type Search = { tab?: string; expense?: number };
export const Route = createFileRoute("/gastos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "overview",
    expense: Number(s.expense) > 0 ? Number(s.expense) : undefined,
  }),
  component: Page,
});

function Page() {
  const t = useT();
  const { tab, expense } = Route.useSearch();
  const payables = useAsync(() => listPayables(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const pos = useAsync(() => listPurchaseOrders(), []);
  const payments = useAsync(() => listVendorPayments(), []);
  const [vendor, setVendor] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  // Permite llegar directo al gasto desde "Corregir" en el detalle de la OC.
  const [detailId, setDetailId] = useState<number | null>(expense ?? null);
  const [payOpen, setPayOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connectFor, setConnectFor] = useState<number | null>(null);
  // Sube cuando se liga una carga nueva: obliga al detalle a releer sus ligas
  // antes de que "Guardar reparto" mande el conjunto completo.
  const [linksVersion, setLinksVersion] = useState(0);
  // Los cancelados salen de la CxP pero siguen consultables como rastro.
  const allExpenses = useAsync(() => listExpenses(), []);
  const [showCancelled, setShowCancelled] = useState(false);
  const cancelled = (allExpenses.data ?? []).filter((e) => e.cancelled_at);

  const rows = (payables.data ?? []).filter((r) => {
    if (vendor && String(r.supplier_id) !== vendor) return false;
    if (status === "unpaid" && r.saldo <= 0) return false;
    if (status === "paid" && r.saldo > 0) return false;
    return true;
  });

  const kpis = useMemo(() => {
    const all = rows;
    const total = all.reduce((s, r) => s + r.amount, 0);
    const unpaid = all.reduce((s, r) => s + r.saldo, 0);
    const paid = total - unpaid;
    // Hallazgo 51: todo por FECHA COMPROMISO, y lo que no la trae se cuenta
    // aparte en `sinPlazo`. Meterlo en "corriente" hacía que un gasto sin
    // plazo capturado se viera al día para siempre.
    const buckets = { current: 0, d1: 0, d8: 0, d15: 0, d22: 0 };
    let sinPlazo = 0;
    for (const r of all) {
      if (r.saldo <= 0) continue;
      if (!r.due_date) {
        sinPlazo += r.saldo;
        continue;
      }
      buckets[agingBucket(r.due_date)] += r.saldo;
    }
    return { total, unpaid, paid, buckets, sinPlazo };
  }, [rows]);

  function keyOf(r: PayableRow) {
    return `${r.kind}-${r.id}`;
  }

  if (tab === "credits") {
    return (
      <div className="p-5 text-sm text-muted">
        {t("Vendor credits appear when a return or overpayment is recorded. Apply them from")}{" "}
        <button type="button" className="text-link" onClick={() => setPayOpen(true)}>
          {t("Pay vendor → Apply credit")}
        </button>
        .
        {payOpen ? (
          <VendorPayModal
            rows={payables.data ?? []}
            suppliers={suppliers.data ?? []}
            onClose={() => setPayOpen(false)}
            onSaved={() => {
              setPayOpen(false);
              void payables.reload();
              void payments.reload();
            }}
            initialTab="credit"
          />
        ) : null}
      </div>
    );
  }

  if (tab === "aging") {
    // Hallazgo 51: se mide por fecha compromiso, no por fecha de emisión. El
    // servidor ya mandaba el vencimiento y esta pantalla lo ignoraba.
    return (
      <AgingTable
        header="Vendor name"
        groups={groupAging<PayableRow>(rows, (r) => r.supplier_name ?? "—")}
        note={t(
          "Each vendor’s POs and expenses based on what you owe that is within terms (current) and then what is overdue. Paid transactions are excluded.",
        )}
      />
    );
  }

  if (tab === "overview") {
    return (
      <div className="p-5">
        <TabActions>
          <Button size="sm" onClick={() => setOpen(true)}>
            +
          </Button>
        </TabActions>
        <FilterRow>
          <FilterField label="From / To">
            <Input type="date" defaultValue={todayISO()} />
          </FilterField>
        </FilterRow>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">{t("Total expenses")}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-action">{money(kpis.total)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">{t("Paid status")}</p>
            <div className="mt-4">
              <BarSplit left={kpis.paid} right={kpis.unpaid} leftLabel="Paid" rightLabel="Unpaid" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">{t("Unpaid")}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-warn">{money(kpis.unpaid)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">{t("Aging breakdown")}</p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-surface-2">
              <div className="bg-ok" style={{ width: `${kpis.unpaid ? (kpis.buckets.current / kpis.unpaid) * 100 : 0}%` }} />
              <div className="bg-warn" style={{ flex: 1 }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-ok">{t("Current")} {money(kpis.buckets.current)}</span>
              <span className="text-warn">
                {t("Overdue")} {money(kpis.unpaid - kpis.buckets.current - kpis.sinPlazo)}
              </span>
              {kpis.sinPlazo > 0.009 ? (
                <span className="col-span-2 text-muted">
                  {t("No terms")} {money(kpis.sinPlazo)} — falta capturar su vencimiento
                </span>
              ) : null}
              <span className="text-xs text-muted">{t("1-7 days")} {money(kpis.buckets.d1)}</span>
              <span className="text-xs text-muted">{t("8-14 days")} {money(kpis.buckets.d8)}</span>
              <span className="text-xs text-muted">{t("15-21 days")} {money(kpis.buckets.d15)}</span>
              <span className="text-xs text-muted">{t("22+ days")} {money(kpis.buckets.d22)}</span>
            </div>
          </div>
        </div>
        {open ? (
          <CreateExpenseDrawer
            suppliers={suppliers.data ?? []}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              void payables.reload();
            }}
          />
        ) : null}
      </div>
    );
  }

  if (tab === "payments") {
    const movs = payments.data ?? [];
    return (
      <div>
        <TabActions>
          <Button size="sm" onClick={() => setPayOpen(true)}>
            {t("Pay vendor")}
          </Button>
        </TabActions>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          <KpiMini label="Payments" value={money(movs.reduce((s, m) => s + m.amount, 0))} />
          <KpiMini label="Terms accounts" value={money(0)} />
          <KpiMini label="Cash accounts" value={money(movs.reduce((s, m) => s + m.amount, 0))} />
          <KpiMini label="Paid via ACH" value={money(movs.filter((m) => !m.cancelled_at && m.method === "ACH").reduce((s, m) => s + m.amount, 0))} />
          <KpiMini label="Paid via other" value={money(movs.filter((m) => !m.cancelled_at && m.method !== "ACH").reduce((s, m) => s + m.amount, 0))} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                <th className="px-3 py-2">{t("Payment date")}</th>
                <th className="px-3 py-2">{t("Vendor")}</th>
                <th className="px-3 py-2 text-right">{t("Total amount")}</th>
                <th className="px-3 py-2">{t("Method")}</th>
                <th className="px-3 py-2">{t("Notes")}</th>
                <th className="px-3 py-2">{t("Payment ID")}</th>
              </tr>
            </thead>
            <tbody>
              {movs.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-muted" colSpan={6}>
                    {t("No vendor payments yet. Use Pay vendor to record ACH, check, or cash.")}
                  </td>
                </tr>
              ) : (
                movs.map((m) => (
                  <tr key={m.id} className="border-b border-border">
                    <td className="px-3 py-2">{fecha(m.mov_date)}</td>
                    <td className="px-3 py-2">{m.counterparty}</td>
                    <td className="px-3 py-2 text-right">{money(m.amount)}</td>
                    <td className="px-3 py-2">{m.method || "—"}</td>
                    <td className="px-3 py-2 text-muted">{[m.reference, m.notes].filter(Boolean).join(" · ")}</td>
                    <td className="px-3 py-2 font-mono text-xs text-link">{m.folio.replace(/\D/g, "") || m.id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {payOpen ? (
          <VendorPayModal
            rows={payables.data ?? []}
            suppliers={suppliers.data ?? []}
            onClose={() => setPayOpen(false)}
            onSaved={() => {
              setPayOpen(false);
              void payables.reload();
              void payments.reload();
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <TabActions>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setPayOpen(true)}>
            {t("Pay vendor")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {t("+ Add new expense")}
          </Button>
        </div>
      </TabActions>
      <FilterRow>
        <FilterField label="Vendor">
          <Select value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">{t("Search your vendors")}</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Payment statuses">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("All payment statuses")}</option>
            <option value="unpaid">{t("Unpaid")}</option>
            <option value="paid">{t("Paid")}</option>
          </Select>
        </FilterField>
      </FilterRow>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <KpiMini label="Total expenses" value={money(kpis.total)} />
        <KpiMini label="Total balance" value={money(kpis.unpaid)} />
        <KpiMini label="Total expenses cash" value={money(kpis.total)} />
        <KpiMini label="Total expenses terms accounts" value={money(0)} tone="warn" />
      </div>
      <div className="px-4 pb-2 text-sm text-muted">
        {t("Below you can find all expenses. Select any to export to CSV.")}{" "}
        <button type="button" className="rounded-md border border-border px-2 py-1 text-fg">
          {t("Export expenses")}
        </button>
        {cancelled.length ? (
          <button type="button" className="ml-2 text-link" onClick={() => setShowCancelled((v) => !v)}>
            {showCancelled ? "Ocultar" : "Ver"} {cancelled.length} cancelado{cancelled.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(rows.map(keyOf)));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="px-3 py-2">{t("PO # / Exp #")}</th>
              <th className="px-3 py-2">{t("Inv #")}</th>
              <th className="px-3 py-2">{t("Category")}</th>
              <th className="px-3 py-2">{t("Vendor")}</th>
              <th className="px-3 py-2">{t("Reqs. date")}</th>
              <th className="px-3 py-2">{t("Due date")}</th>
              <th className="px-3 py-2 text-right">{t("Total amount")}</th>
              <th className="px-3 py-2 text-right">{t("Remaining balance")}</th>
              <th className="px-3 py-2">{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const k = keyOf(e);
              const label = e.number.replace(/^EXP-/, "EXP #");
              return (
                <tr key={k} className="border-b border-border bg-surface">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(k)}
                      onChange={(ev) => {
                        const next = new Set(selected);
                        if (ev.target.checked) next.add(k);
                        else next.delete(k);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button type="button" className="text-warn" onClick={() => setDetailId(e.id)}>
                      {label}
                    </button>
                  </td>
                  <td className="px-3 py-2">{e.invoice_number || "—"}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2">{e.supplier_name}</td>
                  <td className="px-3 py-2">{fecha(e.issue_date)}</td>
                  <td className="px-3 py-2">{fecha(e.due_date)}</td>
                  <td className="px-3 py-2 text-right">
                    {money(e.amount)}
                    {e.currency === "MXN" ? (
                      <div className="text-xs text-muted">{originalLabel({ currency: e.currency, amount_fx: e.amount_fx, fx: e.fx_rate })}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{money(e.saldo)}</td>
                  <td className="px-3 py-2">
                    <Badge tone={e.saldo > 0 ? "unpaid" : "ok"}>{e.status}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCancelled && cancelled.length ? (
        <div className="px-4 pb-4">
          <p className="mb-2 mt-4 text-sm font-semibold text-muted">Gastos cancelados</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Exp #</th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2">Cancelado</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {cancelled.map((e) => (
                  <tr key={e.id} className="border-t border-border text-muted">
                    <td className="px-3 py-2">{String(e.expense_number).replace(/^EXP-/, "EXP #")}</td>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2">{e.supplier_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums line-through">{money(e.amount)}</td>
                    <td className="px-3 py-2">{e.cancelled_at ? fecha(e.cancelled_at) : "—"}</td>
                    <td className="px-3 py-2">{e.cancel_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {open ? (
        <CreateExpenseDrawer
          suppliers={suppliers.data ?? []}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void payables.reload();
          }}
        />
      ) : null}
      {payOpen ? (
        <VendorPayModal
          rows={payables.data ?? []}
          suppliers={suppliers.data ?? []}
          onClose={() => setPayOpen(false)}
          onSaved={() => {
            setPayOpen(false);
            void payables.reload();
            void payments.reload();
          }}
        />
      ) : null}
      {detailId ? (
        <ExpenseDetail
          id={detailId}
          linksVersion={linksVersion}
          pos={pos.data ?? []}
          suppliers={suppliers.data ?? []}
          onClose={() => setDetailId(null)}
          onConnect={() => setConnectFor(detailId)}
          onChanged={() => {
            void payables.reload();
            void pos.reload();
            void allExpenses.reload();
          }}
        />
      ) : null}
      {connectFor ? (
        <ConnectPo
          expenseId={connectFor}
          pos={pos.data ?? []}
          onClose={() => setConnectFor(null)}
          onDone={() => {
            setConnectFor(null);
            void payables.reload();
            // El detalle tiene que releer sus ligas: "Guardar reparto" manda el
            // conjunto COMPLETO y borraría la carga recién conectada.
            setLinksVersion((v) => v + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  const t = useT();
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="label-caps">{t(label)}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === "warn" ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}

function CreateExpenseDrawer({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: { id: number; name: string; currency?: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    // Antes arrancaba en "Materia prima" — el concepto que JUSTAMENTE no debe
    // usarse como gasto (el costo de la fruta viene de la orden de compra).
    // Cada gasto guardado sin cambiarlo lo mandaba al cajón. Misma regla que
    // el resto de la captura: en blanco es honesto.
    category: "",
    date: todayISO(),
    amount: "",
    payable: true,
    supplier_id: "",
    invoice: "",
    due: "",
    // Peso–dólar A: la moneda arranca en dólares (la de los libros) y cambia
    // a pesos con el default del proveedor o a mano. El TC nunca se precarga.
    currency: "USD",
    fx_rate: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (form.payable && !form.supplier_id) {
      setErr(t("Payable expenses must have a vendor selected"));
      return;
    }
    if (!form.supplier_id) {
      setErr(t("Select a vendor"));
      return;
    }
    setSaving(true);
    try {
      await createExpense({
        data: {
          category: form.category,
          supplier_id: Number(form.supplier_id),
          amount: Number(form.amount),
          invoice_number: form.invoice || undefined,
          payable: form.payable,
          // Hallazgo 19: antes este campo se capturaba y se tiraba.
          issue_date: form.date || undefined,
          // Hallazgo 51: la fecha compromiso. En blanco = sin plazo, que es lo
          // honesto mientras la factura del proveedor no llegue.
          due_date: form.due || undefined,
          currency: form.currency === "MXN" ? "MXN" : "USD",
          fx_rate: form.currency === "MXN" ? parseFx(form.fx_rate) : undefined,
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Could not create"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title={t("Create Expense")}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button disabled={saving || !form.amount} onClick={() => void submit()}>
            {t("Create expense")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type *">
          <ConceptSelect kind="gasto" value={form.category} onChange={(category) => setForm({ ...form, category })} />
        </Field>
        <Field label="Fecha del gasto">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Amount">
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
        </Field>
        <Field label="Currency">
          <Select
            value={form.currency}
            onChange={(e) => {
              const currency = e.target.value;
              if (currency === form.currency) return;
              // El monto escrito en una moneda no se reinterpreta en la otra.
              setForm({ ...form, currency, amount: "" });
            }}
          >
            <option value="USD">{t("Dollars")}</option>
            <option value="MXN">{t("Pesos")}</option>
          </Select>
        </Field>
        {form.currency === "MXN" ? (
          <div className="flex flex-col gap-1">
            <span className="label-caps">{t("Exchange rate")}</span>
            <Input
              placeholder={t("Pesos per dollar")}
              value={form.fx_rate}
              onChange={(e) => setForm({ ...form, fx_rate: e.target.value })}
            />
            <span className="text-xs text-muted">
              {isFx(form.fx_rate) && Number(form.amount) > 0
                ? `${t("In dollars")}: ${money(Number(form.amount) / (parseFx(form.fx_rate) as number))}`
                : "Sin tipo de cambio el gasto en pesos no se guarda."}
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">¿Ya se pagó este gasto?</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" className="mt-1" checked={form.payable} onChange={() => setForm({ ...form, payable: true })} />
          <span>
            <strong>Por pagar</strong>
            <span className="block text-xs text-muted">Todavía se le debe al proveedor — aparece en Cuentas por pagar.</span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" className="mt-1" checked={!form.payable} onChange={() => setForm({ ...form, payable: false })} />
          <span>
            <strong>Ya pagado</strong>
            <span className="block text-xs text-muted">Se pagó en el momento (efectivo/tarjeta) — no genera CxP.</span>
          </span>
        </label>
      </div>
      {form.payable ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Vendor">
            <Select
              value={form.supplier_id}
              onChange={(e) => {
                const supplier_id = e.target.value;
                const sup = suppliers.find((x) => String(x.id) === supplier_id);
                // Default de moneda del proveedor, editable en el gasto. Si
                // cambia la moneda, el monto ya escrito se vuelve a capturar.
                const currency = sup?.currency ?? form.currency;
                setForm({ ...form, supplier_id, currency, amount: currency === form.currency ? form.amount : "" });
              }}
            >
              <option value="">{t("Search vendors")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice #">
            <Input value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} />
          </Field>
          <div className="flex flex-col gap-1">
            <span className="label-caps">{t("Due date")}</span>
            <Input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            <span className="text-xs text-muted">
              Si aún no llega la factura del proveedor, déjalo en blanco: queda "sin plazo", no vencido.
            </span>
          </div>
          <Field label="Liability account">
            <Select defaultValue="20100">
              <option value="20100">20100 {t("Accounts Payable")}</option>
            </Select>
          </Field>
        </div>
      ) : (
        <div className="mt-4">
          <Field label="Vendor">
            <Select
              value={form.supplier_id}
              onChange={(e) => {
                const supplier_id = e.target.value;
                const sup = suppliers.find((x) => String(x.id) === supplier_id);
                // Default de moneda del proveedor, editable en el gasto. Si
                // cambia la moneda, el monto ya escrito se vuelve a capturar.
                const currency = sup?.currency ?? form.currency;
                setForm({ ...form, supplier_id, currency, amount: currency === form.currency ? form.amount : "" });
              }}
            >
              <option value="">{t("Search vendors")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
    </Drawer>
  );
}

function ExpenseDetail({
  id,
  linksVersion,
  pos,
  suppliers,
  onClose,
  onConnect,
  onChanged,
}: {
  id: number;
  linksVersion: number;
  pos: { id: number; po_number: string }[];
  suppliers: { id: number; name: string; currency?: string | null }[];
  onClose: () => void;
  onConnect: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const detail = useAsync(() => listExpenseLinks({ data: { expense_id: id } }), [id, linksVersion]);
  const d = detail.data;
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<{
    category: string;
    supplier_id: string;
    amount: string;
    invoice: string;
    notes: string;
    payable: boolean;
    charged_to: string;
    date: string;
    due: string;
    currency: string;
    fx_rate: string;
  } | null>(null);

  function startEdit() {
    if (!d) return;
    setErr(null);
    setForm({
      category: d.category,
      supplier_id: String(d.supplier_id),
      // Peso–dólar A: un gasto en pesos se edita en pesos (su original), no en
      // el dólar derivado. Si no se toca, el servidor conserva el dólar guardado.
      amount: String(d.currency === "MXN" && d.amount_fx != null ? d.amount_fx : d.amount),
      invoice: d.invoice_number || "",
      notes: d.notes || "",
      payable: !!d.payable,
      charged_to: d.charged_to || "plein",
      date: d.issue_date ? String(d.issue_date).slice(0, 10) : "",
      due: d.due_date ? String(d.due_date).slice(0, 10) : "",
      currency: d.currency ?? "USD",
      fx_rate: d.fx_rate != null ? String(d.fx_rate) : "",
    });
    setEditing(true);
  }

  async function disconnect(poId: number) {
    setErr(null);
    try {
      await disconnectExpensePo({ data: { expense_id: id, purchase_order_id: poId } });
      setSplit(null);
      await detail.reload();
      onChanged();
    } catch (e) {
      setErr(errorMessage(e, "No se pudo desconectar la carga."));
    }
  }

  // Hallazgo 14: el reparto del gasto entre las cargas que lo generaron.
  // Se propone por cajas recibidas y se puede ajustar; lo que no se reparta
  // lo absorbe Plein y se dice en pantalla. Lo ya rendido no se toca.
  const [split, setSplit] = useState<Record<number, string> | null>(null);
  const [savingSplit, setSavingSplit] = useState(false);
  const links = d?.links ?? [];
  const splitFor = (poId: number) => {
    const link = links.find((l) => l.purchase_order_id === poId);
    // Congelado: ni la propuesta ni un tecleo lo mueven.
    if (link?.rendered_in) return String(link.amount_applied);
    return split?.[poId] ?? String(link?.amount_applied ?? 0);
  };
  const splitTotal = links.reduce((s, l) => s + (Number(splitFor(l.purchase_order_id)) || 0), 0);
  const splitOver = d ? splitTotal > d.amount + 0.009 : false;
  const splitDirty = split != null;

  // Lo ya rendido a un productor no entra en la propuesta: ese monto está
  // congelado en su documento. Se reparte solo lo que queda entre las cargas
  // que todavía se pueden tocar.
  function proposeSplit() {
    if (!d) return;
    const libres = links.filter((l) => !l.rendered_in);
    if (!libres.length) return;
    const congelado = links
      .filter((l) => l.rendered_in)
      .reduce((s, l) => s + l.amount_applied, 0);
    const porRepartir = Math.max(Math.round((d.amount - congelado) * 100), 0);
    const base = libres.reduce((s, l) => s + (l.received_qty || 0), 0);
    const next: Record<number, string> = {};
    let leftCents = porRepartir;
    libres.forEach((l, i) => {
      const cents =
        i === libres.length - 1
          ? leftCents
          : base > 0
            ? Math.round(porRepartir * ((l.received_qty || 0) / base))
            : Math.round(porRepartir / libres.length);
      next[l.purchase_order_id] = String(Math.max(0, cents) / 100);
      leftCents -= cents;
    });
    setSplit(next);
  }

  async function saveSplit() {
    if (!d) return;
    setSavingSplit(true);
    setErr(null);
    try {
      await setExpenseSplit({
        data: {
          expense_id: id,
          rows: links.map((l) => ({
            purchase_order_id: l.purchase_order_id,
            amount: Number(splitFor(l.purchase_order_id)) || 0,
          })),
        },
      });
      setSplit(null);
      await detail.reload();
      onChanged();
    } catch (e) {
      setErr(errorMessage(e, "No se pudo guardar el reparto."));
    } finally {
      setSavingSplit(false);
    }
  }

  async function saveEdit() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    try {
      await updateExpense({
        data: {
          expense_id: id,
          category: form.category,
          supplier_id: Number(form.supplier_id),
          amount: Number(form.amount),
          invoice_number: form.invoice || undefined,
          notes: form.notes || undefined,
          payable: form.payable,
          charged_to: form.charged_to as "grower" | "plein",
          issue_date: form.date || undefined,
          // Hallazgo 51: `null` explícito lo deja "sin plazo" a propósito.
          due_date: form.due || null,
          currency: form.currency === "MXN" ? "MXN" : "USD",
          fx_rate: form.currency === "MXN" ? parseFx(form.fx_rate) : undefined,
        },
      });
      setEditing(false);
      await detail.reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr("Escribe el motivo de la cancelación.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await cancelExpense({ data: { expense_id: id, reason: trimmed } });
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo cancelar");
      setBusy(false);
    }
  }
  return (
    <Modal title={t("Expense Details")} onClose={onClose} wide>
      {d ? (
        <div>
          <h3 className="text-lg font-semibold">{d.category}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="label-caps">{t("Expense #")}</p>
              <p>{d.expense_number.replace(/^EXP-/, "")}</p>
            </div>
            <div>
              <p className="label-caps">{t("Invoice #")}</p>
              <p>{d.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="label-caps">{t("Vendor")}</p>
              <p>{d.supplier_name}</p>
            </div>
            <div>
              <p className="label-caps">{t("Requested date")}</p>
              <p>{fecha(d.issue_date)}</p>
            </div>
            <div>
              <p className="label-caps">{t("Payable")}</p>
              <p>{d.payable ? t("Yes") : t("No")}</p>
            </div>
            <div>
              <p className="label-caps">{t("Amount")}</p>
              <p>{money(d.amount)}</p>
              {d.currency === "MXN" ? (
                <p className="text-xs text-muted">{originalLabel({ currency: d.currency, amount_fx: d.amount_fx, fx: d.fx_rate })}</p>
              ) : null}
            </div>
            <div>
              <p className="label-caps">{t("Distribution type")}</p>
              <p>{t("Auto distributed by pallet")}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Reparto entre cargas</p>
            {links.length > 1 ? (
              <button type="button" className="cursor-pointer text-xs text-link" onClick={proposeSplit}>
                Proponer por cajas recibidas
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            Lo que se le descuenta al productor de cada carga es lo que pongas aquí. Lo que no
            repartas lo absorbe Plein.
          </p>
          <div className="mt-2 grid gap-2">
            {links.map((l) => (
              <div key={l.purchase_order_id} className="flex items-stretch overflow-hidden rounded-md border border-border">
                <div className="w-1.5 bg-primary" />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium text-ok">
                      {t("PO #")}{poShort(l.po_number)}
                    </p>
                    <p className="text-xs text-muted">
                      {fecha(l.order_date)} · {l.supplier_name}
                      {l.received_qty
                        ? ` · ${qty(l.received_qty, l.received_qty === 1 ? "caja" : "cajas")} recibidas`
                        : ""}
                    </p>
                    {l.product_name ? <p className="text-xs">{l.product_name}</p> : null}
                    {l.rendered_in ? (
                      <p className="text-xs text-warn">
                        Ya rendido al productor en {l.rendered_in} — esta parte no se cambia
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {l.rendered_in ? (
                      <p className="tabular-nums">{money(l.amount_applied)}</p>
                    ) : (
                      <Input
                        className="w-28 text-right"
                        value={splitFor(l.purchase_order_id)}
                        onChange={(e) =>
                          setSplit({ ...(split ?? {}), [l.purchase_order_id]: e.target.value })
                        }
                      />
                    )}
                    {l.rendered_in ? null : (
                      <Button size="sm" variant="outline" onClick={() => void disconnect(l.purchase_order_id)}>
                        {t("Disconnect")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {links.length === 0 ? (
              <p className="text-sm text-muted">
                Este gasto no está ligado a ninguna carga: lo absorbe Plein completo.
              </p>
            ) : null}
          </div>
          {links.length ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className={splitOver ? "text-danger" : "text-muted"}>
                Repartido {money(splitTotal)} de {money(d.amount)}
                {splitOver
                  ? " — no se les puede cobrar a las cargas más de lo que costó el gasto"
                  : splitTotal < d.amount - 0.009
                    ? ` · los ${money(d.amount - splitTotal)} restantes los absorbe Plein`
                    : ""}
              </p>
              {splitDirty ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSplit(null)}>
                    {t("Cancel")}
                  </Button>
                  <Button size="sm" disabled={savingSplit || splitOver} onClick={() => void saveSplit()}>
                    {savingSplit ? "Guardando…" : "Guardar reparto"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}

          {editing && form ? (
            <div className="mt-4 rounded-md border border-border p-3">
              <p className="mb-3 text-sm font-semibold">Corregir gasto</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Concepto">
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </Field>
                <Field label="Proveedor">
                  <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={form.currency === "MXN" ? "Monto en pesos" : "Monto"}>
                  <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </Field>
                <Field label="Currency">
                  <Select
                    value={form.currency}
                    onChange={(e) => {
                      const currency = e.target.value;
                      if (currency === form.currency) return;
                      // El monto precargado está en la moneda anterior: se
                      // limpia para volver a capturarlo, nunca se reinterpreta.
                      setForm({ ...form, currency, amount: "", fx_rate: currency === "MXN" ? form.fx_rate : "" });
                    }}
                  >
                    <option value="USD">{t("Dollars")}</option>
                    <option value="MXN">{t("Pesos")}</option>
                  </Select>
                </Field>
                {form.currency === "MXN" ? (
                  <Field label="Exchange rate">
                    <Input placeholder={t("Pesos per dollar")} value={form.fx_rate} onChange={(e) => setForm({ ...form, fx_rate: e.target.value })} />
                  </Field>
                ) : null}
                <Field label="Fecha del gasto">
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
                <Field label="Due date">
                  <Input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
                </Field>
                <Field label="Invoice #">
                  <Input value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} />
                </Field>
                <Field label="¿Ya se pagó este gasto?">
                  <div className="flex gap-4 text-sm">
                    <label className="flex cursor-pointer items-center gap-1">
                      <input type="radio" checked={form.payable} onChange={() => setForm({ ...form, payable: true })} /> Por pagar
                    </label>
                    <label className="flex cursor-pointer items-center gap-1">
                      <input type="radio" checked={!form.payable} onChange={() => setForm({ ...form, payable: false })} /> Ya pagado
                    </label>
                  </div>
                </Field>
                <Field label="Lo paga">
                  <Select value={form.charged_to} onChange={(e) => setForm({ ...form, charged_to: e.target.value })}>
                    <option value="plein">Plein</option>
                    <option value="grower">Productor</option>
                  </Select>
                </Field>
              </div>
              <Field label="Notas" className="mt-3">
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </Field>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setEditing(false)}>
                  Descartar
                </Button>
                <Button disabled={busy} onClick={() => void saveEdit()}>
                  {busy ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          ) : null}

          {cancelling ? (
            <div className="mt-4 rounded-md border border-danger/40 bg-danger/5 p-3">
              <p className="text-sm font-semibold text-danger">Cancelar {d.expense_number}</p>
              <p className="mt-1 text-xs text-muted">
                Se suelta la CxP y el prorrateo a los lotes. Si ya se había pagado, entra un movimiento de caja inverso.
                El gasto queda visible como cancelado con el motivo.
              </p>
              <Field label="Motivo *" className="mt-2">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. capturado por error" />
              </Field>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" disabled={busy} onClick={() => setCancelling(false)}>
                  No, regresar
                </Button>
                <Button disabled={busy} onClick={() => void doCancel()}>
                  {busy ? "Cancelando…" : "Sí, cancelar gasto"}
                </Button>
              </div>
            </div>
          ) : null}

          {d.cancelled_at ? (
            <p className="mt-4 rounded-md border border-border bg-surface-2 p-2 text-xs text-muted">
              Cancelado el {fecha(d.cancelled_at)} — {d.cancel_reason}
            </p>
          ) : (
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={onConnect}>
                {t("Connect additional POs")}
              </Button>
              {!cancelling ? (
                <Button variant="outline" onClick={() => { setErr(null); setCancelling(true); }}>
                  Cancelar gasto
                </Button>
              ) : null}
              {!editing ? <Button onClick={startEdit}>{t("Edit expense")}</Button> : null}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("Loading…")}</p>
      )}
      {pos.length ? null : null}
    </Modal>
  );
}

function ConnectPo({
  expenseId,
  pos,
  onClose,
  onDone,
}: {
  expenseId: number;
  pos: { id: number; po_number: string; supplier_name: string; status: string; order_date: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const filtered = pos.filter((p) => !q || p.po_number.includes(q) || poShort(p.po_number).includes(q));
  return (
    <Modal title={t("Connect to Expense")} onClose={onClose} wide>
      <Field label="Search by PO #">
        <Input value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <p className="mt-4 text-sm font-medium">{t("Select POs to connect to your expense")}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase text-muted">
            <tr>
              <th className="px-2 py-2">{t("PO #")}</th>
              <th className="px-2 py-2">{t("Status")}</th>
              <th className="px-2 py-2">{t("Vendor")}</th>
              <th className="px-2 py-2">{t("Requested date")}</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-2 py-2">{poShort(p.po_number)}</td>
                <td className="px-2 py-2">{p.status}</td>
                <td className="px-2 py-2">{p.supplier_name}</td>
                <td className="px-2 py-2">{fecha(p.order_date)}</td>
                <td className="px-2 py-2 text-right">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await connectExpensePo({ data: { expense_id: expenseId, purchase_order_id: p.id } });
                      onDone();
                    }}
                  >
                    {t("Connect")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" className="mt-4" onClick={onClose}>
        {t("Back to detail")}
      </Button>
    </Modal>
  );
}

function VendorPayModal({
  rows,
  suppliers,
  onClose,
  onSaved,
  initialTab = "manual",
}: {
  rows: PayableRow[];
  suppliers: { id: number; name: string; currency?: string | null }[];
  onClose: () => void;
  onSaved: () => void;
  initialTab?: "manual" | "credit";
}) {
  const t = useT();
  const [tab, setTab] = useState<"manual" | "credit">(initialTab);
  const unpaidVendors = [...new Set(rows.filter((r) => r.saldo > 0).map((r) => r.supplier_id))];
  const [vendorId, setVendorId] = useState(String(unpaidVendors[0] ?? suppliers[0]?.id ?? ""));
  const vendorRows = rows.filter((r) => String(r.supplier_id) === vendorId);
  const openRows = vendorRows.filter((r) => r.saldo > 0.009);
  const [checks, setChecks] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("ACH");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const applied = Object.values(checks).reduce((s, n) => s + n, 0);
  const due = openRows.reduce((s, r) => s + r.saldo, 0);
  // Vencido = pasó su fecha compromiso. Lo que no tiene plazo capturado NO se
  // cuenta como vencido (hallazgo 51): faltaba el dato, no el pago.
  const overdue = openRows
    .filter((r) => !["current", "no_terms"].includes(agingByDue(r.due_date)))
    .reduce((s, r) => s + r.saldo, 0);

  async function submit() {
    const apps = Object.entries(checks)
      .filter(([, amt]) => amt > 0)
      .map(([k, amount]) => {
        const [kind, id] = k.split("-");
        return { kind: kind as "expense", id: Number(id), amount };
      });
    if (!apps.length) {
      setErr(t("Select at least one invoice"));
      return;
    }
    setSaving(true);
    try {
      await registerVendorPayment({
        data: {
          supplier_id: Number(vendorId),
          amount: applied,
          method,
          pay_date: date,
          reference: reference.trim() || undefined,
          notes: notes || undefined,
          applications: apps,
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Could not record"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("New Vendor Payment")} onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Vendor">
          <Select
            value={vendorId}
            onChange={(e) => {
              setVendorId(e.target.value);
              setChecks({});
            }}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <KpiMini label="Current" value={money(due - overdue)} />
        <KpiMini label="Past due" value={money(overdue)} tone="warn" />
        <KpiMini label="Future due" value={money(0)} />
        <KpiMini label="Total due" value={money(due)} />
      </div>
      <div className="mt-4 flex gap-4 border-b border-border text-sm">
        <button type="button" className={`pb-2 ${tab === "manual" ? "border-b-2 border-action font-medium" : "text-muted"}`} onClick={() => setTab("manual")}>
          {t("Record Manual Payment")}
        </button>
        <button type="button" className={`pb-2 ${tab === "credit" ? "border-b-2 border-action font-medium" : "text-muted"}`} onClick={() => setTab("credit")}>
          {t("Apply Credit")}
        </button>
      </div>
      {tab === "credit" ? (
        <p className="mt-6 text-sm text-muted">{t("No open vendor credits for this supplier. Overpayments create a credit automatically.")}</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="grid gap-3">
            <Field label="Payment amount">
              <Input value={String(applied || "")} readOnly />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t(m)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Payment date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Reference">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("Check # / deposit")} />
            </Field>
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[11px] uppercase text-muted">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">{t("PO / Exp #")}</th>
                  <th className="px-2 py-2">{t("Requested")}</th>
                  <th className="px-2 py-2 text-right">{t("Amount")}</th>
                  <th className="px-2 py-2">{t("Status")}</th>
                  <th className="px-2 py-2 text-right">{t("Amt to apply")}</th>
                </tr>
              </thead>
              <tbody>
                {openRows.map((r) => {
                  const k = `${r.kind}-${r.id}`;
                  const on = k in checks;
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            const next = { ...checks };
                            if (e.target.checked) next[k] = r.saldo;
                            else delete next[k];
                            setChecks(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-2">{r.number}</td>
                      <td className="px-2 py-2">{fecha(r.issue_date)}</td>
                      <td className="px-2 py-2 text-right">
                        {money(r.amount)}
                        {r.currency === "MXN" ? (
                          <div className="text-xs text-muted">{originalLabel({ currency: r.currency, amount_fx: r.amount_fx, fx: r.fx_rate })}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2">{r.status}</td>
                      <td className="px-2 py-2 text-right">
                        {on ? (
                          <Input
                            className="ml-auto w-24"
                            value={String(checks[k])}
                            onChange={(e) => setChecks({ ...checks, [k]: Number(e.target.value) || 0 })}
                          />
                        ) : (
                          money(0)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      <div className="mt-4 flex items-center justify-end gap-3">
        <p className="mr-auto text-sm text-muted">{t("Invoices selected")}: {Object.keys(checks).length}</p>
        <Button variant="outline" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button disabled={saving || applied <= 0} onClick={() => void submit()}>
          {t("Record payment")}
        </Button>
      </div>
    </Modal>
  );
}
