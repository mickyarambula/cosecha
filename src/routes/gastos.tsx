import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Modal } from "@/components/app-shell";
import { FilterField, FilterRow } from "@/components/product-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { poShort } from "@/lib/nav";
import { createExpense, listExpenses, listPurchaseOrders, listSuppliers, registerPagoGasto } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, GASTO_CATEGORIAS, money, todayISO } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/gastos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "list",
  }),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const expenses = useAsync(() => listExpenses(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const pos = useAsync(() => listPurchaseOrders(), []);
  const [open, setOpen] = useState(false);
  const [pago, setPago] = useState<{ id: number; number: string; saldo: number } | null>(null);
  const [amount, setAmount] = useState("");
  const [form, setForm] = useState({
    category: "Inspection Services",
    supplier_id: "",
    purchase_order_id: "",
    amount: "",
    quantity: "1",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [vendor, setVendor] = useState("");

  const rows = expenses.data ?? [];
  const filtered = rows.filter((r) => !vendor || String(r.supplier_id) === vendor);
  const kpis = useMemo(() => {
    const total = filtered.reduce((s, r) => s + r.amount, 0);
    const saldo = filtered.reduce((s, r) => s + r.saldo, 0);
    return { total, saldo, cash: total, terms: 0 };
  }, [filtered]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const qtyN = Number(form.quantity) || 1;
      const amt = Number(form.amount);
      await createExpense({
        data: {
          category: form.category,
          supplier_id: Number(form.supplier_id),
          purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : undefined,
          amount: amt,
          quantity: qtyN,
          unit_cost: qtyN ? amt / qtyN : amt,
          notes: form.notes || undefined,
        },
      });
      setOpen(false);
      await expenses.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create");
    } finally {
      setSaving(false);
    }
  }

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    if (!pago) return;
    setSaving(true);
    try {
      await registerPagoGasto({ data: { expense_id: pago.id, amount: Number(amount) } });
      setPago(null);
      await expenses.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not pay");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "credits") {
    return (
      <div className="p-5">
        <p className="text-sm text-muted">
          Customer credits and AR live in{" "}
          <Link to="/cxc" className="text-link">
            Credits
          </Link>
          .
        </p>
      </div>
    );
  }

  if (tab === "aging") {
    return (
      <div className="p-5">
        <p className="text-sm text-muted">
          Payable and receivable aging lives in{" "}
          <Link to="/tesoreria" className="text-link">
            Debt Aging
          </Link>
          .
        </p>
      </div>
    );
  }

  if (tab === "overview" || tab === "payments") {
    return (
      <div className="p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <Kpi label="Total expenses" value={money(kpis.total)} />
          <Kpi label="Total balance" value={money(kpis.saldo)} tone={kpis.saldo ? "warn" : "ok"} />
          <Kpi label="Total expenses cash" value={money(kpis.cash)} />
          <Kpi label="Total expenses terms accounts" value={money(kpis.terms)} />
        </div>
        {tab === "payments" ? (
          <p className="mt-8 text-sm text-muted">Pay vendors from the Expenses tab — select an unpaid row and record a payment.</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
      <FilterRow>
        <FilterField label="Filter by">
          <Select defaultValue="Requested date">
            <option>Requested date</option>
          </Select>
        </FilterField>
        <FilterField label="Requested date">
          <Input defaultValue={todayISO()} />
        </FilterField>
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
          <Select defaultValue="">
            <option value="">All payment statuses</option>
            <option value="open">Unpaid</option>
            <option value="paid">Paid</option>
          </Select>
        </FilterField>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const row = filtered.find((r) => r.saldo > 0);
            setPago(row ? { id: row.id, number: row.expense_number, saldo: row.saldo } : null);
          }}>
            Pay vendor
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            + Add new expense
          </Button>
        </div>
      </FilterRow>
      <div className="grid gap-3 p-4 sm:grid-cols-4">
        <Kpi label="Total expenses" value={money(kpis.total)} />
        <Kpi label="Total balance" value={money(kpis.saldo)} />
        <Kpi label="Total expenses cash" value={money(kpis.cash)} />
        <Kpi label="Total expenses terms accounts" value={money(0)} />
      </div>
      <div className="px-4 pb-2 text-sm text-muted">
        Below you can find all expenses. Select any to export to CSV.{" "}
        <button type="button" className="rounded-md border border-border px-2 py-1 text-fg">
          Export expenses
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
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
            {filtered.map((e) => (
              <tr key={e.id} className="border-b border-border bg-surface">
                <td className="px-3 py-2">
                  {e.po_number ? (
                    <Link to="/compras" className="text-link">
                      {poShort(e.po_number)}
                    </Link>
                  ) : (
                    e.expense_number
                  )}
                </td>
                <td className="px-3 py-2">{e.invoice_number || "—"}</td>
                <td className="px-3 py-2">{e.po_number ? "Purchase Order" : e.category}</td>
                <td className="px-3 py-2">{e.supplier_name}</td>
                <td className="px-3 py-2">{fecha(e.issue_date)}</td>
                <td className="px-3 py-2">{fecha(e.issue_date)}</td>
                <td className="px-3 py-2 text-right">{money(e.amount)}</td>
                <td className="px-3 py-2 text-right">{money(e.saldo)}</td>
                <td className="px-3 py-2">
                  <Badge tone={e.saldo > 0 ? "unpaid" : "ok"}>{e.saldo > 0 ? "Unpaid" : "Paid"}</Badge>
                  {e.saldo > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => {
                        setPago({ id: e.id, number: e.expense_number, saldo: e.saldo });
                        setAmount(String(e.saldo));
                      }}
                    >
                      Pay
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal title="Add new expense" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {GASTO_CATEGORIAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Vendor">
              <Select required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Select</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Connect to PO">
              <Select value={form.purchase_order_id} onChange={(e) => setForm({ ...form, purchase_order_id: e.target.value })}>
                <option value="">None</option>
                {(pos.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.po_number} · {p.supplier_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount">
              <Input required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              Create expense
            </Button>
          </form>
        </Modal>
      ) : null}
      {pago ? (
        <Modal title={`Pay ${pago.number}`} onClose={() => setPago(null)}>
          <form className="grid gap-3" onSubmit={pagar}>
            <p className="text-sm text-muted">Balance {money(pago.saldo)}</p>
            <Field label="Amount">
              <Input required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              Record payment
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
