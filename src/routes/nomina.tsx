import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Kpi, Modal, TabActions } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import {
  cancelPayrollPayment,
  cancelPayrollPeriod,
  closePayrollPeriod,
  createEmployee,
  createPayrollPeriod,
  getFinancials,
  getPayrollPeriod,
  listConcepts,
  listDepartments,
  listEmployees,
  listPayrollPeriods,
  payPayrollPeriod,
  reopenPayrollPeriod,
  savePayrollLines,
  updateEmployee,
  updatePayrollPeriod,
  type EmployeeRow,
  type PayrollLineRow,
  type PayrollPeriodRow,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { errorMessage, fecha, money, PAY_METHODS, todayISO } from "@/lib/utils";

// Nómina (MODELO-NEGOCIO § 7, migración 0052). Camino propio, fuera de
// Gastos: aquí no hay proveedor, no hay "a cargo del productor" y nada llega
// a una liquidación. Los empleados son catálogo (sobreviven a BORRAR); los
// periodos son actividad.

type Search = { tab?: string; period?: number };
export const Route = createFileRoute("/nomina")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "periods",
    period: Number(s.period) > 0 ? Number(s.period) : undefined,
  }),
  component: Page,
});

const PAYROLL_PARTIDA = "Gasto Nómina";
type PayMode = "chase" | "outside";
type ClosePayment = PayMode | "pending";

function Page() {
  const { tab } = Route.useSearch();
  if (tab === "employees") return <EmployeesTab />;
  return <PeriodsTab />;
}

// ── Estado del periodo, en una etiqueta ─────────────────────────────────
function periodTone(p: PayrollPeriodRow) {
  if (p.status === "cancelled") return "danger" as const;
  if (p.status === "draft") return "mute" as const;
  return p.paid_at ? ("ok" as const) : ("unpaid" as const);
}
function periodLabel(p: PayrollPeriodRow) {
  if (p.status === "cancelled") return "Cancelled";
  if (p.status === "draft") return "Draft";
  return p.paid_at ? "Paid" : "Unpaid";
}
function payModeLabel(mode: string | null) {
  if (mode === "chase") return "Chase";
  if (mode === "outside") return "Chase ya lo reflejaba";
  return "";
}
const BEFORE_CORTE_NOTE = "Pagado antes del corte de Chase (19 Ago 2026): es del libro V8. Queda como registro, pero no entra al P&L ni a los pasivos — ese dinero ya vive en el saldo de apertura.";

// ═══════════════════════════════════════════════════════════════════════
// Periodos
// ═══════════════════════════════════════════════════════════════════════
function PeriodsTab() {
  const t = useT();
  const { period } = Route.useSearch();
  const periods = useAsync(() => listPayrollPeriods(), []);
  const employees = useAsync(() => listEmployees(), []);
  const fin = useAsync(() => getFinancials(), []);
  const [newOpen, setNewOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(period ?? null);

  const rows = periods.data ?? [];
  const closedCount = rows.filter((p) => p.status === "closed" && !p.before_corte).length;
  const activeEmployees = (employees.data ?? []).filter((e) => e.is_active).length;

  async function refresh() {
    await Promise.all([periods.reload(), fin.reload()]);
  }

  return (
    <div className="px-4 py-5 sm:px-6">
      <TabActions>
        <Button onClick={() => setNewOpen(true)}>{t("New period")}</Button>
      </TabActions>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Payroll payable" value={money(fin.data?.payroll_unpaid ?? 0)} hint="Closed periods not yet paid" tone={(fin.data?.payroll_unpaid ?? 0) > 0.009 ? "warn" : undefined} />
        <Kpi label="Withheld, to remit" value={money(fin.data?.payroll_withheld ?? 0)} hint="Se acumulan; enterarlas todavía no se captura aquí" />
        <Kpi label="Closed periods" value={String(closedCount)} hint="Que entran al P&L" />
        <Kpi label="Active employees" value={String(activeEmployees)} />
      </div>

      {employees.data && activeEmployees === 0 ? (
        <p className="mt-4 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-muted">
          {t("No employees yet. Add them in the Employees tab.")}
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">{t("Period")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Employees")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Gross")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Deductions")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Net")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium">{t("Payment")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted">
                  {periods.loading ? "…" : t("No payroll periods yet.")}
                </td>
              </tr>
            ) : null}
            {rows.map((p) => (
              <tr key={p.id} className={`border-t border-border ${p.status === "cancelled" ? "text-muted line-through" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs">
                  <button type="button" className="cursor-pointer text-link" onClick={() => setDetailId(p.id)}>
                    {p.period_number}
                  </button>
                </td>
                <td className="px-4 py-3">
                  {fecha(p.period_start)} – {fecha(p.period_end)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.employees}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(p.total_gross)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{money(p.total_deductions)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">{money(p.total_net)}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    <Badge tone={periodTone(p)}>{t(periodLabel(p))}</Badge>
                    {p.before_corte && p.status !== "cancelled" ? <Badge tone="mute">Antes del corte</Badge> : null}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {p.paid_at ? `${fecha(p.paid_at)} · ${payModeLabel(p.pay_mode)}` : p.status === "closed" ? "Por pagar" : ""}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setDetailId(p.id)}>
                    Abrir
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {newOpen ? (
        <NewPeriodModal
          activeEmployees={activeEmployees}
          onClose={() => setNewOpen(false)}
          onSaved={async (id) => {
            setNewOpen(false);
            await refresh();
            setDetailId(id);
          }}
        />
      ) : null}
      {detailId != null ? (
        <PeriodDetail
          id={detailId}
          employees={employees.data ?? []}
          onClose={() => setDetailId(null)}
          onChanged={refresh}
        />
      ) : null}
    </div>
  );
}

function NewPeriodModal({
  activeEmployees,
  onClose,
  onSaved,
}: {
  activeEmployees: number;
  onClose: () => void;
  onSaved: (id: number) => Promise<void>;
}) {
  const t = useT();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [prefill, setPrefill] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const r = await createPayrollPeriod({
        data: { period_start: start, period_end: end, notes: notes || undefined, prefill },
      });
      await onSaved(r.id);
    } catch (e) {
      setErr(errorMessage(e, "No se pudo crear el periodo."));
      setBusy(false);
    }
  }

  return (
    <Modal title={t("New period")} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Period start">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Period end">
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Field label="Notes" className="mt-3">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
      </Field>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-action" checked={prefill} onChange={(e) => setPrefill(e.target.checked)} />
        {t("Prefill active employees")} ({activeEmployees})
      </label>
      <p className="mt-2 text-xs text-muted">
        El bruto de cada renglón sale de la ficha del empleado; si no lo tiene capturado, queda en cero para que lo captures. El periodo entra al P&L por su fecha de fin.
      </p>
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t("Cancel")}
        </Button>
        <Button onClick={() => void save()} disabled={busy || !start || !end}>
          {busy ? t("Saving…") : t("Create")}
        </Button>
      </div>
    </Modal>
  );
}

type LineDraft = { employee_id: number; employee_name: string; concept: string | null; gross: string; deductions: string; notes: string };

function toDraft(l: PayrollLineRow): LineDraft {
  return {
    employee_id: l.employee_id,
    employee_name: l.employee_name,
    concept: l.concept,
    gross: l.gross ? String(l.gross) : "",
    deductions: l.deductions ? String(l.deductions) : "",
    notes: l.notes ?? "",
  };
}
const num = (s: string) => (s.trim() === "" ? 0 : Number(s)) || 0;

type PaymentInput = { mode: ClosePayment; pay_date: string; method: string; reference: string; allow_overlap: boolean };

function PeriodDetail({
  id,
  employees,
  onClose,
  onChanged,
}: {
  id: number;
  employees: EmployeeRow[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const detail = useAsync(() => getPayrollPeriod({ data: { id } }), [id]);
  const p = detail.data;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [addId, setAddId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelPay, setCancelPay] = useState(false);
  const [cancelPeriod, setCancelPeriod] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (!p) return;
    const drafts = p.lines.map(toDraft);
    setStart(p.period_start);
    setEnd(p.period_end);
    setNotes(p.notes ?? "");
    setLines(drafts);
    setLoadedKey(JSON.stringify({ s: p.period_start, e: p.period_end, n: p.notes ?? "", l: drafts }));
  }, [p]);

  const isDraft = p?.status === "draft";
  const isClosed = p?.status === "closed";
  const dirty = isDraft && loadedKey !== "" && JSON.stringify({ s: start, e: end, n: notes, l: lines }) !== loadedKey;
  const childOpen = closeOpen || payOpen || cancelPay || cancelPeriod;
  const totals = useMemo(() => {
    const gross = lines.reduce((s, l) => s + num(l.gross), 0);
    const ded = lines.reduce((s, l) => s + num(l.deductions), 0);
    return { gross, ded, net: gross - ded };
  }, [lines]);
  const activeEmployees = employees.filter((e) => e.is_active);
  const available = activeEmployees.filter((e) => !lines.some((l) => l.employee_id === e.id));

  async function persist() {
    if (!p) return;
    await updatePayrollPeriod({ data: { id: p.id, period_start: start, period_end: end, notes: notes || undefined } });
    await savePayrollLines({
      data: {
        period_id: p.id,
        lines: lines.map((l) => ({
          employee_id: l.employee_id,
          gross: num(l.gross),
          deductions: num(l.deductions),
          notes: l.notes || undefined,
        })),
      },
    });
  }

  /** Corre una acción y recarga. Lanza el error para que quien la disparó lo enseñe donde toca. */
  async function perform(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await fn();
      await Promise.all([detail.reload(), onChanged()]);
      setOk(label);
    } finally {
      setBusy(false);
    }
  }
  /** La misma acción, con el error mostrado en el pie del detalle. */
  async function run(label: string, fn: () => Promise<void>) {
    try {
      await perform(label, fn);
    } catch (e) {
      setErr(errorMessage(e, "No se pudo guardar."));
    }
  }

  // La tecla Escape la escucha cada modal: con uno hijo abierto, el detalle
  // no se cierra por debajo (se perderían los renglones sin guardar).
  function requestClose() {
    if (childOpen) return;
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    onClose();
  }

  function addEmployee() {
    const e = employees.find((x) => String(x.id) === addId);
    if (!e) return;
    setLines((ls) => [
      ...ls,
      {
        employee_id: e.id,
        employee_name: e.name,
        concept: e.payroll_concept,
        gross: e.base_gross ? String(e.base_gross) : "",
        deductions: "",
        notes: "",
      },
    ]);
    setAddId("");
  }

  const subtitle = p ? `${fecha(p.period_start)} – ${fecha(p.period_end)}` : "";

  return (
    <Modal title={p ? p.period_number : t("Payroll")} subtitle={subtitle} onClose={requestClose} wide>
      {!p ? (
        <p className="text-sm text-muted">{detail.error ?? "…"}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={periodTone(p)}>{t(periodLabel(p))}</Badge>
            {p.paid_at ? (
              <span className="text-muted">
                {t("Paid on")} {fecha(p.paid_at)} · {payModeLabel(p.pay_mode)}
                {p.method ? ` · ${p.method}` : ""}
                {p.reference ? ` · ${p.reference}` : ""}
              </span>
            ) : null}
            {p.closed_by ? (
              <span className="text-xs text-muted">
                {t("Closed by")} {p.closed_by}
              </span>
            ) : null}
            {p.created_by ? (
              <span className="text-xs text-muted">
                {t("Captured by")} {p.created_by}
              </span>
            ) : null}
          </div>
          <CancelledNote by={p.cancelled_by} at={p.cancelled_at} reason={p.cancel_reason} />
          {p.before_corte && p.status !== "cancelled" ? (
            <p className="mt-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">{BEFORE_CORTE_NOTE}</p>
          ) : null}

          {isDraft ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Period start">
                <Input type="date" value={start} disabled={busy} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Period end">
                <Input type="date" value={end} disabled={busy} onChange={(e) => setEnd(e.target.value)} />
              </Field>
              <Field label="Notes">
                <Input value={notes} disabled={busy} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          ) : p.notes ? (
            <p className="mt-3 whitespace-pre-line text-sm text-muted">{p.notes}</p>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("Employee")}</th>
                  <th className="px-3 py-2 font-medium">{t("Payroll concept")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Gross")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Deductions")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Net")}</th>
                  <th className="px-3 py-2 font-medium">{isDraft ? t("Notes") : "Chase"}</th>
                  {isDraft ? <th className="px-3 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-muted">
                      {t("No employees in this period.")}
                    </td>
                  </tr>
                ) : null}
                {lines.map((l, i) => {
                  const saved = p.lines.find((x) => x.employee_id === l.employee_id);
                  return (
                    <tr key={l.employee_id} className="border-t border-border">
                      <td className="px-3 py-2">
                        {l.employee_name}
                        {!isDraft && saved?.notes ? <p className="text-xs text-muted">{saved.notes}</p> : null}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted">{l.concept ?? "—"}</td>
                      {isDraft ? (
                        <>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              aria-label={`${t("Gross")} ${l.employee_name}`}
                              className="h-8 text-right"
                              value={l.gross}
                              disabled={busy}
                              onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, gross: e.target.value } : x)))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              aria-label={`${t("Deductions")} ${l.employee_name}`}
                              className="h-8 text-right"
                              value={l.deductions}
                              disabled={busy}
                              onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, deductions: e.target.value } : x)))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(num(l.gross) - num(l.deductions))}</td>
                          <td className="px-3 py-2">
                            <Input
                              aria-label={`${t("Notes")} ${l.employee_name}`}
                              className="h-8"
                              value={l.notes}
                              disabled={busy}
                              onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="cursor-pointer text-xs text-danger disabled:opacity-50"
                              disabled={busy}
                              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                            >
                              {t("Remove")}
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-right tabular-nums">{money(saved?.gross ?? 0)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(saved?.deductions ?? 0)}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">{money(saved?.net ?? 0)}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted">{saved?.movement_folio ?? "—"}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-2 font-medium">
                  <td className="px-3 py-2" colSpan={2}>
                    {t("Total")} · {lines.length} {t("employees").toLowerCase()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(isDraft ? totals.gross : p.total_gross)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(isDraft ? totals.ded : p.total_deductions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{money(isDraft ? totals.net : p.total_net)}</td>
                  <td colSpan={isDraft ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>

          {isDraft ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="flex min-w-56 flex-col gap-1">
                <span className="label-caps">{t("Add employee")}</span>
                <Select value={addId} disabled={busy} onChange={(e) => setAddId(e.target.value)} aria-label={t("Add employee")}>
                  <option value="">—</option>
                  {available.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                      {e.department_name ? ` · ${e.department_name}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={addEmployee} disabled={!addId || busy}>
                {t("Add")}
              </Button>
              {activeEmployees.length === 0 ? (
                <span className="text-xs text-muted">{t("No employees yet. Add them in the Employees tab.")}</span>
              ) : null}
            </div>
          ) : null}

          {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
          {ok ? <p className="mt-3 text-sm text-ok">{ok}</p> : null}
          {confirmLeave ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn/40 bg-warn/5 px-3 py-2 text-sm">
              <span>Tienes cambios sin guardar en este periodo.</span>
              <span className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setConfirmLeave(false); onClose(); }}>
                  Descartar
                </Button>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      try {
                        await perform(t("Saved."), persist);
                        setConfirmLeave(false);
                        onClose();
                      } catch (e) {
                        setErr(errorMessage(e, "No se pudo guardar."));
                      }
                    })()
                  }
                >
                  Guardar y cerrar
                </Button>
              </span>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {p.status !== "cancelled" && !(p.paid_at && p.pay_mode === "chase") ? (
              <Button variant="outline" onClick={() => setCancelPeriod(true)} disabled={busy}>
                {t("Cancel period")}
              </Button>
            ) : null}
            {isDraft ? (
              <>
                <Button variant="outline" onClick={() => void run(t("Saved."), persist)} disabled={busy}>
                  {t("Save")}
                </Button>
                <Button onClick={() => setCloseOpen(true)} disabled={busy || lines.length === 0}>
                  {t("Close period")}
                </Button>
              </>
            ) : null}
            {isClosed && !p.paid_at ? (
              <>
                <Button variant="outline" onClick={() => void run(t("Period reopened."), async () => { await reopenPayrollPeriod({ data: { id: p.id } }); })} disabled={busy}>
                  {t("Reopen")}
                </Button>
                <Button onClick={() => setPayOpen(true)} disabled={busy}>
                  {t("Register payment")}
                </Button>
              </>
            ) : null}
            {isClosed && p.paid_at ? (
              <Button variant="outline" onClick={() => setCancelPay(true)} disabled={busy}>
                {t("Cancel payment")}
              </Button>
            ) : null}
          </div>

          {closeOpen ? (
            <PaymentModal
              title={`${t("Close period")} ${p.period_number}`}
              net={totals.net}
              closing
              onClose={() => setCloseOpen(false)}
              onConfirm={async (i) => {
                // Guarda lo capturado y cierra; si algo falla, el modal se queda
                // abierto con el error y lo tecleado.
                await perform(t("Period closed."), async () => {
                  await persist();
                  await closePayrollPeriod({
                    data: {
                      id: p.id,
                      payment: i.mode,
                      allow_overlap: i.allow_overlap || undefined,
                      pay_date: i.mode === "pending" ? undefined : i.pay_date || undefined,
                      method: i.mode === "chase" ? i.method || undefined : undefined,
                      reference: i.mode === "chase" ? i.reference || undefined : undefined,
                    },
                  });
                });
                setCloseOpen(false);
              }}
            />
          ) : null}
          {payOpen ? (
            <PaymentModal
              title={`${t("Register payment")} ${p.period_number}`}
              net={p.total_net}
              onClose={() => setPayOpen(false)}
              onConfirm={async (i) => {
                const mode = i.mode;
                if (mode === "pending") return;
                await perform(t("Payment registered."), async () => {
                  await payPayrollPeriod({
                    data: {
                      id: p.id,
                      mode,
                      pay_date: i.pay_date || undefined,
                      method: mode === "chase" ? i.method || undefined : undefined,
                      reference: mode === "chase" ? i.reference || undefined : undefined,
                    },
                  });
                });
                setPayOpen(false);
              }}
            />
          ) : null}
          {cancelPay ? (
            <CancelDialog
              title={`${t("Cancel payment")} ${p.period_number}`}
              subtitle={money(p.total_net)}
              warning={
                p.pay_mode === "chase"
                  ? "Se cancelan los movimientos de Chase de este periodo (el dinero regresa a la caja) y el periodo queda por pagar."
                  : "El periodo queda por pagar. Chase no se mueve: este pago no había tocado la caja."
              }
              onClose={() => setCancelPay(false)}
              onConfirm={async (reason) => {
                await cancelPayrollPayment({ data: { id: p.id, reason: reason || undefined } });
                setCancelPay(false);
                await Promise.all([detail.reload(), onChanged()]);
              }}
            />
          ) : null}
          {cancelPeriod ? (
            <CancelDialog
              title={`${t("Cancel period")} ${p.period_number}`}
              subtitle={subtitle}
              warning={
                p.status === "closed"
                  ? "El periodo sale del P&L y del pasivo. Los renglones se conservan como rastro."
                  : undefined
              }
              onClose={() => setCancelPeriod(false)}
              onConfirm={async (reason) => {
                await cancelPayrollPeriod({ data: { id: p.id, reason: reason || undefined } });
                setCancelPeriod(false);
                await Promise.all([detail.reload(), onChanged()]);
              }}
            />
          ) : null}
        </>
      )}
    </Modal>
  );
}

/** Cómo se pagó: por Chase (se registra), ya pagada (Chase ya lo refleja) o queda por pagar. */
function PaymentModal({
  title,
  net,
  closing = false,
  onClose,
  onConfirm,
}: {
  title: string;
  net: number;
  /** Cerrando el periodo: ofrece "por pagar" y la confirmación de pago adicional. */
  closing?: boolean;
  onClose: () => void;
  onConfirm: (i: PaymentInput) => Promise<void>;
}) {
  const t = useT();
  const [mode, setMode] = useState<ClosePayment>("chase");
  const [payDate, setPayDate] = useState(todayISO());
  const [method, setMethod] = useState<string>(PAY_METHODS[0]);
  const [reference, setReference] = useState("");
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm({ mode, pay_date: payDate, method, reference, allow_overlap: allowOverlap });
    } catch (e) {
      // El modal se queda abierto con lo tecleado: el error se lee aquí mismo.
      setErr(errorMessage(e, "No se pudo registrar."));
    } finally {
      setBusy(false);
    }
  }

  const option = (value: ClosePayment, label: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <input type="radio" name="pay-mode" className="mt-1 accent-action" checked={mode === value} onChange={() => setMode(value)} disabled={busy} />
      <span>
        <span className="font-medium">{t(label)}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <Modal title={title} subtitle={`${t("Net")}: ${money(net)}`} onClose={onClose}>
      <p className="mb-2 text-sm font-medium">{t("How was it paid?")}</p>
      <div className="grid gap-2">
        {option("chase", "Already left Chase — record it", "Se registra un movimiento en Tesorería por empleado, con la fecha real del banco. No puede ser antes del corte del 19 de agosto de 2026.")}
        {option("outside", "Already paid, Chase already shows it", "Salió antes del corte (entonces es del V8 y no entra al P&L), o ya lo capturaste a mano en Tesorería. La caja no se mueve.")}
        {closing ? option("pending", "Not paid yet", "Queda como Nómina por pagar hasta que registres el pago.") : null}
      </div>
      {mode !== "pending" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Pay date">
            <Input type="date" value={payDate} disabled={busy} onChange={(e) => setPayDate(e.target.value)} />
          </Field>
          {mode === "chase" ? (
            <>
              <Field label="Method">
                <Select value={method} disabled={busy} onChange={(e) => setMethod(e.target.value)}>
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t(m)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reference">
                <Input value={reference} disabled={busy} onChange={(e) => setReference(e.target.value)} />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
      {closing ? (
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-action" checked={allowOverlap} disabled={busy} onChange={(e) => setAllowOverlap(e.target.checked)} />
          <span>
            Es un pago adicional a otro periodo con las mismas fechas (bono, aguinaldo).
            <span className="block text-xs text-muted">Sin esto, un empleado que ya cobró esos días en otro periodo detiene el cierre.</span>
          </span>
        </label>
      ) : null}
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t("Cancel")}
        </Button>
        <Button onClick={() => void confirm()} disabled={busy || (mode !== "pending" && !payDate)}>
          {busy ? t("Saving…") : t("Confirm")}
        </Button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Empleados
// ═══════════════════════════════════════════════════════════════════════
function EmployeesTab() {
  const t = useT();
  const employees = useAsync(() => listEmployees(), []);
  const departments = useAsync(() => listDepartments(), []);
  const concepts = useAsync(() => listConcepts({ data: { kind: "gasto", activeOnly: true } }), []);
  const [editing, setEditing] = useState<EmployeeRow | "new" | null>(null);
  const payrollConcepts = (concepts.data ?? []).filter((c) => c.partida === PAYROLL_PARTIDA).map((c) => c.name);
  const rows = employees.data ?? [];

  return (
    <div className="px-4 py-5 sm:px-6">
      <TabActions>
        <Button onClick={() => setEditing("new")}>{t("New employee")}</Button>
      </TabActions>
      <p className="mb-3 text-sm text-muted">
        Personal de Plein, aparte de quién entra al sistema. Un empleado dado de baja se conserva en los periodos donde cobró.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Name")}</th>
              <th className="px-4 py-3 font-medium">{t("Department")}</th>
              <th className="px-4 py-3 font-medium">{t("Position")}</th>
              <th className="px-4 py-3 font-medium">{t("Payroll concept")}</th>
              <th className="px-4 py-3 font-medium">{t("Hired on")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Base gross per period")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted">
                  {employees.loading ? "…" : t("No employees yet.")}
                </td>
              </tr>
            ) : null}
            {rows.map((e) => (
              <tr key={e.id} className={`border-t border-border ${e.is_active ? "" : "text-muted"}`}>
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3">{e.department_name ?? "—"}</td>
                <td className="px-4 py-3">{e.position ?? "—"}</td>
                <td className="px-4 py-3">{e.payroll_concept ?? "—"}</td>
                <td className="px-4 py-3">{e.hired_at ? fecha(e.hired_at) : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{e.base_gross != null ? money(e.base_gross) : "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={e.is_active ? "ok" : "mute"}>{e.is_active ? t("Active") : "Baja"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(e)}>
                    {t("Edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? (
        <EmployeeModal
          employee={editing === "new" ? null : editing}
          departments={departments.data ?? []}
          concepts={payrollConcepts}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await employees.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function EmployeeModal({
  employee,
  departments,
  concepts,
  onClose,
  onSaved,
}: {
  employee: EmployeeRow | null;
  departments: { id: number; name: string }[];
  concepts: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useT();
  const [name, setName] = useState(employee?.name ?? "");
  const [department, setDepartment] = useState(employee?.department_id ? String(employee.department_id) : "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [concept, setConcept] = useState(employee?.payroll_concept ?? "");
  const [hired, setHired] = useState(employee?.hired_at ?? "");
  const [baseGross, setBaseGross] = useState(employee?.base_gross != null ? String(employee.base_gross) : "");
  const [notes, setNotes] = useState(employee?.notes ?? "");
  const [active, setActive] = useState(employee?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (employee) {
        // Edición: lo que se vació se manda en `null` para que de verdad se borre.
        await updateEmployee({
          data: {
            id: employee.id,
            is_active: active,
            name,
            department_id: department ? Number(department) : null,
            position: position.trim() || null,
            payroll_concept: concept || null,
            hired_at: hired || null,
            base_gross: baseGross.trim() === "" ? null : Number(baseGross),
            notes: notes.trim() || null,
          },
        });
      } else {
        await createEmployee({
          data: {
            name,
            department_id: department ? Number(department) : null,
            position: position || undefined,
            payroll_concept: concept || undefined,
            hired_at: hired || null,
            base_gross: baseGross.trim() === "" ? null : Number(baseGross),
            notes: notes || undefined,
          },
        });
      }
      await onSaved();
    } catch (e) {
      setErr(errorMessage(e, "No se pudo guardar el empleado."));
      setBusy(false);
    }
  }

  return (
    <Modal title={employee ? employee.name : t("New employee")} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Department">
          <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Position">
          <Input value={position} onChange={(e) => setPosition(e.target.value)} />
        </Field>
        <Field label="Payroll concept">
          <Select value={concept} onChange={(e) => setConcept(e.target.value)}>
            <option value="">—</option>
            {concepts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hired on">
          <Input type="date" value={hired} onChange={(e) => setHired(e.target.value)} />
        </Field>
        <Field label="Base gross per period">
          <Input type="number" step="0.01" min="0" inputMode="decimal" value={baseGross} onChange={(e) => setBaseGross(e.target.value)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
        </Field>
      </div>
      <p className="mt-2 text-xs text-muted">
        La partida es la del V8 (Nómina Ventas / Compras / Admin) y decide el concepto del movimiento en Chase. El sueldo bruto solo precarga el renglón de cada periodo.
      </p>
      {employee ? (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-action" checked={active} onChange={(e) => setActive(e.target.checked)} />
          {t("Active")}
        </label>
      ) : null}
      {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {t("Cancel")}
        </Button>
        <Button onClick={() => void save()} disabled={busy || !name.trim()}>
          {busy ? t("Saving…") : t("Save")}
        </Button>
      </div>
    </Modal>
  );
}
