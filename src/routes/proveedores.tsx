import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal } from "@/components/app-shell";
import { PartySkuPanel } from "@/components/party-skus";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  cancelGrowerAdvance,
  createGrowerAdvance,
  createSupplier,
  getGrowerAccount,
  listLots,
  listSuppliers,
  updateSupplier,
} from "@/lib/produce-server";
import { useT } from "@/lib/i18n";
import { useAsync } from "@/lib/use-async";
import { cn, errorMessage, fecha, money, pct, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/proveedores")({ component: Page });

function Page() {
  const t = useT();
  const { data, loading, reload } = useAsync(() => listSuppliers(), []);
  const lots = useAsync(() => listLots(), []);
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [vtab, setVtab] = useState<"skus" | "lots" | "account" | "expenses" | "returns">("skus");
  const [advOpen, setAdvOpen] = useState(false);
  const [cancelArm, setCancelArm] = useState<number | null>(null);
  const [adv, setAdv] = useState({ concept: "", amount: "", date: todayISO(), po_id: "", notes: "" });
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", email: "", city: "", country: "USA", notes: "", tambien_cliente: false });
  const [edit, setEdit] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    city: "",
    country: "",
    notes: "",
    enabled: true,
    goods: true,
    services: true,
    commission_type: "",
    commission_rate: "",
  });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [advErr, setAdvErr] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const account = useAsync(
    () => (sel != null && vtab === "account" ? getGrowerAccount({ data: { supplier_id: sel } }) : Promise.resolve(null)),
    [sel, vtab],
  );

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((c) => !s || c.name.toLowerCase().includes(s));
  }, [data, q]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const c of list) {
      const letter = (c.name[0] || "#").toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), c]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const current = list.find((c) => c.id === sel) ?? null;

  function pick(id: number) {
    const c = (data ?? []).find((x) => x.id === id);
    if (!c) return;
    setSel(id);
    setEdit({
      name: c.name,
      contact_name: c.contact_name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      city: c.city ?? "",
      country: c.country ?? "",
      notes: c.notes ?? "",
      enabled: c.is_active,
      goods: true,
      services: true,
      commission_type: c.commission_type ?? "",
      commission_rate: c.commission_rate != null ? String(c.commission_rate) : "",
    });
    setEditErr(null);
    setCancelErr(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    try {
      await createSupplier({ data: { ...form, contact_name: form.contact_name || undefined } });
      setOpen(false);
      await reload();
    } catch (err) {
      setFormErr(errorMessage(err, "No se pudo agregar el proveedor."));
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    setEditErr(null);
    try {
      await updateSupplier({
        data: {
          id: current.id,
          name: edit.name,
          contact_name: edit.contact_name || undefined,
          phone: edit.phone || undefined,
          email: edit.email || undefined,
          city: edit.city || undefined,
          country: edit.country || undefined,
          notes: edit.notes || undefined,
          is_active: edit.enabled,
          commission_type: edit.commission_type
            ? (edit.commission_type as "per_unit" | "gross_pct" | "net_pct")
            : null,
          commission_rate: edit.commission_rate ? Number(edit.commission_rate) : null,
        },
      });
      await reload();
    } catch (err) {
      setEditErr(errorMessage(err, "No se pudo guardar el proveedor."));
    } finally {
      setSaving(false);
    }
  }

  async function saveAdvance() {
    if (!current || !adv.concept.trim() || !(Number(adv.amount) > 0)) return;
    setSaving(true);
    setAdvErr(null);
    try {
      await createGrowerAdvance({
        data: {
          supplier_id: current.id,
          concept: adv.concept,
          amount: Number(adv.amount),
          advance_date: adv.date || undefined,
          purchase_order_id: adv.po_id ? Number(adv.po_id) : undefined,
          notes: adv.notes || undefined,
        },
      });
      setAdvOpen(false);
      setAdv({ concept: "", amount: "", date: todayISO(), po_id: "", notes: "" });
      await account.reload();
    } catch (err) {
      setAdvErr(errorMessage(err, "No se pudo registrar el adelanto."));
    } finally {
      setSaving(false);
    }
  }

  async function cancelAdvance(id: number) {
    setSaving(true);
    setCancelErr(null);
    try {
      await cancelGrowerAdvance({ data: { advance_id: id } });
      setCancelArm(null);
      await account.reload();
    } catch (err) {
      setCancelErr(errorMessage(err, "No se pudo cancelar el adelanto."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)]">
      <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t("Vendors")}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              {t("Export all")}
            </Button>
            <Button size="sm" onClick={() => { setOpen(true); setFormErr(null); }}>
              {t("+ Add")}
            </Button>
          </div>
        </div>
        <div className="p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendors" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <p className="p-4 text-sm text-muted">{t("Loading…")}</p> : null}
          {groups.map(([letter, rows]) => (
            <div key={letter}>
              <p className="bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">{letter}</p>
              {rows.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className={cn(
                    "flex w-full flex-col items-start border-b border-border px-3 py-3 text-left text-sm font-medium",
                    sel === c.id ? "bg-action/8 ring-1 ring-inset ring-action" : "hover:bg-surface-2",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-5">
        {!current ? (
          <p className="pt-24 text-center text-muted">{t("Select a vendor to edit details")}</p>
        ) : (
          <div>
            <h1 className="mb-4 text-lg font-semibold">{t("Edit Vendor")}</h1>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <Field label="Vendor name">
                  <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </Field>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Net D">
                    <Input defaultValue="0" />
                  </Field>
                  <Field label="Vendor code">
                    <Input defaultValue={current.code} />
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Comisión Plein (default)">
                    <Select
                      value={edit.commission_type}
                      onChange={(e) => setEdit({ ...edit, commission_type: e.target.value })}
                    >
                      <option value="">Sin comisión</option>
                      <option value="per_unit">Por caja ($)</option>
                      <option value="gross_pct">% venta bruta</option>
                      <option value="net_pct">% sobre neto</option>
                    </Select>
                  </Field>
                  <Field label={edit.commission_type === "per_unit" ? "$ / caja" : "%"}>
                    <Input
                      value={edit.commission_rate}
                      onChange={(e) => setEdit({ ...edit, commission_rate: e.target.value })}
                    />
                  </Field>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  Se precarga en cada OC de consignación o comisión de este productor; editable por carga.
                </p>
              </div>
              <div className="space-y-2 pt-5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-action" checked={edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />
                  {t("Vendor is enabled and will be visible when creating orders")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-action" checked={edit.goods} onChange={(e) => setEdit({ ...edit, goods: e.target.checked })} />
                  {t("Goods vendor")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="size-4 accent-action" checked={edit.services} onChange={(e) => setEdit({ ...edit, services: e.target.checked })} />
                  {t("Services / Expenses vendor")}
                </label>
              </div>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">{t("Shipping Info")}</p>
                <Field label="Name">
                  <Input />
                </Field>
                <Field label="Address line 1" className="mt-2">
                  <Input />
                </Field>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="City">
                    <Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
                  </Field>
                  <Field label="State">
                    <Input />
                  </Field>
                  <Field label="Zip">
                    <Input />
                  </Field>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">{t("Billing Info")}</p>
                <Field label="Name">
                  <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </Field>
                <Field label="Address line 1" className="mt-2">
                  <Input />
                </Field>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Field label="City">
                    <Input />
                  </Field>
                  <Field label="State">
                    <Input />
                  </Field>
                  <Field label="Zip">
                    <Input />
                  </Field>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold">{t("Contacts")}</p>
              <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-4">
                <Input placeholder="Name" value={edit.contact_name} onChange={(e) => setEdit({ ...edit, contact_name: e.target.value })} />
                <Input placeholder="Phone" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
                <Input placeholder="Fax" />
                <Input placeholder="Email address" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
            </div>
            <Field label="Notes" className="mt-4">
              <Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex gap-4 text-sm">
                {(["skus", "lots", "account", "expenses", "returns"] as const).map((tabId) => (
                  <button
                    key={tabId}
                    type="button"
                    className={vtab === tabId ? "border-b-2 border-action pb-1 font-medium" : "pb-1 text-muted"}
                    onClick={() => setVtab(tabId)}
                  >
                    {tabId === "skus"
                      ? t("Preferred SKUs")
                      : tabId === "lots"
                        ? t("Lots")
                        : tabId === "account"
                          ? "Cuenta corriente"
                          : tabId === "expenses"
                            ? t("Expenses")
                            : t("Returns")}
                  </button>
                ))}
              </div>
              {vtab === "skus" ? (
                <div className="mt-3">
                  <PartySkuPanel partyKind="vendor" partyId={current.id} />
                </div>
              ) : vtab === "lots" ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-[11px] uppercase text-muted">
                      <tr>
                        <th className="px-2 py-2">{t("Source")}</th>
                        <th className="px-2 py-2">{t("Received")}</th>
                        <th className="px-2 py-2">{t("Lot #")}</th>
                        <th className="px-2 py-2 text-right">{t("Original")}</th>
                        <th className="px-2 py-2 text-right">{t("Remaining")}</th>
                        <th className="px-2 py-2 text-right">{t("Sold")}</th>
                        <th className="px-2 py-2 text-right">{t("Avg $/unit")}</th>
                        <th className="px-2 py-2 text-right">{t("Total sales")}</th>
                        <th className="px-2 py-2 text-right">{t("Profit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lots.data ?? [])
                        .filter((l) => l.supplier_name === current.name)
                        .map((l) => {
                          const cost = l.original_qty * l.unit_cost;
                          const profit = l.revenue - cost;
                          return (
                            <tr key={l.id} className="border-t border-border">
                              <td className="px-2 py-2 text-ok">{l.po_number || "—"}</td>
                              <td className="px-2 py-2">{fecha(l.received_date)}</td>
                              <td className="px-2 py-2">{l.lot_number}</td>
                              <td className="px-2 py-2 text-right">{l.original_qty}</td>
                              <td className="px-2 py-2 text-right">{l.current_qty}</td>
                              <td className="px-2 py-2 text-right">{l.sold_qty}</td>
                              <td className="px-2 py-2 text-right">{l.sold_qty ? money(l.revenue / l.sold_qty) : "—"}</td>
                              <td className="px-2 py-2 text-right">{money(l.revenue)}</td>
                              <td className="px-2 py-2 text-right">
                                {money(profit)} {l.revenue ? pct((profit / l.revenue) * 100) : ""}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              ) : vtab === "account" ? (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      Saldo vivo de adelantos:{" "}
                      <strong className={`tabular-nums ${(account.data?.balance ?? 0) > 0 ? "text-warn" : ""}`}>
                        {money(account.data?.balance ?? 0)}
                      </strong>
                    </p>
                    <div className="flex gap-2">
                      {current.share_token ? (
                        <a
                          href={`/doc/cuenta/${current.share_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border px-3 text-sm hover:bg-surface-2"
                        >
                          Estado de cuenta (PDF / enviar)
                        </a>
                      ) : null}
                      <Button size="sm" onClick={() => { setAdvOpen(true); setAdvErr(null); }}>
                        + Nuevo adelanto
                      </Button>
                    </div>
                  </div>
                  {account.loading ? <p className="mt-3 text-sm text-muted">{t("Loading…")}</p> : null}
                  {cancelErr ? <p className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{cancelErr}</p> : null}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-[11px] uppercase text-muted">
                        <tr>
                          <th className="px-2 py-2">#</th>
                          <th className="px-2 py-2">Fecha</th>
                          <th className="px-2 py-2">Concepto</th>
                          <th className="px-2 py-2">Carga</th>
                          <th className="px-2 py-2 text-right">Monto</th>
                          <th className="px-2 py-2 text-right">Recuperado</th>
                          <th className="px-2 py-2 text-right">Saldo</th>
                          <th className="px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {(account.data?.advances ?? []).map((a) => (
                          <tr key={a.id} className={`border-t border-border ${a.cancelled_at ? "text-subtle line-through" : ""}`}>
                            <td className="px-2 py-2 font-mono text-xs">{a.advance_number}</td>
                            <td className="px-2 py-2">{fecha(a.advance_date)}</td>
                            <td className="px-2 py-2">
                              {a.concept}
                              {a.notes ? <span className="ml-2 text-xs text-muted">{a.notes}</span> : null}
                            </td>
                            <td className="px-2 py-2">{a.po_number || "—"}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{money(a.amount)}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{money(a.recovered)}</td>
                            <td className="px-2 py-2 text-right tabular-nums font-medium">{money(a.balance)}</td>
                            <td className="px-2 py-2 text-right">
                              {!a.cancelled_at && a.recovered < 0.009 ? (
                                <button
                                  type="button"
                                  className="cursor-pointer text-xs text-danger"
                                  disabled={saving}
                                  onClick={() => (cancelArm === a.id ? void cancelAdvance(a.id) : setCancelArm(a.id))}
                                >
                                  {cancelArm === a.id ? "¿Seguro? Sí, cancelar" : "Cancelar"}
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                        {!account.loading && !(account.data?.advances ?? []).length ? (
                          <tr>
                            <td colSpan={8} className="px-2 py-4 text-muted">
                              Sin adelantos registrados para este productor.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  {(account.data?.applications ?? []).length ? (
                    <div className="mt-4">
                      <p className="mb-1 text-sm font-semibold">Recuperaciones</p>
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead className="text-[11px] uppercase text-muted">
                          <tr>
                            <th className="px-2 py-2">Fecha</th>
                            <th className="px-2 py-2">Adelanto</th>
                            <th className="px-2 py-2">Liquidación</th>
                            <th className="px-2 py-2 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(account.data?.applications ?? []).map((ap) => (
                            <tr key={`${ap.source}-${ap.id}`} className="border-t border-border">
                              <td className="px-2 py-2">{fecha(ap.created_at)}</td>
                              <td className="px-2 py-2 font-mono text-xs">
                                {ap.advance_number} <span className="font-sans text-muted">{ap.concept}</span>
                              </td>
                              <td className="px-2 py-2">
                                {ap.bill_number}
                                {ap.po_number ? <span className="ml-1 text-xs text-muted">· {ap.po_number}</span> : null}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums">−{money(ap.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  {vtab === "expenses"
                    ? t("Expenses for this vendor live in Finance → Expenses.")
                    : t("No returns recorded for this vendor.")}
                </p>
              )}
            </div>
            {editErr ? <p className="mt-4 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{editErr}</p> : null}
            <div className="mt-4 flex items-center justify-between">
              <button type="button" className="text-sm text-danger">
                {t("Delete vendor")}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSel(null)}>
                  {t("Cancel")}
                </Button>
                <Button disabled={saving} onClick={() => void save()}>
                  {t("Save changes")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      {advOpen && current ? (
        <Modal title={`Nuevo adelanto — ${current.name}`} onClose={() => setAdvOpen(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              <Input type="date" value={adv.date} onChange={(e) => setAdv({ ...adv, date: e.target.value })} />
            </Field>
            <Field label="Monto ($)">
              <Input value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: e.target.value })} />
            </Field>
            <Field label="Concepto">
              <Input
                placeholder="Flete / Pick and pack / Semilla / Efectivo…"
                value={adv.concept}
                onChange={(e) => setAdv({ ...adv, concept: e.target.value })}
              />
            </Field>
            <Field label="Ligado a carga (opcional)">
              <Select value={adv.po_id} onChange={(e) => setAdv({ ...adv, po_id: e.target.value })}>
                <option value="">Sin carga — apoyo general</option>
                {(account.data?.pos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.po_number}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Nota" className="mt-3">
            <Textarea value={adv.notes} onChange={(e) => setAdv({ ...adv, notes: e.target.value })} />
          </Field>
          <p className="mt-3 text-xs text-muted">
            El adelanto sale de caja y queda como cuenta por cobrar al productor — no es un gasto. Se recupera contra
            liquidaciones futuras, cuando tú decidas.
          </p>
          {advErr ? <p className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{advErr}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAdvOpen(false)}>
              {t("Cancel")}
            </Button>
            <Button disabled={saving || !adv.concept.trim() || !(Number(adv.amount) > 0)} onClick={() => void saveAdvance()}>
              Registrar adelanto
            </Button>
          </div>
        </Modal>
      ) : null}
      {open ? (
        <Modal title={t("Add vendor")} onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Vendor name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            {formErr ? <p className="rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{formErr}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {t("Add")}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
