import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Drawer, TabActions } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";
import { createGlAccount, getFinancials, listConcepts, listGlAccounts, listGlMappings, saveGlMappings } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { errorMessage, fechaLong, money } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/cuentas")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "accounts",
  }),
  component: Page,
});

// Bloque 0: aquí vivía una lista de categorías escrita a mano, la TERCERA de
// cuatro que no coincidían entre sí (las otras: el catálogo real de
// `money_concepts`, el mapeo sembrado en inglés en `gl_mappings`, y el switch
// del P&L). La pantalla solo dejaba mapear lo que estaba en esa lista, así que
// la mayoría del catálogo real de Miguel no se podía mapear y caía al cajón.
// Ahora se lee el catálogo de verdad, y lo que manda es la PARTIDA.
const PARTIDAS_GASTO = [
  "Costo",
  "Gasto de Venta",
  "Gasto Nómina",
  "Gasto Administrativo",
  "Gasto Financiero",
] as const;

const NEW_ACCOUNT_TITLE: Record<string, string> = {
  revenue: "Nueva cuenta de ingreso",
  expense: "Nueva cuenta de gasto",
  asset: "Nueva cuenta de activo",
  liability: "Nueva cuenta de pasivo",
  equity: "Nueva cuenta de capital",
};

function Page() {
  const t = useT();
  const { tab } = Route.useSearch();
  const accounts = useAsync(() => listGlAccounts(), []);
  const maps = useAsync(() => listGlMappings(), []);
  const concepts = useAsync(() => listConcepts({ data: { kind: "gasto" } }), []);
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
    // Un gasto solo puede ir a una cuenta de resultados de gasto o costo: la
    // resolución del P&L descarta cualquier otra. Ofrecerlas dejaba guardar un
    // mapeo que decía "Guardado" y no hacía nada.
    const optsGasto = rows.filter(
      (a) => a.statement === "income" && (a.kind === "expense" || a.kind === "cogs"),
    );
    // Claves que viven en `gl_mappings` pero NO son conceptos del catálogo:
    // nombres heredados en inglés de gastos ya capturados. Sin esto no había
    // pantalla donde moverlos.
    const sistema = new Set(["ap", "ar", "revenue", "cogs", "bank_collections", "bank_billpay", "fx_result", "payroll"]);
    const nombresConcepto = new Set((concepts.data ?? []).map((c) => c.name));
    const heredados = Object.keys(mapObj)
      .filter((k) => !k.startsWith("partida:") && !sistema.has(k) && !nombresConcepto.has(k))
      .sort();
    return (
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("Accounting Automations")}</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("Required")}
            </span>
          </div>
          <p className="mb-5 text-sm text-muted">
            {t(
              "Accounting in Cosecha posts as you create sales, purchases, expenses and payments. Map the default accounts once — every document afterwards writes the entries.",
            )}
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
          <h3 className="mt-6 text-sm font-semibold">{t("BillPay & Collections")}</h3>
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
          <div className="mt-4">
            {/* Peso–dólar B: a qué cuenta va lo que se movió el dólar entre
                pactar en pesos y pagar. Sale de los pagos, no de un gasto. */}
            <Field label="Exchange result">
              <Select value={mapObj.fx_result || "58100"} onChange={(e) => setLocalMaps({ ...mapObj, fx_result: e.target.value })}>
                {rows.filter((a) => a.kind === "expense").map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            {/* Nómina (0052): el bruto de cada periodo cerrado va a esta cuenta.
                Un concepto de nómina mapeado aparte (Nomina Ventas…) gana
                sobre ella, igual que en los gastos. */}
            <Field label="Payroll">
              <Select value={mapObj.payroll || "52500"} onChange={(e) => setLocalMaps({ ...mapObj, payroll: e.target.value })}>
                {optsGasto.map((a) => (
                  <option key={a.number} value={a.number}>
                    {a.number} {a.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button className="mt-6" disabled={saving} onClick={() => void persistMaps()}>
            {t("Save mappings")}
          </Button>
          {mapSaved && !mapErr ? <p className="mt-2 text-sm text-ok">Guardado.</p> : null}
          {mapErr ? <p className="mt-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{mapErr}</p> : null}
        </section>
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t("Expense Accounts")}</h2>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {t("Required")}
            </span>
          </div>
          <p className="mb-5 text-sm text-muted">
            Estas cinco partidas son las de tu libro V8 y cubren{" "}
            <b>todo el catálogo</b>: cada concepto hereda la cuenta de su partida.
            Un concepto nuevo que agregues nace ya clasificado, en vez de caer en
            “General”.
          </p>
          <div className="grid gap-3">
            {PARTIDAS_GASTO.map((k) => {
              const key = `partida:${k}`;
              const cuantos = (concepts.data ?? []).filter((c) => c.partida === k).length;
              return (
                <div key={k} className="grid grid-cols-2 items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{k}</p>
                    <p className="text-xs text-muted">
                      {cuantos} {cuantos === 1 ? "concepto" : "conceptos"}
                    </p>
                  </div>
                  <Select
                    value={mapObj[key] || ""}
                    onChange={(e) => setLocalMaps({ ...mapObj, [key]: e.target.value })}
                  >
                    <option value="">Sin asignar — cae en General</option>
                    {optsGasto.map((a) => (
                      <option key={a.number} value={a.number}>
                        {a.number} {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>

          <h3 className="mt-7 text-sm font-semibold">Excepciones por concepto</h3>
          <p className="mb-4 mt-1 text-sm text-muted">
            Opcional. Solo si un concepto tiene que ir a una cuenta distinta de la
            de su partida. Lo que dejes en “Sigue a su partida” no es un hueco: es
            lo normal.
          </p>
          <div className="grid gap-2">
            {(concepts.data ?? []).map((c) => (
              <div key={`${c.partida}-${c.name}`} className="grid grid-cols-2 items-center gap-3">
                <div>
                  <p className="text-sm">{t(c.name)}</p>
                  <p className="text-xs text-subtle">{c.partida}</p>
                </div>
                {c.name === "Materia prima" ? (
                  // No es un mapeo que se elija: el costo de la fruta ya viene
                  // de la orden de compra. Mandarlo a una cuenta de costo la
                  // contaría dos veces, así que aquí no hay opción que dar.
                  <p className="rounded-md border border-warn/40 bg-warn/5 p-2 text-xs text-warn">
                    No se asigna. El costo de la fruta viene de la orden de compra;
                    capturarlo además como gasto la contaría dos veces. Va a
                    “General” a propósito, para que se note.
                  </p>
                ) : (
                  <Select
                    value={mapObj[c.name] || ""}
                    onChange={(e) => setLocalMaps({ ...mapObj, [c.name]: e.target.value })}
                  >
                    <option value="">Sigue a su partida</option>
                    {optsGasto.map((a) => (
                      <option key={a.number} value={a.number}>
                        {a.number} {a.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            ))}
          </div>

          {heredados.length ? (
            <>
              <h3 className="mt-7 text-sm font-semibold">Nombres heredados</h3>
              <p className="mb-4 mt-1 text-sm text-muted">
                Categorías en inglés de gastos capturados antes de que existiera el
                catálogo en español. No aparecen al capturar un gasto nuevo, pero
                los gastos viejos siguen usándolas.
              </p>
              <div className="grid gap-2">
                {heredados.map((k) => (
                  <div key={k} className="grid grid-cols-2 items-center gap-3">
                    <p className="text-sm">{t(k)}</p>
                    <Select
                      value={mapObj[k] || ""}
                      onChange={(e) => setLocalMaps({ ...mapObj, [k]: e.target.value })}
                    >
                      <option value="">Sin asignar — cae en General</option>
                      {optsGasto.map((a) => (
                        <option key={a.number} value={a.number}>
                          {a.number} {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* 8. El botón de guardar vivía en la OTRA tarjeta. Esta sección
              creció seis veces con este bloque: editar aquí y no volver allá
              perdía el cambio sin avisar. */}
          <div className="mt-6 flex items-center gap-3">
            <Button disabled={saving} onClick={persistMaps}>
              {saving ? "Guardando…" : "Guardar mapeos"}
            </Button>
            {mapSaved ? <span className="text-sm text-ok">Guardado.</span> : null}
            {mapErr ? <span className="text-sm text-danger">{mapErr}</span> : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="p-5">
      <TabActions>
        <span className="text-sm text-link">{t("Workspace")} {COMPANY.shortName}</span>
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
          title={NEW_ACCOUNT_TITLE[addKind] ?? `New ${addKind} account`}
          onClose={() => { setAddKind(null); setAddErr(null); }}
          footer={
            <>
              <Button variant="outline" onClick={() => setAddKind(null)}>
                {t("Cancel")}
              </Button>
              <Button disabled={saving || !form.number || !form.name} onClick={() => void addAccount(addKind, addKind === "asset" || addKind === "liability" || addKind === "equity" ? "balance" : "income")}>
                {t("Create")}
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
  const t = useT();
  return (
    <section className="mb-8">
      {title ? <h2 className="text-lg font-semibold text-ok">{t(title)}</h2> : null}
      <p className="mt-1 text-sm">
        <span className="font-medium">{t(subtitle)}</span>{" "}
        <span className="text-muted">{t("Total starting balance")}: {money(start)}</span>
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">{t("Number")}</th>
              <th className="px-3 py-2">{t("Name")}</th>
              <th className="px-3 py-2">{t("Description")}</th>
              <th className="px-3 py-2">{t("Subtype")}</th>
              <th className="px-3 py-2">{t("Tracking start date")}</th>
              <th className="px-3 py-2 text-right">{t("Starting balance")}</th>
              <th className="px-3 py-2 text-right">{t("Current balance")}</th>
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
                    {t("Edit")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="mt-2 text-sm text-link" onClick={onAdd}>
        + {t(addLabel)}
      </button>
    </section>
  );
}
