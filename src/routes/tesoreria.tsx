import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Kpi, Modal } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { ConceptSelect } from "@/components/concepts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  addBankLine,
  cancelCustomerPayment,
  cancelVendorPayment,
  ignoreBankLine,
  listBankAccounts,
  listBankLines,
  listCash,
  matchBankLine,
  registerCashMovement,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { useT } from "@/lib/i18n";
import { fecha, money, todayISO } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/tesoreria")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "movements",
  }),
  component: Page,
});

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
  const { tab } = Route.useSearch();
  const t = useT();
  const cash = useAsync(() => listCash(), []);
  const data = cash.data;
  const movs = data?.movements ?? [];
  const live = movs.filter((m) => !m.cancelled_at);
  const cobros = live.filter((m) => m.kind === "cobro").reduce((s, m) => s + m.amount, 0);
  const pagos = live.filter((m) => m.kind === "pago").reduce((s, m) => s + m.amount, 0);
  const [regOpen, setRegOpen] = useState(false);
  const [cancelMov, setCancelMov] = useState<{ id: number; folio: string; kind: string } | null>(null);

  if (tab === "reconcile") {
    return <Reconcile cash={movs} />;
  }

  return (
    <div>
      <PageHeader
        title="Cash"
        subtitle="Chase opening is 19 Aug 2026. Register new bank lines here and match them on Reconcile. History before that date is the opening balance — not replayed."
        action={
          <Button size="sm" onClick={() => setRegOpen(true)}>
            {t("Register Chase line")}
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Balance" value={money(data?.balance ?? 0)} tone={(data?.balance ?? 0) >= 0 ? "ok" : "danger"} />
        <Kpi label="Receipts" value={money(cobros)} tone="ok" />
        <Kpi label="Payments" value={money(pagos)} tone="danger" />
      </div>
      {cash.loading ? <p className="text-sm text-muted">{t("Loading…")}</p> : null}
      {cash.error ? <p className="text-sm text-danger">{cash.error}</p> : null}
      <Panel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Folio</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">{t("Counterparty")}</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{m.folio}</td>
                  <td className="px-4 py-3">{fecha(m.mov_date)}</td>
                  <td className="px-4 py-3">
                    {m.cancelled_at ? <Badge tone="danger">Cancelled</Badge> : <Badge tone={kindTone(m.kind)}>{kindLabel(m.kind)}</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <p>{m.counterparty ?? "—"}</p>
                    {m.notes ? <p className="text-xs text-muted">{m.notes}</p> : null}
                    {m.invoice_number ? (
                      <Link to="/cxc" className="text-xs text-primary">
                        {m.invoice_number}
                      </Link>
                    ) : m.bill_number ? (
                      <Link to="/cxp" className="text-xs text-primary">
                        {m.bill_number}
                      </Link>
                    ) : null}
                    <CancelledNote by={m.cancelled_by} at={m.cancelled_at} reason={m.cancel_reason} />
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${m.amount < 0 ? "text-danger" : "text-ok"}`}>
                    {money(m.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!m.cancelled_at && m.folio !== "CORTE-CHASE" && (m.kind === "cobro" || m.kind === "pago") ? (
                      <Button size="sm" variant="outline" onClick={() => setCancelMov({ id: m.id, folio: m.folio, kind: m.kind })}>
                        Cancel
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {cancelMov ? (
        <CancelDialog
          title={`Cancel ${cancelMov.folio}`}
          subtitle="This reverses what it paid — the invoice/bill balance, and any matched bank line."
          onClose={() => setCancelMov(null)}
          onConfirm={async (reason) => {
            const fn = cancelMov.kind === "cobro" ? cancelCustomerPayment : cancelVendorPayment;
            await fn({ data: { cash_movement_id: cancelMov.id, reason: reason || undefined } });
            setCancelMov(null);
            await cash.reload();
          }}
        />
      ) : null}
      {regOpen ? (
        <RegisterChase
          onClose={() => setRegOpen(false)}
          onSaved={() => {
            setRegOpen(false);
            void cash.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function RegisterChase({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [form, setForm] = useState({
    folio: "",
    mov_date: todayISO(),
    direction: "in" as "in" | "out",
    counterparty: "",
    amount: "",
    concept: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await registerCashMovement({
        data: {
          folio: form.folio || undefined,
          mov_date: form.mov_date,
          direction: form.direction,
          kind: form.direction === "in" ? "cobro" : "pago",
          counterparty: form.counterparty || undefined,
          amount: Number(form.amount),
          concept: form.concept || undefined,
          notes: form.notes || undefined,
        },
      });
      onSaved();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : t("Could not save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={t("Register Chase line")} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <p className="text-sm text-muted">
          {t("Same folio as Chase. A deposit also needs a receipt on the customer invoice if it pays a load.")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("Chase folio")}>
            <Input value={form.folio} onChange={(e) => setForm({ ...form, folio: e.target.value })} placeholder="430" />
          </Field>
          <Field label={t("Date")}>
            <Input type="date" value={form.mov_date} onChange={(e) => setForm({ ...form, mov_date: e.target.value })} />
          </Field>
          <Field label={t("In / Out")}>
            <Select
              value={form.direction}
              onChange={(e) => setForm({ ...form, direction: e.target.value as "in" | "out" })}
            >
              <option value="in">{t("Deposit")}</option>
              <option value="out">{t("Withdrawal")}</option>
            </Select>
          </Field>
          <Field label={t("Amount")}>
            <Input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </Field>
          <Field label={t("Counterparty")}>
            <Input
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
              placeholder="CRI INTERNATIONAL"
            />
          </Field>
          <Field label={t("Concept")}>
            <ConceptSelect
              kind={form.direction === "in" ? "ingreso" : "gasto"}
              value={form.concept}
              onChange={(concept) => setForm({ ...form, concept })}
            />
          </Field>
        </div>
        <Field label={t("Notes")}>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <Button type="submit" disabled={saving || !form.amount}>
          {saving ? t("Saving…") : t("Register")}
        </Button>
      </form>
    </Modal>
  );
}

function Reconcile({ cash }: { cash: { id: number; folio: string; mov_date: string; amount: number; counterparty: string | null; notes: string | null }[] }) {
  const t = useT();
  const accounts = useAsync(() => listBankAccounts(), []);
  const lines = useAsync(() => listBankLines(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bank_account_id: "", line_date: todayISO(), description: "", amount: "" });
  const [matchFor, setMatchFor] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const openLines = (lines.data ?? []).filter((l) => l.status === "open");
  const matched = (lines.data ?? []).filter((l) => l.status !== "open");
  const unmatchedCash = cash.filter((m) => !(lines.data ?? []).some((l) => l.cash_movement_id === m.id));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await addBankLine({
        data: {
          bank_account_id: Number(form.bank_account_id || accounts.data?.[0]?.id),
          line_date: form.line_date,
          description: form.description,
          amount: Number(form.amount),
        },
      });
      setOpen(false);
      setForm({ ...form, description: "", amount: "" });
      await lines.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not add");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("Enter the bank statement, then match each line to a cash movement.")}</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t("Add statement line")}
        </Button>
      </div>
      {msg ? <p className="mb-3 text-sm text-danger">{msg}</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-0">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">{t("Unmatched bank")}</p>
          {openLines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{l.description}</p>
                <p className="text-xs text-muted">
                  {fecha(l.line_date)} · {l.bank_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`tabular-nums ${l.amount < 0 ? "text-danger" : "text-ok"}`}>{money(l.amount)}</span>
                <Button size="sm" variant="outline" onClick={() => setMatchFor(l.id)}>
                  {t("Match")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void ignoreBankLine({ data: { line_id: l.id } }).then(() => lines.reload());
                  }}
                >
                  {t("Ignore")}
                </Button>
              </div>
            </div>
          ))}
          {!openLines.length ? <p className="px-4 py-6 text-sm text-muted">{t("No open bank lines.")}</p> : null}
        </Panel>
        <Panel className="p-0">
          <p className="border-b border-border px-4 py-3 text-sm font-semibold">{t("Unmatched cash")}</p>
          {unmatchedCash.map((m) => (
            <div key={m.id} className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
              <div>
                <p className="font-mono text-xs">{m.folio}</p>
                <p>
                  {m.counterparty} · {fecha(m.mov_date)}
                </p>
              </div>
              <span className={`tabular-nums ${m.amount < 0 ? "text-danger" : "text-ok"}`}>{money(m.amount)}</span>
            </div>
          ))}
          {!unmatchedCash.length ? <p className="px-4 py-6 text-sm text-muted">{t("All cash is matched.")}</p> : null}
        </Panel>
      </div>
      {matched.length ? (
        <p className="mt-4 text-xs text-muted">
          {matched.filter((l) => l.status === "matched").length} {t("matched")} · {matched.filter((l) => l.status === "ignored").length} {t("ignored")}
        </p>
      ) : null}

      {open ? (
        <Modal title={t("Add statement line")} onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={add}>
            <Field label="Account">
              <Select value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
                {(accounts.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.last4 ? `••••${a.last4}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={form.line_date} onChange={(e) => setForm({ ...form, line_date: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Amount">
              <Input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <p className="text-xs text-muted">{t("Deposits positive, withdrawals negative — same sign as cash.")}</p>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving…") : t("Add")}
            </Button>
          </form>
        </Modal>
      ) : null}

      {matchFor ? (
        <Modal title={t("Match to cash")} onClose={() => setMatchFor(null)}>
          <div className="grid gap-2">
            {unmatchedCash.map((m) => (
              <Button
                key={m.id}
                variant="outline"
                className="justify-between"
                onClick={() => {
                  void matchBankLine({ data: { line_id: matchFor, cash_movement_id: m.id } })
                    .then(() => {
                      setMatchFor(null);
                      return lines.reload();
                    })
                    .catch((err) => setMsg(err instanceof Error ? err.message : "Could not match"));
                }}
              >
                <span>
                  {m.folio} · {m.counterparty}
                </span>
                <span>{money(m.amount)}</span>
              </Button>
            ))}
            {!unmatchedCash.length ? <p className="text-sm text-muted">{t("No unmatched cash movements.")}</p> : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
