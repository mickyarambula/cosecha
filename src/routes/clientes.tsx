import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Modal } from "@/components/app-shell";
import { RoleBadges } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { createCustomer, listCustomers } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

export const Route = createFileRoute("/clientes")({ component: Page });

function Page() {
  const { data, loading, error, reload } = useAsync(() => listCustomers(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_name: "", phone: "", city: "", payment_terms: "Net 7", tambien_proveedor: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await createCustomer({
        data: {
          name: form.name,
          contact_name: form.contact_name || undefined,
          phone: form.phone || undefined,
          city: form.city || undefined,
          payment_terms: form.payment_terms || undefined,
          tambien_proveedor: form.tambien_proveedor || undefined,
        },
      });
      setOpen(false);
      setForm({ name: "", contact_name: "", phone: "", city: "", payment_terms: "Net 7", tambien_proveedor: false });
      setMsg(r.supplier_code ? `Cliente ${r.code} · también proveedor ${r.supplier_code}` : `Cliente ${r.code}`);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Mayoristas, retailers y growers que también te compran."
        action={<Button onClick={() => setOpen(true)}>Nuevo cliente</Button>}
      />
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Términos</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted">{c.city ?? ""}</div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadges proveedor={c.es_proveedor} cliente={c.es_cliente} />
                </td>
                <td className="px-4 py-3 text-muted">{c.contact_name ?? "—"} {c.phone ? `· ${c.phone}` : ""}</td>
                <td className="px-4 py-3">{c.payment_terms ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? (
        <Modal title="Nuevo cliente" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Nombre"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contacto"><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
              <Field label="Teléfono"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ciudad"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Términos">
                <Select value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
                  <option>COD</option>
                  <option>Net 7</option>
                  <option>Net 14</option>
                  <option>Net 21</option>
                </Select>
              </Field>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.tambien_proveedor}
                onChange={(e) => setForm({ ...form, tambien_proveedor: e.target.checked })}
              />
              También es proveedor (misma ficha en ambos lados)
            </label>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}