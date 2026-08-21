import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createProduct, listProducts } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { qty } from "@/lib/utils";

export const Route = createFileRoute("/productos")({ component: ProductosPage });

function ProductosPage() {
  const { data, loading, error, reload } = useAsync(() => listProducts(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", variety: "", category: "Fruta", default_unit: "caja", sku: "", pack_name: "", net_weight: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo, variedades y empaques."
        action={<Button onClick={() => setOpen(true)}>Nuevo producto</Button>}
      />
      {loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="grid gap-3">
        {(data ?? []).map((p) => (
          <Panel key={p.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold">
                  {p.name} {p.variety ? <span className="text-muted">· {p.variety}</span> : null}
                </h2>
                <p className="text-xs text-muted">
                  {p.sku} · {p.category ?? "Sin categoría"} · unidad {p.default_unit}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.packs.map((pack) => (
                <span key={pack.id} className="rounded-md bg-surface-2 px-2.5 py-1 text-xs text-fg">
                  {pack.name}
                  {pack.net_weight ? ` · ${qty(pack.net_weight, pack.weight_unit)}` : ""}
                </span>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      {open ? (
        <Modal title="Nuevo producto" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Nombre">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Variedad">
                <Input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} />
              </Field>
              <Field label="Categoría">
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
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
