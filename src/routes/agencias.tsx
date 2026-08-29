import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createCustomsBroker, listCustomsBrokers, listSuppliers, updateCustomsBroker } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

export const Route = createFileRoute("/agencias")({ component: Page });

type Broker = Awaited<ReturnType<typeof listCustomsBrokers>>[number];

function emptyForm() {
  return {
    name: "",
    country: "MX",
    license_number: "",
    contact_name: "",
    phone: "",
    email: "",
    supplier_id: "",
    notes: "",
  };
}

function Page() {
  const brokers = useAsync(() => listCustomsBrokers(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Broker | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (brokers.data ?? [])
      .filter((b) => showInactive || b.is_active)
      .filter((b) => !s || b.name.toLowerCase().includes(s) || (b.supplier_name ?? "").toLowerCase().includes(s));
  }, [brokers.data, q, showInactive]);

  function openCreate() {
    setForm(emptyForm());
    setErr(null);
    setCreating(true);
  }

  function openEdit(b: Broker) {
    setForm({
      name: b.name,
      country: b.country,
      license_number: b.license_number ?? "",
      contact_name: b.contact_name ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      supplier_id: b.supplier_id != null ? String(b.supplier_id) : "",
      notes: b.notes ?? "",
    });
    setErr(null);
    setEditing(b);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: form.name,
        country: form.country as "MX" | "US",
        license_number: form.license_number || undefined,
        contact_name: form.contact_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        notes: form.notes || undefined,
      };
      if (editing) {
        await updateCustomsBroker({ data: { ...payload, id: editing.id, is_active: editing.is_active } });
      } else {
        await createCustomsBroker({ data: payload });
      }
      setCreating(false);
      setEditing(null);
      await brokers.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Broker) {
    await updateCustomsBroker({
      data: {
        id: b.id,
        name: b.name,
        country: b.country as "MX" | "US",
        license_number: b.license_number ?? undefined,
        contact_name: b.contact_name ?? undefined,
        phone: b.phone ?? undefined,
        email: b.email ?? undefined,
        supplier_id: b.supplier_id,
        notes: b.notes ?? undefined,
        is_active: !b.is_active,
      },
    });
    await brokers.reload();
  }

  const modalOpen = creating || editing != null;

  return (
    <div className="p-5">
      <PageHeader
        title="Agencias aduanales"
        subtitle="Agencias mexicanas y americanas usadas al cruzar mercancía."
        action={<Button onClick={openCreate}>+ Agregar agencia</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar agencia o proveedor…" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="size-4 accent-action" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Ver inactivas
        </label>
      </div>
      {brokers.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Agencia</th>
              <th className="px-4 py-3 font-medium">País</th>
              <th className="px-4 py-3 font-medium">Licencia</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Proveedor ligado</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3 text-muted">{b.country}</td>
                <td className="px-4 py-3 text-muted">{b.license_number || "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {b.contact_name || "—"}
                  {b.phone ? <div className="text-xs">{b.phone}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted">{b.supplier_name || "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={b.is_active ? "ok" : "mute"}>{b.is_active ? "Activa" : "Inactiva"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button type="button" className="cursor-pointer text-xs text-link" onClick={() => openEdit(b)}>
                      Editar
                    </button>
                    <button type="button" className="cursor-pointer text-xs text-danger" onClick={() => void toggleActive(b)}>
                      {b.is_active ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!brokers.loading && !list.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Sin agencias capturadas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <Modal title={editing ? `Editar ${editing.name}` : "Nueva agencia aduanal"} onClose={() => { setCreating(false); setEditing(null); }}>
          <form onSubmit={(e) => void save(e)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Agencia aduanal">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="SEINCO" />
            </Field>
            <Field label="País">
              <Select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                <option value="MX">México</option>
                <option value="US">Estados Unidos</option>
              </Select>
            </Field>
            <Field label="Licencia / patente">
              <Input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
            </Field>
            <Field label="Proveedor ligado (opcional)">
              <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Sin proveedor ligado</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Contacto">
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </Field>
            <Field label="Teléfono">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email" className="sm:col-span-2">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Notas" className="mt-3">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
