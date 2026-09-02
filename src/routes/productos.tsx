import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal, TabActions } from "@/components/app-shell";
import { PartySkuPanel, ProductPartyPanel } from "@/components/party-skus";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { createPackOut, createProduct, createSku, listCustomers, listLocations, listLots, listPackOuts, listProducts, listSuppliers, listValueLists } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, qty, skuCodeOf } from "@/lib/utils";

type Search = { tab?: "catalog" | "repack" };
export const Route = createFileRoute("/productos")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "repack" ? "repack" : "catalog",
  }),
  component: ProductosPage,
});

const EMPAQUES = ["Caja", "Clamshell", "Bin", "Saco", "Bolsa", "Manojo"];
const CALIBRES = ["6 ct", "7 ct", "8 ct", "9 ct", "10 ct", "12 ct", "14 ct", "16 ct", "18 ct"];

function ProductosPage() {
  const t = useT();
  const { tab } = Route.useSearch();
  const { data, loading, error, reload } = useAsync(() => listProducts(), []);
  const vocab = useAsync(() => listValueLists(), []);
  const customers = useAsync(() => listCustomers(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const [open, setOpen] = useState(false);
  const [skuFor, setSkuFor] = useState<number | null>(null);
  const [linkFor, setLinkFor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", variety: "", category: "Fruta", default_unit: "caja", sku: "", pack_name: "", net_weight: "" });
  const [skuForm, setSkuForm] = useState({ empaque: "Caja", calibre: "10 ct", net_weight: "35" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const list = data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((p) => {
      const blob = `${p.sku} ${p.name} ${p.variety ?? ""} ${p.packs.map((k) => `${k.sku_code ?? ""} ${k.calibre ?? ""} ${k.empaque ?? ""}`).join(" ")}`.toLowerCase();
      return blob.includes(s);
    });
  }, [list, q]);

  const skuProduct = list.find((p) => p.id === skuFor) ?? null;
  const linkProduct = list.find((p) => p.id === linkFor) ?? null;
  const empaques = (vocab.data?.empaque ?? []).map((r) => r.value);
  const calibres = (vocab.data?.calibre ?? []).map((r) => r.value);
  const empOpts = empaques.length ? empaques : EMPAQUES;
  const calOpts = calibres.length ? calibres : CALIBRES;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await createProduct({
        data: {
          name: form.name,
          variety: form.variety || undefined,
          category: form.category || undefined,
          default_unit: form.default_unit,
          sku: form.sku || undefined,
          pack_name: form.pack_name || undefined,
          net_weight: form.net_weight ? Number(form.net_weight) : undefined,
        },
      });
      setOpen(false);
      setForm({ name: "", variety: "", category: "Fruta", default_unit: "caja", sku: "", pack_name: "", net_weight: "" });
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  async function addSku(productId: number, empaque: string, calibre: string, net_weight?: number) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await createSku({
        data: {
          product_id: productId,
          empaque,
          calibre,
          net_weight,
          weight_unit: "lb",
        },
      });
      setMsg(`SKU ${r.sku_code} creado`);
      setSkuFor(null);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo armar el SKU");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "repack") {
    return <PackOutTab />;
  }

  return (
    <div>
      <TabActions>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t("New product")}
        </Button>
      </TabActions>
      <div className="border-b border-border px-5 py-3">
        <p className="text-sm text-muted">{t("Inventory shows stock on hand. Create products and SKUs here.")}</p>
        <p className="text-xs text-subtle">
          {t("An inventory SKU is product × pack × count. Northgate orders PAPA-MARA-CAJA-10CT, not just papaya.")}
        </p>
      </div>
      {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
      {loading ? <p className="px-5 py-3 text-sm text-muted">{t("Loading…")}</p> : null}
      {error ? <p className="px-5 py-3 text-sm text-danger">{error}</p> : null}
      <div className="p-4">
        <Input placeholder={t("Search product, SKU or count…")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 px-4 pb-8">
        {filtered.map((p) => {
          const matrixable = p.packs.some((k) => k.empaque && k.calibre);
          return (
            <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    {p.name} {p.variety ? <span className="text-muted">· {p.variety}</span> : null}
                  </h2>
                  <p className="text-xs text-muted">
                    {p.sku} · {p.category ?? t("Uncategorized")} · {p.packs.length} SKU
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setLinkFor(p.id)}>
                    {t("Preferred SKUs")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSkuFor(p.id);
                      setSkuForm({ empaque: "Caja", calibre: "10 ct", net_weight: "35" });
                    }}
                  >
                    {t("Build SKU")}
                  </Button>
                </div>
              </div>
              {matrixable ? (
                <SkuMatrix packs={p.packs} onFill={(emp, cal) => void addSku(p.id, emp, cal)} saving={saving} />
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.packs.map((pack) => (
                    <span key={pack.id} className="rounded-md bg-surface-2 px-2.5 py-1 text-xs text-fg">
                      {pack.sku_code || pack.name}
                      {pack.net_weight ? ` · ${qty(pack.net_weight, pack.weight_unit)}` : ""}
                    </span>
                  ))}
                </div>
              )}
              <ProductPartyPanel productId={p.id} />
            </div>
          );
        })}
      </div>

      {open ? (
        <Modal title={t("New product")} onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Nombre">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Variedad">
                <Input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} />
              </Field>
              <Field label="Category">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option>Fruta</option>
                  <option>Verdura</option>
                  <option>Cítrico</option>
                  <option>Hierba</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU (opcional)">
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </Field>
              <Field label="Unidad">
                <Select value={form.default_unit} onChange={(e) => setForm({ ...form, default_unit: e.target.value })}>
                  <option value="caja">caja</option>
                  <option value="saco">saco</option>
                  <option value="kg">kg</option>
                  <option value="bin">bin</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Empaque">
                <Input placeholder="Caja 10 kg" value={form.pack_name} onChange={(e) => setForm({ ...form, pack_name: e.target.value })} />
              </Field>
              <Field label="Peso neto (kg)">
                <Input type="number" step="0.01" value={form.net_weight} onChange={(e) => setForm({ ...form, net_weight: e.target.value })} />
              </Field>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving…") : t("Save")}
            </Button>
          </form>
        </Modal>
      ) : null}

      {skuProduct ? (
        <Modal
          title={t("Build SKU")}
          subtitle={`${skuProduct.name} ${skuProduct.variety ?? ""} · ${skuCodeOf(skuProduct.sku, skuForm.empaque, skuForm.calibre)}`}
          onClose={() => setSkuFor(null)}
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void addSku(skuProduct.id, skuForm.empaque, skuForm.calibre, skuForm.net_weight ? Number(skuForm.net_weight) : undefined);
            }}
          >
            <Field label="Empaque">
              <Select value={skuForm.empaque} onChange={(e) => setSkuForm({ ...skuForm, empaque: e.target.value })}>
                {empOpts.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </Select>
            </Field>
            <Field label="Calibre">
              <Select value={skuForm.calibre} onChange={(e) => setSkuForm({ ...skuForm, calibre: e.target.value })}>
                {calOpts.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Peso neto (lb)">
              <Input type="number" step="0.01" value={skuForm.net_weight} onChange={(e) => setSkuForm({ ...skuForm, net_weight: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? t("Creating…") : t("Create SKU")}
            </Button>
          </form>
        </Modal>
      ) : null}

      {linkProduct ? (
        <Modal title={`${linkProduct.name} · ${t("Preferred SKUs")}`} onClose={() => setLinkFor(null)}>
          <PartyLinksForProduct productId={linkProduct.id} customers={customers.data ?? []} vendors={suppliers.data ?? []} />
        </Modal>
      ) : null}
    </div>
  );
}

function PartyLinksForProduct({
  productId,
  customers,
  vendors,
}: {
  productId: number;
  customers: { id: number; name: string }[];
  vendors: { id: number; name: string }[];
}) {
  const t = useT();
  const [kind, setKind] = useState<"customer" | "vendor">("customer");
  const [partyId, setPartyId] = useState("");
  const parties = kind === "customer" ? customers : vendors;
  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={`rounded-md border px-3 py-2 text-sm ${kind === "customer" ? "border-action text-action" : "border-border"}`}
          onClick={() => {
            setKind("customer");
            setPartyId("");
          }}
        >
          {t("Customers")}
        </button>
        <button
          type="button"
          className={`rounded-md border px-3 py-2 text-sm ${kind === "vendor" ? "border-action text-action" : "border-border"}`}
          onClick={() => {
            setKind("vendor");
            setPartyId("");
          }}
        >
          {t("Vendors")}
        </button>
      </div>
      <Field label={kind === "customer" ? t("Customer") : t("Vendor")}>
        <Select value={partyId} onChange={(e) => setPartyId(e.target.value)}>
          <option value="">{t("Select")}</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      {partyId ? <PartySkuPanel partyKind={kind} partyId={Number(partyId)} /> : <ProductPartyPanel productId={productId} />}
    </div>
  );
}

function SkuMatrix({
  packs,
  onFill,
  saving,
}: {
  packs: { id: number; sku_code?: string | null; empaque?: string | null; calibre?: string | null; net_weight: number | null; weight_unit: string }[];
  onFill: (empaque: string, calibre: string) => void;
  saving: boolean;
}) {
  const t = useT();
  const empaques = Array.from(new Set(packs.map((p) => p.empaque).filter(Boolean) as string[]));
  const calibres = Array.from(new Set(packs.map((p) => p.calibre).filter(Boolean) as string[])).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10),
  );
  const cell = (emp: string, cal: string) => packs.find((p) => p.empaque === emp && p.calibre === cal);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="text-muted">
            <th className="py-2 pr-3 font-medium">Calibre</th>
            {empaques.map((e) => (
              <th key={e} className="px-2 py-2 font-medium">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calibres.map((cal) => (
            <tr key={cal} className="border-t border-border">
              <td className="py-2 pr-3 font-medium whitespace-nowrap">{cal}</td>
              {empaques.map((emp) => {
                const hit = cell(emp, cal);
                return (
                  <td key={emp} className="px-2 py-2">
                    {hit ? (
                      <div>
                        <span className="font-mono text-[11px]">{hit.sku_code}</span>
                        {hit.net_weight ? (
                          <span className="ml-1 text-subtle">
                            {qty(hit.net_weight)} {hit.weight_unit}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onFill(emp, cal)}
                        className="rounded-md px-2 py-1 text-subtle hover:bg-surface-2 hover:text-fg"
                      >
                        +
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-subtle">
        {packs.filter((p) => p.sku_code).length} SKUs · {t("empty slot builds the missing one")}
      </p>
    </div>
  );
}

function PackOutTab() {
  const t = useT();
  const lots = useAsync(() => listLots(), []);
  const products = useAsync(() => listProducts(), []);
  const locs = useAsync(() => listLocations(), []);
  const history = useAsync(() => listPackOuts(), []);
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<Record<number, string>>({});
  const [destPack, setDestPack] = useState("");
  const [destQty, setDestQty] = useState("");
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onHand = (lots.data ?? []).filter((l) => l.current_qty > 0 && l.status === "active");
  const skuOpts = (products.data ?? []).flatMap((p) =>
    p.packs.filter((k) => k.sku_code).map((k) => ({ id: k.id, label: `${k.sku_code} · ${p.name}` })),
  );

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const sources = Object.entries(src)
      .map(([id, q]) => ({ lot_id: Number(id), qty: Number(q) }))
      .filter((s) => s.qty > 0);
    if (!sources.length || !destPack || !destQty) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await createPackOut({
        data: {
          location_id: Number(locationId || locs.data?.[0]?.id),
          notes: notes || undefined,
          sources,
          dest_pack_style_id: Number(destPack),
          dest_qty: Number(destQty),
        },
      });
      setOpen(false);
      setSrc({});
      setDestQty("");
      setMsg(`${r.pack_number} → ${r.lot_number}`);
      await Promise.all([lots.reload(), history.reload()]);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo reempacar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <TabActions>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t("New pack-out")}
        </Button>
      </TabActions>
      <div className="border-b border-border px-5 py-3">
        <p className="text-sm text-muted">{t("Pack-outs convert a lot into another SKU (bin → carton). Create the destination SKUs in Catalog first.")}</p>
      </div>
      {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
      <div className="grid gap-3 p-4">
        {(history.data ?? []).map((h) => (
          <div key={h.id} className="rounded-lg border border-border bg-surface p-4">
            <p className="font-mono text-xs text-muted">
              {h.pack_number} · {fecha(h.pack_date)} {h.location_name ? `· ${h.location_name}` : ""}
            </p>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase text-muted">{t("Consumed")}</p>
                {h.ins.map((l, i) => (
                  <p key={i}>
                    {l.qty} {l.unit} {l.product_name} <span className="font-mono text-xs text-subtle">{l.lot_number}</span>
                  </p>
                ))}
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted">{t("Produced")}</p>
                {h.outs.map((l, i) => (
                  <p key={i}>
                    {l.qty} {l.unit} {l.sku_code || l.product_name} <span className="font-mono text-xs text-subtle">{l.lot_number}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
        {!history.loading && !(history.data ?? []).length ? <p className="text-sm text-muted">{t("No pack-outs yet.")}</p> : null}
      </div>
      {open ? (
        <Modal title={t("New pack-out")} onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={run}>
            <Field label="Location">
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">{t("Default")}</option>
                {(locs.data ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs font-semibold uppercase text-muted">{t("Consume lots")}</p>
            <div className="max-h-48 overflow-auto rounded-md border border-border">
              {onHand.map((l) => (
                <label key={l.id} className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
                  <span className="flex-1">
                    {l.lot_number} · {l.product_name}{" "}
                    <span className="text-xs text-muted">
                      {qty(l.current_qty, l.unit)}
                    </span>
                  </span>
                  <Input
                    className="w-24"
                    type="number"
                    min="0"
                    step="0.01"
                    max={l.current_qty}
                    value={src[l.id] ?? ""}
                    onChange={(e) => setSrc((s) => ({ ...s, [l.id]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <Field label={t("Destination SKU")}>
              <Select required value={destPack} onChange={(e) => setDestPack(e.target.value)}>
                <option value="">{t("Select SKU")}</option>
                {skuOpts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("Qty produced")}>
              <Input required type="number" min="0.01" step="0.01" value={destQty} onChange={(e) => setDestQty(e.target.value)} />
            </Field>
            <Field label="Notes">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving…") : t("Run pack-out")}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

