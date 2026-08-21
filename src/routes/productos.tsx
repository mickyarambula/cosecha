import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createProduct, createSku, listProducts, listValueLists } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { qty, skuCodeOf } from "@/lib/utils";

export const Route = createFileRoute("/productos")({ component: ProductosPage });

const EMPAQUES = ["Carton", "Clamshell", "Plastic Crate", "Caja"];
const CALIBRES = ["7 ct", "8 ct", "9 ct", "10 ct", "12 ct", "14 ct", "16 ct", "18 ct"];

function ProductosPage() {
  const { data, loading, error, reload } = useAsync(() => listProducts(), []);
  const vocab = useAsync(() => listValueLists(), []);
  const [open, setOpen] = useState(false);
  const [skuFor, setSkuFor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({ name: "", variety: "", category: "Fruta", default_unit: "caja", sku: "", pack_name: "", net_weight: "" });
  const [skuForm, setSkuForm] = useState({ empaque: "Carton", calibre: "10 ct", net_weight: "35" });
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

  return (
    <div>
      <PageHeader
        title="Pack-outs & repacks"
        subtitle="An inventory SKU is product × pack × count. Northgate orders PAP-CARTON-10CT, not just papaya."
        action={<Button onClick={() => setOpen(true)}>New product</Button>}
      />
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="mb-4">
        <Input placeholder="Search product, SKU or count…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3">
        {filtered.map((p) => {
          const matrixable = p.packs.some((k) => k.empaque && k.calibre);
          return (
            <Panel key={p.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    {p.name} {p.variety ? <span className="text-muted">· {p.variety}</span> : null}
                  </h2>
                  <p className="text-xs text-muted">
                    {p.sku} · {p.category ?? "Uncategorized"} · {p.packs.length} SKU
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSkuFor(p.id);
                    setSkuForm({ empaque: "Carton", calibre: "10 ct", net_weight: "35" });
                  }}
                >
                  Armar SKU
                </Button>
              </div>
              {matrixable ? (
                <SkuMatrix
                  packs={p.packs}
                  onFill={(emp, cal) => void addSku(p.id, emp, cal)}
                  saving={saving}
                />
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
            </Panel>
          );
        })}
      </div>

      {open ? (
        <Modal title="New product" onClose={() => setOpen(false)}>
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
              {saving ? "Saving…" : "Save"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {skuProduct ? (
        <Modal
          title="Armar SKU"
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
              {saving ? "Creating…" : "Create SKU"}
            </Button>
          </form>
        </Modal>
      ) : null}
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
      <p className="mt-2 text-[11px] text-subtle">{packs.filter((p) => p.sku_code).length} SKUs · empty slot builds the missing one</p>
    </div>
  );
}
