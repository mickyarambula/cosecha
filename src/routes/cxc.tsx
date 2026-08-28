import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal, TabActions } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { FilterField, FilterRow } from "@/components/product-picker";
import { SendButton } from "@/components/send-doc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { cancelInvoice, listCustomers, listInvoices, registerCustomerPayment } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { aging30, fecha, money, PAY_METHODS, todayISO } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/cxc")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "overview",
  }),
  component: Page,
});

function Page() {
  const { tab } = Route.useSearch();
  const inv = useAsync(() => listInvoices(), []);
  const customers = useAsync(() => listCustomers(), []);
  const [payOpen, setPayOpen] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("");
  const [status, setStatus] = useState("");
  const [cancelInv, setCancelInv] = useState<{ id: number; invoice_number: string } | null>(null);

  const rows = (inv.data ?? []).filter((r) => {
    if (customerFilter && String(r.customer_id) !== customerFilter) return false;
    if (status === "unpaid" && r.saldo <= 0 && r.invoice_type !== "credit") return false;
    if (status === "paid" && r.saldo > 0) return false;
    if (status === "credit" && r.invoice_type !== "credit") return false;
    if (status === "opening" && r.invoice_type !== "opening") return false;
    return true;
  });

  const sales = rows.filter((r) => r.invoice_type !== "credit" && r.invoice_type !== "opening");
  const credits = rows.filter((r) => r.invoice_type === "credit");
  const opening = rows.filter((r) => r.invoice_type === "opening");
  const salesTotal = sales.reduce((s, r) => s + r.total, 0);
  const creditTotal = credits.reduce((s, r) => s + r.total, 0);
  const openingTotal = opening.reduce((s, r) => s + r.total, 0);
  const balance = rows.reduce((s, r) => s + r.saldo, 0);

  if (tab === "overview") {
    const byDate = new Map<string, { terms: number; cash: number; credits: number; payments: number; opening: number }>();
    for (const r of rows) {
      const d = r.issue_date;
      const cur = byDate.get(d) ?? { terms: 0, cash: 0, credits: 0, payments: 0, opening: 0 };
      if (r.invoice_type === "credit") cur.credits += r.total;
      else if (r.invoice_type === "opening") cur.opening += r.total;
      else if ((r.payment_terms || "").toLowerCase().includes("cash") || (r.payment_terms || "").toLowerCase().includes("cod"))
        cur.cash += r.total;
      else cur.cash += r.total;
      cur.payments += r.paid;
      byDate.set(d, cur);
    }
    const dates = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let running = 0;
    return (
      <div className="p-5">
        <FilterRow>
          <FilterField label="From / To">
            <Input type="date" defaultValue={todayISO()} />
          </FilterField>
        </FilterRow>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <span>
            <span className="mr-2 inline-block size-2 rounded-sm bg-subtle" />
            Sales to terms customers {money(0)}
          </span>
          <span>
            <span className="mr-2 inline-block size-2 rounded-sm bg-action" />
            Sales to cash customers {money(salesTotal)}
          </span>
          <span>
            <span className="mr-2 inline-block size-2 rounded-sm bg-danger" />
            Credits {money(creditTotal)}
          </span>
          <span>
            <span className="mr-2 inline-block size-2 rounded-sm bg-warn" />
            Opening {money(openingTotal)}
          </span>
          <span className="ml-auto font-medium">AR Total {money(salesTotal + creditTotal + openingTotal)}</span>
        </div>
        <div className="mt-3 h-4 overflow-hidden rounded-sm bg-surface-2">
          <div className="h-full bg-action" style={{ width: salesTotal + creditTotal ? `${(salesTotal / (salesTotal + Math.abs(creditTotal) || 1)) * 100}%` : "0%" }} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Sales to Terms Customers</th>
                <th className="px-3 py-2 text-right">Sales to Cash Customers</th>
                <th className="px-3 py-2 text-right">Credits</th>
                <th className="px-3 py-2 text-right">AR Day Total</th>
                <th className="px-3 py-2 text-right">Payments</th>
                <th className="px-3 py-2 text-right">AR Balance</th>
              </tr>
            </thead>
            <tbody>
              {dates.map(([d, v]) => {
                const day = v.terms + v.cash + v.credits + v.opening;
                running += day - v.payments;
                return (
                  <tr key={d} className="border-b border-border">
                    <td className="px-3 py-2">{fecha(d)}</td>
                    <td className="px-3 py-2 text-right">{money(v.terms)}</td>
                    <td className="px-3 py-2 text-right">{money(v.cash)}</td>
                    <td className="px-3 py-2 text-right">{money(v.credits)}</td>
                    <td className="px-3 py-2 text-right">{money(day)}</td>
                    <td className="px-3 py-2 text-right">{money(v.payments)}</td>
                    <td className="px-3 py-2 text-right">{money(running)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (tab === "statements") {
    const byCust = new Map<string, { email: string; phone: string; terms: string; overdue: number; balance: number; invoices: typeof rows }>();
    for (const r of rows) {
      const cur = byCust.get(r.customer_name) ?? {
        email: r.customer_email || "",
        phone: r.customer_phone || "",
        terms: r.payment_terms || "Cash",
        overdue: 0,
        balance: 0,
        invoices: [],
      };
      cur.balance += r.saldo;
      if (r.overdue) cur.overdue += r.saldo;
      if (r.customer_email) cur.email = r.customer_email;
      if (r.customer_phone) cur.phone = r.customer_phone;
      cur.invoices.push(r);
      byCust.set(r.customer_name, cur);
    }
    const list = [...byCust.entries()].filter(([, v]) => Math.abs(v.balance) > 0.009);
    return (
      <div>
        <FilterRow>
          <FilterField label="As of">
            <Input type="date" defaultValue={todayISO()} />
          </FilterField>
        </FilterRow>
        <div className="flex items-center justify-end gap-2 px-4 py-2">
          <Button size="sm" variant="outline">
            Send selected statements
          </Button>
          <Button size="sm">Print selected statements</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Statement delivery</th>
                <th className="px-3 py-2">Terms</th>
                <th className="px-3 py-2 text-right">Overdue</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {list.map(([name, v]) => (
                <tr key={name} className="border-b border-border">
                  <td className="px-3 py-2">
                    <input type="checkbox" defaultChecked />
                  </td>
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2 text-muted">Email: {v.email || "—"}</td>
                  <td className="px-3 py-2">{v.terms}</td>
                  <td className="px-3 py-2 text-right text-warn">{money(v.overdue)}</td>
                  <td className="px-3 py-2 text-right">{money(v.balance)}</td>
                  <td className="px-3 py-2">
                    <SendButton
                      title="Statement"
                      number={name}
                      partyName={name}
                      email={v.email}
                      phone={v.phone}
                      docs={v.invoices.map((inv) => ({ tipo: "factura", id: inv.id, label: inv.invoice_number }))}
                      total={v.balance}
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (tab === "payments") {
    return (
      <div className="p-5">
        <TabActions>
          <Button size="sm" onClick={() => setPayOpen(true)}>
            Record payment
          </Button>
        </TabActions>
        <p className="text-sm text-muted">
          Customer receipts post here after you record a payment against invoices. Cash, check, card and ACH are supported.
        </p>
        {payOpen ? (
          <CustomerPayModal
            invoices={inv.data ?? []}
            customers={customers.data ?? []}
            onClose={() => setPayOpen(false)}
            onSaved={() => {
              setPayOpen(false);
              void inv.reload();
            }}
          />
        ) : null}
      </div>
    );
  }

  if (tab === "credits") {
    return (
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Inv #</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr key={c.id} className="border-b border-border">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to="/doc/$tipo/$id" params={{ tipo: "factura", id: c.share_token }} className="text-link">
                    {c.invoice_number}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.customer_name}</td>
                <td className="px-3 py-2">{fecha(c.issue_date)}</td>
                <td className="px-3 py-2 text-right text-danger">{money(c.total)}</td>
                <td className="px-3 py-2">
                  <Badge tone="unpaid">{c.paid ? "Applied" : "Unused"}</Badge>
                </td>
              </tr>
            ))}
            {credits.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-muted">
                  No credit invoices yet. Create one from a sales order.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === "aging" || tab === "unpaid") {
    const byCust = new Map<string, { current: number; b30: number; b60: number; b90: number; b91: number; total: number }>();
    for (const r of rows) {
      if (r.saldo <= 0 && r.invoice_type !== "credit") continue;
      const cur = byCust.get(r.customer_name) ?? { current: 0, b30: 0, b60: 0, b90: 0, b91: 0, total: 0 };
      cur[aging30(r.due_date || r.issue_date)] += r.saldo;
      cur.total += r.saldo;
      byCust.set(r.customer_name, cur);
    }
    return (
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2 text-right">Current</th>
              <th className="px-3 py-2 text-right">1-30</th>
              <th className="px-3 py-2 text-right">31-60</th>
              <th className="px-3 py-2 text-right">61-90</th>
              <th className="px-3 py-2 text-right">91+</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...byCust.entries()].map(([name, v]) => (
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
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <TabActions>
        <Button size="sm" onClick={() => setPayOpen(true)}>
          Record payment
        </Button>
      </TabActions>
      <FilterRow>
        <FilterField label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="credit">Credit</option>
            <option value="opening">Opening</option>
          </Select>
        </FilterField>
        <FilterField label="Customer">
          <Select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}>
            <option value="">All customers</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FilterField>
      </FilterRow>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        <Mini label="Total sales" value={money(salesTotal)} />
        <Mini label="Opening" value={money(openingTotal)} />
        <Mini label="Total balance" value={money(balance)} />
        <Mini label="Total sales cash" value={money(salesTotal)} />
        <Mini label="Total sales terms accounts" value={money(0)} warn />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Inv #</th>
              <th className="px-3 py-2">C PO #</th>
              <th className="px-3 py-2">Rep</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Reqs. date</th>
              <th className="px-3 py-2">Due</th>
              <th className="px-3 py-2">Terms</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">Paid in</th>
              <th className="px-3 py-2 text-right">Rem. balance</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="border-b border-border">
                <td className="px-3 py-2">
                  <Link to="/doc/$tipo/$id" params={{ tipo: "factura", id: i.share_token }} className="font-mono text-xs text-link">
                    {i.invoice_number.replace(/^PP-\d+-/, "")}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">—</td>
                <td className="px-3 py-2">{i.sales_rep || COMPANY.userName}</td>
                <td className="px-3 py-2">
                  {i.invoice_type === "credit" ? (
                    <Badge tone="unpaid">Credit</Badge>
                  ) : i.invoice_type === "opening" ? (
                    <Badge tone="warn">Opening</Badge>
                  ) : (
                    "Delivery"
                  )}
                </td>
                <td className="px-3 py-2">{i.customer_name}</td>
                <td className="px-3 py-2">{fecha(i.issue_date)}</td>
                <td className="px-3 py-2">{fecha(i.due_date)}</td>
                <td className="px-3 py-2">{i.payment_terms || "Cash"}</td>
                <td className={`px-3 py-2 text-right ${i.total < 0 ? "text-danger" : ""}`}>{money(i.total)}</td>
                <td className="px-3 py-2 text-right">{money(i.paid)}</td>
                <td className="px-3 py-2 text-right">{money(i.saldo)}</td>
                <td className="px-3 py-2">
                  {i.status === "cancelled" ? (
                    <Badge tone="danger">Cancelled</Badge>
                  ) : (
                    <Badge tone={i.invoice_type === "credit" ? "unpaid" : i.saldo > 0 ? "unpaid" : "ok"}>
                      {i.invoice_type === "credit" ? "Unused" : i.saldo > 0 ? "Unpaid" : "Paid"}
                    </Badge>
                  )}
                  <CancelledNote by={i.cancelled_by} at={i.cancelled_at} reason={i.cancel_reason} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <SendButton
                      title={i.invoice_type === "credit" ? "Credit" : "Invoice"}
                      number={i.invoice_number}
                      partyName={i.customer_name}
                      email={i.customer_email}
                      phone={i.customer_phone}
                      docs={[{ tipo: "factura", id: i.id, label: i.invoice_type === "credit" ? "Credit" : "Invoice" }]}
                      lines={i.lines.map((l) => ({
                        qty: l.quantity,
                        unit: l.unit || "",
                        name: l.description || "",
                      }))}
                      total={i.total}
                      size="sm"
                    />
                    {i.status !== "cancelled" && i.invoice_type !== "opening" ? (
                      <Button size="sm" variant="outline" onClick={() => setCancelInv({ id: i.id, invoice_number: i.invoice_number })}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payOpen ? (
        <CustomerPayModal
          invoices={inv.data ?? []}
          customers={customers.data ?? []}
          onClose={() => setPayOpen(false)}
          onSaved={() => {
            setPayOpen(false);
            void inv.reload();
          }}
        />
      ) : null}
      {cancelInv ? (
        <CancelDialog
          title={`Cancel invoice ${cancelInv.invoice_number}`}
          subtitle="Inventory is not touched — invoicing doesn't move stock. This only voids the billing document."
          onClose={() => setCancelInv(null)}
          onConfirm={async (reason) => {
            await cancelInvoice({ data: { invoice_id: cancelInv.id, reason: reason || undefined } });
            setCancelInv(null);
            await inv.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function Mini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="label-caps">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</p>
    </div>
  );
}

function CustomerPayModal({
  invoices,
  customers,
  onClose,
  onSaved,
}: {
  invoices: {
    id: number;
    customer_id: number;
    customer_name: string;
    invoice_number: string;
    issue_date: string;
    due_date: string | null;
    total: number;
    paid: number;
    saldo: number;
    invoice_type: string;
  }[];
  customers: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const withBal = invoices.filter((i) => i.invoice_type !== "credit" && i.saldo > 0);
  const [cid, setCid] = useState(String(withBal[0]?.customer_id ?? customers[0]?.id ?? ""));
  const rows = invoices.filter((i) => String(i.customer_id) === cid && i.invoice_type !== "credit" && i.saldo > 0);
  const [checks, setChecks] = useState<Record<number, number>>({});
  const [method, setMethod] = useState("Cash");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const applied = Object.values(checks).reduce((s, n) => s + n, 0);
  const typed = Number(amount) || applied;
  const due = rows.reduce((s, r) => s + r.saldo, 0);
  const over = typed - applied;

  async function submit() {
    const apps = Object.entries(checks)
      .filter(([, a]) => a > 0)
      .map(([id, a]) => ({ invoice_id: Number(id), amount: a }));
    if (!apps.length) {
      setErr("Select at least one invoice");
      return;
    }
    setSaving(true);
    try {
      await registerCustomerPayment({
        data: { customer_id: Number(cid), amount: typed, method, applications: apps },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Customer Payment" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Customer">
          <Select value={cid} onChange={(e) => { setCid(e.target.value); setChecks({}); }}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Mini label="Current" value={money(0)} />
        <Mini label="Past due" value={money(due)} warn />
        <Mini label="Total due" value={money(due)} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[200px_1fr]">
        <div className="grid gap-3">
          <Field label="Payment amount">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(applied)} />
          </Field>
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAY_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase text-muted">
              <tr>
                <th className="px-2 py-2" />
                <th className="px-2 py-2">Inv #</th>
                <th className="px-2 py-2">Requested</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-3 py-2 text-right">Amt to apply</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.id in checks;
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          const next = { ...checks };
                          if (e.target.checked) next[r.id] = r.saldo;
                          else delete next[r.id];
                          setChecks(next);
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">{r.invoice_number.replace(/^PP-\d+-/, "")}</td>
                    <td className="px-2 py-2">{fecha(r.issue_date)}</td>
                    <td className="px-2 py-2 text-right">{money(r.total)}</td>
                    <td className="px-2 py-2">{r.saldo > 0 ? "Unpaid" : "Paid"}</td>
                    <td className="px-2 py-2 text-right">
                      {on ? (
                        <Input className="ml-auto w-24" value={String(checks[r.id])} onChange={(e) => setChecks({ ...checks, [r.id]: Number(e.target.value) || 0 })} />
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
      {over > 0.009 ? (
        <p className="mt-3 text-sm text-warn">Customer is overpaying {money(over)}. An overpayment tag will be created.</p>
      ) : null}
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      <div className="mt-4 flex justify-end gap-2">
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
