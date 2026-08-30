import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Drawer, TabActions } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { createGlAccount, getFinancials, listGlAccounts, listGlMappings, saveGlMappings } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { errorMessage, fechaLong, money } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/cuentas")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "accounts",
  }),
  component: Page,
});

const EXPENSE_KEYS = [
  "Freight",
  "Inspection Services",
  "Quality Control",
  "Advertising",
  "Commissions and fees",
  "Cost of Labor",
  "Disposal fees",
  "Dues & Subscriptions",
  "Equipment",
  "Boxes",
  "Supplies",
  "Insurance",
  "Legal & Professional fees",
  "Maintenance & Repairs",
  "Materials",
] as const;

function Page() {
  const { tab } = Route.useSearch();
  const accounts = useAsync(() => listGlAccounts(), []);
  const maps = useAsync(() => listGlMappings(), []);
  const financials = useAsync(() => getFinancials(), []);
  const rows = financials.data?.accounts ?? accounts.data?.map((a) => ({ ...a, current_balance: a.starting_balance })) ?? [];
  const [addKind, setAddKind] = useState<string | null>(null);
  const [form, setForm] = useState({ number: "", name: "", description: "", subtype: "", starting_balance: "0" });
  const [saving, setSaving] = useState(false);
  const [localMaps, setLocalMaps] = useState<Record<string, string> | null>(null);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [mapErr, setMapErr] = useState<string | null>(null);
  const [mapSaved, setMapSaved] = useState(false);

  const grouped = useMemo(() => {
    const incomeRev = rows.filter((a) => a.kind === "revenue");
    const incomeCogs = rows.filter((a) => a.kind === "cogs");
    const incomeExp = rows.filter((a) => a.kind === "expense");
    const assets = rows.filter((a) => a.kind === "asset");
    const liab = rows.filter((a) => a.kind === "liability");
    const eq = rows.filter((a) => a.kind === "equity");
    return { incomeRev, incomeCogs, incomeExp, assets, liab, eq };
  }, [rows]);

  const mapObj = localMaps ?? Object.fromEntries((maps.data ?? []).map((m) => [m.map_key, m.account_number]));

  async function addAccount(kind: string, statement: "income" | "balance") {
    setSaving(true);
    setAddErr(null);
    try {
      await createGlAccount({
        data: {
          number: form.number,
          name: form.name,
          description: form.description || undefined,
          statement,
          kind: kind as "revenue" | "cogs" | "expense" | "asset" | "liability" | "equity",
          subtype: form.subtype || undefined,
          starting_balance: Number(form.starting_balance) || 0,
        },
      });
      setAddKind(null);
      setForm({ number: "", name: "", description: "", subtype: "", starting_balance: "0" });
      await Promise.all([accounts.reload(), financials.reload()]);
    } catch (e) {
      setAddErr(errorMessage(e, "No se pudo crear la cuenta."));
    } finally {
      setSaving(false);
    }
  }

  async function persistMaps() {
    setSaving(true);
    setMapErr(null);
    setMapSaved(false);
    try {
      await saveGlMappings({
        data: { mappings: Object.entries(mapObj).map(([map_key, account_number]) => ({ map_key, account_number })) },
      });
      await maps.reload();
      setMapSaved(true);
    } catch (e) {
      setMapErr(errorMessage(e, "No se pudieron guardar los mapeos."));
    } finally {
      setSaving(false);
    }
  }

  if (tab === "automations") {
    const opts = rows.filter((a) => a.kind === "expense" || a.kind === "cogs" || a.kind === "revenue" || a.kind === "liability" || a.kind === "asset");
    return (
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Accounting Automations</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Required
            </span>
          </div>
          <p className="mb-5 text-sm text-muted">
            Accounting in Cosecha posts as you create sales, purchases, expenses and payments. Map the default accounts once —
            every document afterwards writes the entries.
          </p>
          <Field label="Accounts Payable">
            <Select value={mapObj.ap || "20100"} onChange={(e) => setLocalMaps({ ...mapObj, ap: e.target.value })}>
              {rows.filter((a) => a.kind === "liability").map((a) => (
                <option key={a.number} value={a.number}>
                  {a.number} {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-4">
            <Field label="Accounts Receivable">
              <Select value={mapObj.ar || "12000"} onChange={(e) => setLocalMaps({ ...mapObj, ar: e.target.value })}>
                {rows.filter((a) => a.kind === "asset").map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <h3 className="mt-6 text-sm font-semibold">BillPay & Collections</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Collections">
              <Select value={mapObj.bank_collections || "16000"} onChange={(e) => setLocalMaps({ ...mapObj, bank_collections: e.target.value })}>
                {rows.filter((a) => a.kind === "asset").map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="BillPay">
              <Select value={mapObj.bank_billpay || "16000"} onChange={(e) => setLocalMaps({ ...mapObj, bank_billpay: e.target.value })}>
                {rows.filter((a) => a.kind === "asset").map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Revenue">
              <Select value={mapObj.revenue || "40000"} onChange={(e) => setLocalMaps({ ...mapObj, revenue: e.target.value })}>
                {rows.filter((a) => a.kind === "revenue").map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Cost of Goods Sold">
              <Select value={mapObj.cogs || "50000"} onChange={(e) => setLocalMaps({ ...mapObj, cogs: e.target.value })}>
                {rows.filter((a) => a.kind === "cogs" || a.kind === "expense").map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button className="mt-6" disabled={saving} onClick={() => void persistMaps()}>
            Save mappings
          </Button>
          {mapSaved && !mapErr ? <p className="mt-2 text-sm text-ok">Guardado.</p> : null}
          {mapErr ? <p className="mt-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{mapErr}</p> : null}
        </section>
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Expense Accounts</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Required
            </span>
          </div>
          <p className="mb-5 text-sm text-muted">
            Select the account used for each expense category. Freight must map to Freight Expenses or COGS.
          </p>
          <div className="grid gap-3">
            {EXPENSE_KEYS.map((k) => (
              <div key={k} className="grid grid-cols-2 items-center gap-3">
                <p className="text-sm">{k}</p>
                <Select value={mapObj[k] || "59999"} onChange={(e) => setLocalMaps({ ...mapObj, [k]: e.target.value })}>
                  {opts.map((a) => (
                    <option key={a.number} value={a.number}>
                      {a.number} {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="p-5">
      <TabActions>
        <span className="text-sm text-link">Workspace {COMPANY.shortName}</span>
      </TabActions>
      <AccountGroup
        title="Income Statement Accounts"
        subtitle="Revenue accounts"
        start={grouped.incomeRev.reduce((s, a) => s + a.starting_balance, 0)}
        rows={grouped.incomeRev}
        addLabel="Add new revenue account"
        onAdd={() => { setAddKind("revenue"); setAddErr(null); }}
      />
      <AccountGroup
        title=""
        subtitle="Expense accounts"
        start={grouped.incomeCogs.concat(grouped.incomeExp).reduce((s, a) => s + a.starting_balance, 0)}
        rows={[...grouped.incomeCogs, ...grouped.incomeExp]}
        addLabel="Add new expense account"
        onAdd={() => { setAddKind("expense"); setAddErr(null); }}
      />
      <AccountGroup
        title="Balance Sheet Accounts"
        subtitle="Asset accounts"
        start={grouped.assets.reduce((s, a) => s + a.starting_balance, 0)}
        rows={grouped.assets}
        addLabel="Add new asset account"
        onAdd={() => { setAddKind("asset"); setAddErr(null); }}
      />
      <AccountGroup
        title=""
        subtitle="Liability accounts"
        start={grouped.liab.reduce((s, a) => s + a.starting_balance, 0)}
        rows={grouped.liab}
        addLabel="Add new liability account"
        onAdd={() => { setAddKind("liability"); setAddErr(null); }}
      />
      <AccountGroup
        title=""
        subtitle="Equity accounts"
        start={grouped.eq.reduce((s, a) => s + a.starting_balance, 0)}
        rows={grouped.eq}
        addLabel="Add new equity account"
        onAdd={() => { setAddKind("equity"); setAddErr(null); }}
      />
      {addKind ? (
        <Drawer
          title={`New ${addKind} account`}
          onClose={() => { setAddKind(null); setAddErr(null); }}
          footer={
            <>
              <Button variant="outline" onClick={() => setAddKind(null)}>
                Cancel
              </Button>
              <Button disabled={saving || !form.number || !form.name} onClick={() => void addAccount(addKind, addKind === "asset" || addKind === "liability" || addKind === "equity" ? "balance" : "income")}>
                Create
              </Button>
            </>
          }
        >
          <div className="grid gap-3">
            <Field label="Number">
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
            </Field>
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Subtype">
              <Input value={form.subtype} onChange={(e) => setForm({ ...form, subtype: e.target.value })} />
            </Field>
            <Field label="Starting balance">
              <Input value={form.starting_balance} onChange={(e) => setForm({ ...form, starting_balance: e.target.value })} />
            </Field>
            {addErr ? <p className="rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{addErr}</p> : null}
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}

function AccountGroup({
  title,
  subtitle,
  start,
  rows,
  addLabel,
  onAdd,
}: {
  title: string;
  subtitle: string;
  start: number;
  rows: { number: string; name: string; description: string | null; subtype: string | null; parent_number: string | null; tracking_start: string; starting_balance: number; current_balance: number }[];
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <section className="mb-8">
      {title ? <h2 className="text-lg font-semibold text-ok">{title}</h2> : null}
      <p className="mt-1 text-sm">
        <span className="font-medium">{subtitle}</span>{" "}
        <span className="text-muted">Total starting balance: {money(start)}</span>
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Subtype</th>
              <th className="px-3 py-2">Tracking start date</th>
              <th className="px-3 py-2 text-right">Starting balance</th>
              <th className="px-3 py-2 text-right">Current balance</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.number} className="border-b border-border bg-surface">
                <td className="px-3 py-2 font-mono text-xs">
                  {a.parent_number ? <span className="mr-1 text-muted">↳</span> : null}
                  {a.number}
                </td>
                <td className="px-3 py-2">{a.name}</td>
                <td className="px-3 py-2 text-muted">{a.description || ""}</td>
                <td className="px-3 py-2 text-muted">{a.subtype}</td>
                <td className="px-3 py-2">{fechaLong(a.tracking_start)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(a.starting_balance)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{money(a.current_balance)}</td>
                <td className="px-3 py-2">
                  <button type="button" className="text-link">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="mt-2 text-sm text-link" onClick={onAdd}>
        + {addLabel}
      </button>
    </section>
  );
}
