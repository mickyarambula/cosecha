import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createSupplier, listSuppliers } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

export const Route = createFileRoute("/proveedores")({ component: Page });

function Page() {
  const { data, loading, error, reload } = useAsync(() => listSuppliers(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", city: "", country: "México", notes: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createSupplier({
        data: {
          name: form.name,
          contact_name: form.contact_name || undefined,
          phone: form.phone || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
          notes: form.notes || undefined,
        },
      });
      setOpen(false);
      setForm({ name: "", contact_name: "", phone: "", city: "", country: "México", notes: "" });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Proveedores" subtitle="Growers y packers." action={<Button onClick={() => setOpen(true)}>Nuevo proveedor</Button>} />
      {loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Ciudad</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-muted">
                  {s.contact_name ?? "—"} {s.phone ? `· ${s.phone}` : ""}
                </td>
                <td className="px-4 py-3 text-muted">{[s.city, s.country].filter(Boolean).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal title="Nuevo proveedor" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Nombre comercial">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contacto">
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Field>
              <Field label="Teléfono">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ciudad">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label="País">
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </Field>
            </div>
            <Field label="Notas">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
