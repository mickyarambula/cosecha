import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarSplit, Drawer, Modal, TabActions } from "@/components/app-shell";
import { ConceptSelect } from "@/components/concepts";
import { FilterField, FilterRow } from "@/components/product-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { poShort } from "@/lib/nav";
import {
  connectExpensePo,
  createExpense,
  disconnectExpensePo,
  listExpenseLinks,
  listPayables,
  listPurchaseOrders,
  listSuppliers,
  listVendorPayments,
  registerVendorPayment,
  type PayableRow,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { aging30, agingBucket, fecha, money, PAY_METHODS, todayISO } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/gastos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "overview",
  }),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const payables = useAsync(() => listPayables(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const pos = useAsync(() => listPurchaseOrders(), []);
  const payments = useAsync(() => listVendorPayments(), []);
  const [vendor, setVendor] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connectFor, setConnectFor] = useState<number | null>(null);

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
    const buckets = { current: 0, d1: 0, d8: 0, d15: 0, d22: 0 };
    const aging = { current: 0, b30: 0, b60: 0, b90: 0, b91: 0 };
    for (const r of all) {
      if (r.saldo <= 0) continue;
      buckets[agingBucket(r.issue_date)] += r.saldo;
      aging[aging30(r.issue_date)] += r.saldo;
    }
    return { total, unpaid, paid, buckets, aging };
  }, [rows]);

  function keyOf(r: PayableRow) {
    return `${r.kind}-${r.id}`;
  }

  if (tab === "credits") {
    return (
      <div className="p-5 text-sm text-muted">
        Vendor credits appear when a return or overpayment is recorded. Apply them from{" "}
        <button type="button" className="text-link" onClick={() => setPayOpen(true)}>
          Pay vendor → Apply credit
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
    const byVendor = new Map<string, { current: number; b30: number; b60: number; b90: number; b91: number; total: number }>();
    for (const r of rows) {
      if (r.saldo <= 0) continue;
      const cur = byVendor.get(r.supplier_name) ?? { current: 0, b30: 0, b60: 0, b90: 0, b91: 0, total: 0 };
      cur[aging30(r.issue_date)] += r.saldo;
      cur.total += r.saldo;
      byVendor.set(r.supplier_name, cur);
    }
    const entries = [...byVendor.entries()];
    const tot = entries.reduce(
      (s, [, v]) => ({
        current: s.current + v.current,
        b30: s.b30 + v.b30,
        b60: s.b60 + v.b60,
        b90: s.b90 + v.b90,
        b91: s.b91 + v.b91,
        total: s.total + v.total,
      }),
      { current: 0, b30: 0, b60: 0, b90: 0, b91: 0, total: 0 },
    );
    return (
      <div>
        <p className="px-5 pt-4 text-sm text-muted">
          Each vendor’s POs and expenses based on what you owe that is within terms (current) and then what is overdue. Paid
          transactions are excluded.
        </p>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Vendor name</th>
                <th className="px-3 py-2 text-right">Current</th>
                <th className="px-3 py-2 text-right">1-30</th>
                <th className="px-3 py-2 text-right">31-60</th>
                <th className="px-3 py-2 text-right">61-90</th>
                <th className="px-3 py-2 text-right">91+</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([name, v]) => (
                <tr key={name} className="border-b border-border">
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 text-right text-link">{money(v.current)}</td>
                  <td className="px-3 py-2 text-right text-link">{money(v.b30)}</td>
                  <td className="px-3 py-2 text-right text-link">{money(v.b60)}</td>
                  <td className="px-3 py-2 text-right text-link">{money(v.b90)}</td>
                  <td className="px-3 py-2 text-right text-link">{money(v.b91)}</td>
                  <td className="px-3 py-2 text-right">{money(v.total)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2 font-semibold">
                <td className="px-3 py-2">Totals</td>
                <td className="px-3 py-2 text-right">{money(tot.current)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b30)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b60)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b90)}</td>
                <td className="px-3 py-2 text-right">{money(tot.b91)}</td>
                <td className="px-3 py-2 text-right">{money(tot.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
            <p className="label-caps">Total expenses</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-action">{money(kpis.total)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">Paid status</p>
            <div className="mt-4">
              <BarSplit left={kpis.paid} right={kpis.unpaid} leftLabel="Paid" rightLabel="Unpaid" />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">Unpaid</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-warn">{money(kpis.unpaid)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-5">
            <p className="label-caps">Aging breakdown</p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-surface-2">
              <div className="bg-ok" style={{ width: `${kpis.unpaid ? (kpis.buckets.current / kpis.unpaid) * 100 : 0}%` }} />
              <div className="bg-warn" style={{ flex: 1 }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-ok">Current {money(kpis.buckets.current)}</span>
              <span className="text-warn">
                Overdue {money(kpis.unpaid - kpis.buckets.current)}
              </span>
              <span className="text-xs text-muted">1-7 days {money(kpis.buckets.d1)}</span>
              <span className="text-xs text-muted">8-14 days {money(kpis.buckets.d8)}</span>
              <span className="text-xs text-muted">15-21 days {money(kpis.buckets.d15)}</span>
              <span className="text-xs text-muted">22+ days {money(kpis.buckets.d22)}</span>
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
            Pay vendor
          </Button>
        </TabActions>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
          <KpiMini label="Payments" value={money(movs.reduce((s, m) => s + m.amount, 0))} />
          <KpiMini label="Terms accounts" value={money(0)} />
          <KpiMini label="Cash accounts" value={money(movs.reduce((s, m) => s + m.amount, 0))} />
          <KpiMini label="Paid via ACH" value={money(movs.reduce((s, m) => s + m.amount, 0))} />
          <KpiMini label="Paid via other" value={money(0)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Payment date</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2 text-right">Total amount</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Payment ID</th>
              </tr>
            </thead>
            <tbody>
              {movs.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-muted" colSpan={6}>
                    No vendor payments yet. Use Pay vendor to record ACH, check, or cash.
                  </td>
                </tr>
              ) : (
                movs.map((m) => (
                  <tr key={m.id} className="border-b border-border">
                    <td className="px-3 py-2">{fecha(m.mov_date)}</td>
                    <td className="px-3 py-2">{m.counterparty}</td>
                    <td className="px-3 py-2 text-right">{money(m.amount)}</td>
                    <td className="px-3 py-2">ACH</td>
                    <td className="px-3 py-2 text-muted">{m.notes}</td>
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
            Pay vendor
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            + Add new expense
          </Button>
        </div>
      </TabActions>
      <FilterRow>
        <FilterField label="Vendor">
          <Select value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">Search your vendors</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Payment statuses">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All payment statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
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
        Below you can find all expenses. Select any to export to CSV.{" "}
        <button type="button" className="rounded-md border border-border px-2 py-1 text-fg">
          Export expenses
        </button>
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
              <th className="px-3 py-2">PO # / Exp #</th>
              <th className="px-3 py-2">Inv #</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Reqs. date</th>
              <th className="px-3 py-2">Due date</th>
              <th className="px-3 py-2 text-right">Total amount</th>
              <th className="px-3 py-2 text-right">Remaining balance</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const k = keyOf(e);
              const label = e.kind === "po" ? poShort(e.number) : e.number.replace(/^EXP-/, "EXP #");
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
                    {e.kind === "po" ? (
                      <Link to="/compras" className="text-ok">
                        {label}
                      </Link>
                    ) : (
                      <button type="button" className="text-warn" onClick={() => setDetailId(e.id)}>
                        {label}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">{e.invoice_number || "—"}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2">{e.supplier_name}</td>
                  <td className="px-3 py-2">{fecha(e.issue_date)}</td>
                  <td className="px-3 py-2">{fecha(e.due_date)}</td>
                  <td className="px-3 py-2 text-right">{money(e.amount)}</td>
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
          pos={pos.data ?? []}
          onClose={() => setDetailId(null)}
          onConnect={() => setConnectFor(detailId)}
          onChanged={() => void payables.reload()}
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
          }}
        />
      ) : null}
    </div>
  );
}

function KpiMini({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="label-caps">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === "warn" ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}

function CreateExpenseDrawer({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: "Materia prima",
    date: todayISO(),
    amount: "",
    payable: false,
    supplier_id: "",
    invoice: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (form.payable && !form.supplier_id) {
      setErr("Payable expenses must have a vendor selected");
      return;
    }
    if (!form.supplier_id) {
      setErr("Select a vendor");
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
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      title="Create Expense"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !form.amount} onClick={() => void submit()}>
            Create expense
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type *">
          <ConceptSelect kind="gasto" value={form.category} onChange={(category) => setForm({ ...form, category })} />
        </Field>
        <Field label="Requested date">
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </Field>
        <Field label="Amount">
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
        </Field>
        <label className="flex min-h-10 items-end gap-2 pb-2 text-sm">
          <input type="checkbox" className="size-4 accent-action" checked={form.payable} onChange={(e) => setForm({ ...form, payable: e.target.checked })} />
          Yes, add to AP
        </label>
      </div>
      {form.payable ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Vendor">
            <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">Search vendors</option>
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
          <Field label="Liability account">
            <Select defaultValue="20100">
              <option value="20100">20100 Accounts Payable</option>
            </Select>
          </Field>
        </div>
      ) : (
        <div className="mt-4">
          <Field label="Vendor">
            <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">Search vendors</option>
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
  pos,
  onClose,
  onConnect,
  onChanged,
}: {
  id: number;
  pos: { id: number; po_number: string }[];
  onClose: () => void;
  onConnect: () => void;
  onChanged: () => void;
}) {
  const detail = useAsync(() => listExpenseLinks({ data: { expense_id: id } }), [id]);
  const d = detail.data;
  async function disconnect(poId: number) {
    await disconnectExpensePo({ data: { expense_id: id, purchase_order_id: poId } });
    await detail.reload();
    onChanged();
  }
  return (
    <Modal title="Expense Details" onClose={onClose} wide>
      {d ? (
        <div>
          <h3 className="text-lg font-semibold">{d.category}</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="label-caps">Expense #</p>
              <p>{d.expense_number.replace(/^EXP-/, "")}</p>
            </div>
            <div>
              <p className="label-caps">Invoice #</p>
              <p>{d.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="label-caps">Vendor</p>
              <p>{d.supplier_name}</p>
            </div>
            <div>
              <p className="label-caps">Requested date</p>
              <p>{fecha(d.issue_date)}</p>
            </div>
            <div>
              <p className="label-caps">Payable</p>
              <p>{d.payable ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="label-caps">Amount</p>
              <p>{money(d.amount)}</p>
            </div>
            <div>
              <p className="label-caps">Distribution type</p>
              <p>Auto distributed by pallet</p>
            </div>
          </div>
          <p className="mt-6 text-sm font-medium">Expense connected to:</p>
          <div className="mt-2 grid gap-2">
            {d.links.map((l) => (
              <div key={l.purchase_order_id} className="flex items-stretch overflow-hidden rounded-md border border-border">
                <div className="w-1.5 bg-primary" />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium text-ok">
                      PO #{poShort(l.po_number)}
                    </p>
                    <p className="text-xs text-muted">
                      {fecha(l.order_date)} · {l.supplier_name}
                    </p>
                    {l.product_name ? <p className="text-xs">{l.product_name}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{money(l.amount_applied)}</p>
                    <Button size="sm" variant="outline" onClick={() => void disconnect(l.purchase_order_id)}>
                      Disconnect
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {d.links.length === 0 ? <p className="text-sm text-muted">Not connected to a PO.</p> : null}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onConnect}>
              Connect additional POs
            </Button>
            <Button onClick={onClose}>Edit expense</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading…</p>
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
  const [q, setQ] = useState("");
  const filtered = pos.filter((p) => !q || p.po_number.includes(q) || poShort(p.po_number).includes(q));
  return (
    <Modal title={`Connect to Expense`} onClose={onClose} wide>
      <Field label="Search by PO #">
        <Input value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <p className="mt-4 text-sm font-medium">Select POs to connect to your expense</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase text-muted">
            <tr>
              <th className="px-2 py-2">PO #</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Vendor</th>
              <th className="px-2 py-2">Requested date</th>
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
                    Connect
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="outline" className="mt-4" onClick={onClose}>
        Back to detail
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
  suppliers: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
  initialTab?: "manual" | "credit";
}) {
  const [tab, setTab] = useState<"manual" | "credit">(initialTab);
  const unpaidVendors = [...new Set(rows.filter((r) => r.saldo > 0).map((r) => r.supplier_id))];
  const [vendorId, setVendorId] = useState(String(unpaidVendors[0] ?? suppliers[0]?.id ?? ""));
  const vendorRows = rows.filter((r) => String(r.supplier_id) === vendorId);
  const openRows = vendorRows.filter((r) => r.saldo > 0.009);
  const [checks, setChecks] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("ACH");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const applied = Object.values(checks).reduce((s, n) => s + n, 0);
  const due = openRows.reduce((s, r) => s + r.saldo, 0);
  const overdue = openRows.filter((r) => agingBucket(r.issue_date) !== "current").reduce((s, r) => s + r.saldo, 0);

  async function submit() {
    const apps = Object.entries(checks)
      .filter(([, amt]) => amt > 0)
      .map(([k, amount]) => {
        const [kind, id] = k.split("-");
        return { kind: kind as "expense" | "po", id: Number(id), amount };
      });
    if (!apps.length) {
      setErr("Select at least one invoice");
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
          notes: notes || undefined,
          applications: apps,
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Vendor Payment" onClose={onClose} wide>
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
          Record Manual Payment
        </button>
        <button type="button" className={`pb-2 ${tab === "credit" ? "border-b-2 border-action font-medium" : "text-muted"}`} onClick={() => setTab("credit")}>
          Apply Credit
        </button>
      </div>
      {tab === "credit" ? (
        <p className="mt-6 text-sm text-muted">No open vendor credits for this supplier. Overpayments create a credit automatically.</p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="grid gap-3">
            <Field label="Payment amount">
              <Input value={String(applied || "")} readOnly />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Payment date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
                  <th className="px-2 py-2">PO / Exp #</th>
                  <th className="px-2 py-2">Requested</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2 text-right">Amt to apply</th>
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
                      <td className="px-2 py-2">{r.kind === "po" ? `PO #${poShort(r.number)}` : r.number}</td>
                      <td className="px-2 py-2">{fecha(r.issue_date)}</td>
                      <td className="px-2 py-2 text-right">{money(r.amount)}</td>
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
        <p className="mr-auto text-sm text-muted">Invoices selected: {Object.keys(checks).length}</p>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving || applied <= 0} onClick={() => void submit()}>
          Record payment
        </Button>
      </div>
    </Modal>
  );
}
