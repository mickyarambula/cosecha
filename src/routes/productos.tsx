import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal, TabActions } from "@/components/app-shell";
import { PartySkuPanel, ProductPartyPanel } from "@/components/party-skus";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { createPackOut, createProduct, createSku, listCustomers, listLocations, listLots, listPackOuts, listProducts, listSuppliers, listValueLists } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { convertWeight } from "@/lib/units";
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
  const [chargedTo, setChargedTo] = useState<"" | "grower" | "plein">("");
  const [reason, setReason] = useState("");
  const [manualLb, setManualLb] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "danger" } | null>(null);

  // SKU → peso neto en libras (null si el catálogo no lo trae).
  const packById = useMemo(() => {
    const m = new Map<number, { label: string; sku: string; lb: number | null }>();
    for (const p of products.data ?? [])
      for (const k of p.packs) {
        const lb =
          k.net_weight != null && k.net_weight > 0
            ? convertWeight(k.net_weight, k.weight_unit || "lb", "lb")
            : null;
        m.set(k.id, { label: `${k.sku_code || k.name} · ${p.name}`, sku: k.sku_code || k.name, lb });
      }
    return m;
  }, [products.data]);
  const skuOpts = (products.data ?? []).flatMap((p) =>
    p.packs.filter((k) => k.sku_code).map((k) => ({ id: k.id, label: `${k.sku_code} · ${p.name}` })),
  );

  // Solo lotes activos, con existencia, sin hold y ligados a una carga: un
  // lote sin carga no se puede reempacar (la liquidación no sabría a quién
  // reportarlo). El servidor repite el candado.
  const active = (lots.data ?? []).filter((l) => l.current_qty > 0 && l.status === "active" && !l.held);
  const withPo = active.filter((l) => l.purchase_order_id != null);
  const withoutPo = active.length - withPo.length;
  const selected = withPo
    .filter((l) => Number(src[l.id]) > 0)
    .map((l) => ({ ...l, take: Number(src[l.id]) }));
  const selectedPo = selected[0]?.purchase_order_id ?? null;
  const selectedPoNumber = selected[0]?.po_number ?? null;
  // Al elegir el primer lote, la lista se cierra a su carga: un reempaque
  // nunca mezcla cargas (PACA).
  const visible = selectedPo == null ? withPo : withPo.filter((l) => l.purchase_order_id === selectedPo);

  const dest = destPack ? packById.get(Number(destPack)) : undefined;
  const consumed = selected.reduce((a, l) => a + l.take, 0);
  const produced = Number(destQty) || 0;
  const sameSku = selected.length > 0 && !!destPack && selected.every((l) => l.pack_style_id === Number(destPack));
  const missingWeights = (() => {
    if (sameSku || !dest || !selected.length) return [] as string[];
    const out = new Set<string>();
    if (dest.lb == null) out.add(dest.sku);
    for (const l of selected) {
      const k = l.pack_style_id != null ? packById.get(l.pack_style_id) : undefined;
      if (!k || k.lb == null) out.add(k?.sku || l.lot_number);
    }
    return [...out];
  })();
  const consumedLb = sameSku
    ? null
    : selected.reduce((a, l) => {
        const k = l.pack_style_id != null ? packById.get(l.pack_style_id) : undefined;
        return a + (k?.lb ?? 0) * l.take;
      }, 0);
  const producedLb = !sameSku && dest?.lb != null ? produced * dest.lb : null;
  const shrinkUnit: "caja" | "lb" = sameSku ? "caja" : "lb";
  const shrink: number | null = !selected.length || !dest
    ? null
    : sameSku
      ? consumed - produced
      : missingWeights.length
        ? manualLb === "" ? null : Number(manualLb)
        : (consumedLb ?? 0) - (producedLb ?? 0);
  const shrinkRounded = shrink == null ? null : Math.round(shrink * 1000) / 1000;
  const hasShrink = shrinkRounded != null && shrinkRounded > 0.0005;
  const negative = shrinkRounded != null && shrinkRounded < (sameSku ? -0.0005 : -0.5);
  const needsManual = missingWeights.length > 0 && manualLb === "";
  const shrinkIncomplete = hasShrink && (!chargedTo || !reason.trim());
  const canRun =
    !saving && selected.length > 0 && !!destPack && produced > 0 && !negative && !needsManual && !shrinkIncomplete;

  function reset() {
    setSrc({});
    setDestQty("");
    setChargedTo("");
    setReason("");
    setManualLb("");
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!canRun) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await createPackOut({
        data: {
          location_id: Number(locationId || locs.data?.[0]?.id),
          notes: notes || undefined,
          sources: selected.map((l) => ({ lot_id: l.id, qty: l.take })),
          dest_pack_style_id: Number(destPack),
          dest_qty: produced,
          shrink_charged_to: hasShrink && chargedTo ? chargedTo : undefined,
          shrink_reason: hasShrink ? reason.trim() : undefined,
          shrink_manual_lb: missingWeights.length && manualLb !== "" ? Number(manualLb) : undefined,
        },
      });
      setOpen(false);
      reset();
      setMsg({
        text: `${r.pack_number} → lote ${r.lot_number}${
          r.shrink_qty > 0 ? ` · merma ${qty(r.shrink_qty, r.shrink_unit ?? undefined)}` : " · sin merma"
        }`,
        tone: "ok",
      });
      await Promise.all([lots.reload(), history.reload()]);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "No se pudo reempacar", tone: "danger" });
    } finally {
      setSaving(false);
    }
  }

  const shrinkLabel = (v: number, unit: "caja" | "lb") =>
    unit === "lb" ? `${qty(v)} lb` : `${qty(v)} ${v === 1 ? "caja" : "cajas"}`;

  return (
    <div>
      <TabActions>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t("New pack-out")}
        </Button>
      </TabActions>
      <div className="border-b border-border px-5 py-3">
        <p className="text-sm text-muted">
          El reempaque convierte cajas de una carga en otro SKU (bin → caja, o re-selección del
          mismo SKU). Solo se reempaca fruta de una misma carga y la merma queda registrada para la
          liquidación del productor.
        </p>
      </div>
      {msg ? (
        <p className={`px-5 py-2 text-sm ${msg.tone === "ok" ? "text-ok" : "text-danger"}`}>{msg.text}</p>
      ) : null}
      <div className="grid gap-3 p-4">
        {(history.data ?? []).map((h) => (
          <div key={h.id} className="rounded-lg border border-border bg-surface p-4">
            <p className="font-mono text-xs text-muted">
              {h.pack_number} · {fecha(h.pack_date)} {h.location_name ? `· ${h.location_name}` : ""}
              {h.po_number ? ` · carga ${h.po_number}` : ""}
            </p>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[11px] uppercase text-muted">Entraron</p>
                {h.ins.map((l, i) => (
                  <p key={i}>
                    {l.qty} {l.unit} {l.product_name} <span className="font-mono text-xs text-subtle">{l.lot_number}</span>
                  </p>
                ))}
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted">Salieron</p>
                {h.outs.map((l, i) => (
                  <p key={i}>
                    {l.qty} {l.unit} {l.sku_code || l.product_name} <span className="font-mono text-xs text-subtle">{l.lot_number}</span>
                  </p>
                ))}
              </div>
            </div>
            <p className={`mt-2 text-xs ${h.shrink_qty > 0 ? "text-warn" : "text-muted"}`}>
              {h.shrink_qty > 0
                ? `Merma: ${shrinkLabel(h.shrink_qty, h.shrink_unit === "lb" ? "lb" : "caja")} — ${
                    h.shrink_charged_to === "plein" ? "la absorbe Plein (se paga al productor)" : "la absorbe el productor"
                  }${h.shrink_reason ? ` — ${h.shrink_reason}` : ""}`
                : "Sin merma"}
            </p>
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-muted">Lotes que entran</p>
              {selectedPo != null ? (
                <span className="flex items-center gap-2 text-xs text-muted">
                  Carga <span className="font-mono">{selectedPoNumber}</span> — solo se muestran lotes de esta carga.
                  <button
                    type="button"
                    className="cursor-pointer text-link underline-offset-2 hover:underline"
                    onClick={() => setSrc({})}
                  >
                    Cambiar de carga
                  </button>
                </span>
              ) : null}
            </div>
            <div className="max-h-48 overflow-auto rounded-md border border-border">
              {visible.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-0">
                  <span className="flex-1">
                    {l.lot_number} · {l.product_name}
                    {l.pack_name ? ` · ${l.pack_name}` : ""}{" "}
                    <span className="text-xs text-muted">
                      {qty(l.current_qty, l.unit)}
                      {l.po_number ? ` · carga ${l.po_number}` : ""}
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
              {!visible.length ? (
                <p className="px-3 py-2 text-sm text-muted">No hay lotes con existencia ligados a una carga.</p>
              ) : null}
            </div>
            {withoutPo > 0 ? (
              <p className="text-xs text-muted">
                {withoutPo === 1 ? "1 lote sin carga no aparece" : `${withoutPo} lotes sin carga no aparecen`}: un lote
                que no está ligado a una orden de compra no se puede reempacar.
              </p>
            ) : null}
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
            <Field label="Cajas que salen">
              <Input required type="number" min="0.01" step="0.01" value={destQty} onChange={(e) => setDestQty(e.target.value)} />
            </Field>
            {selected.length && dest ? (
              <div className="rounded-md border border-border bg-surface-2 p-3 text-sm">
                {sameSku ? (
                  <p>
                    Entran <strong>{qty(consumed)}</strong> cajas · Salen <strong>{qty(produced)}</strong> cajas ·
                    Merma{" "}
                    <strong className={hasShrink ? "text-warn" : negative ? "text-danger" : ""}>
                      {shrinkRounded == null ? "—" : qty(shrinkRounded)} cajas
                    </strong>
                  </p>
                ) : missingWeights.length ? (
                  <>
                    <p className="text-danger">
                      No se puede calcular la merma por peso: {missingWeights.join(", ")} no tiene peso neto en
                      el catálogo. Captúralo en Productos & SKUs, o captura la merma a mano en libras.
                    </p>
                    <Field label="Merma a mano (lb)">
                      <Input
                        className="w-32"
                        type="number"
                        min="0"
                        step="0.01"
                        value={manualLb}
                        onChange={(e) => setManualLb(e.target.value)}
                      />
                    </Field>
                  </>
                ) : (
                  <p>
                    Entran <strong>{qty(consumedLb ?? 0)}</strong> lb ({qty(consumed)} cajas) · Salen{" "}
                    <strong>{qty(producedLb ?? 0)}</strong> lb ({qty(produced)} cajas de {qty(dest.lb ?? 0)} lb) · Merma{" "}
                    <strong className={hasShrink ? "text-warn" : negative ? "text-danger" : ""}>
                      {shrinkRounded == null ? "—" : qty(shrinkRounded)} lb
                    </strong>
                    <span className="ml-1 text-xs text-muted">(pesos netos del catálogo)</span>
                  </p>
                )}
                {negative ? (
                  <p className="mt-1 text-xs text-danger">
                    Sale más de lo que entra. Revisa las cantidades{sameSku ? "" : " o los pesos netos del catálogo"}.
                  </p>
                ) : null}
                {hasShrink ? (
                  <div className="mt-2 grid gap-2 border-t border-border pt-2">
                    <p className="text-xs font-semibold uppercase text-muted">
                      ¿Quién absorbe la merma de {shrinkLabel(shrinkRounded ?? 0, shrinkUnit)}?
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="shrink_charged_to"
                          checked={chargedTo === "grower"}
                          onChange={() => setChargedTo("grower")}
                        />
                        El productor
                        <span className="text-xs text-muted">(se reporta sin monto)</span>
                      </label>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="shrink_charged_to"
                          checked={chargedTo === "plein"}
                          onChange={() => setChargedTo("plein")}
                        />
                        Plein
                        <span className="text-xs text-muted">(se le paga al productor al promedio realizado)</span>
                      </label>
                    </div>
                    <Field label="Motivo de la merma">
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Ej. fruta golpeada en la re-selección"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Field label="Notes">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button type="submit" disabled={!canRun}>
              {saving ? t("Saving…") : t("Run pack-out")}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
