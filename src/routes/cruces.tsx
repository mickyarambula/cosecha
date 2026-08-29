import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { createBorderCrossing, listBorderCrossings, updateBorderCrossing } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";

export const Route = createFileRoute("/cruces")({ component: Page });

type Crossing = Awaited<ReturnType<typeof listBorderCrossings>>[number];

function emptyForm() {
  return { name: "", port_mx: "", port_us: "", state_mx: "", state_us: "" };
}

function Page() {
  const crossings = useAsync(() => listBorderCrossings(), []);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Crossing | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (crossings.data ?? [])
      .filter((c) => showInactive || c.is_active)
      .filter((c) => !s || c.name.toLowerCase().includes(s));
  }, [crossings.data, q, showInactive]);

  function openCreate() {
    setForm(emptyForm());
    setErr(null);
    setCreating(true);
  }

  function openEdit(c: Crossing) {
    setForm({
      name: c.name,
      port_mx: c.port_mx ?? "",
      port_us: c.port_us ?? "",
      state_mx: c.state_mx ?? "",
      state_us: c.state_us ?? "",
    });
    setErr(null);
    setEditing(c);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: form.name,
        port_mx: form.port_mx || undefined,
        port_us: form.port_us || undefined,
        state_mx: form.state_mx || undefined,
        state_us: form.state_us || undefined,
      };
      if (editing) {
        await updateBorderCrossing({ data: { ...payload, id: editing.id, is_active: editing.is_active } });
      } else {
        await createBorderCrossing({ data: payload });
      }
      setCreating(false);
      setEditing(null);
      await crossings.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: Crossing) {
    await updateBorderCrossing({
      data: {
        id: c.id,
        name: c.name,
        port_mx: c.port_mx ?? undefined,
        port_us: c.port_us ?? undefined,
        state_mx: c.state_mx ?? undefined,
        state_us: c.state_us ?? undefined,
        is_active: !c.is_active,
      },
    });
    await crossings.reload();
  }

  const modalOpen = creating || editing != null;

  return (
    <div className="p-5">
      <PageHeader
        title="Puntos de cruce"
        subtitle="Garitas usadas al cruzar mercancía entre México y Estados Unidos."
        action={<Button onClick={openCreate}>+ Agregar cruce</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar punto de cruce…" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="size-4 accent-action" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Ver inactivos
        </label>
      </div>
      {crossings.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Punto de cruce</th>
              <th className="px-4 py-3 font-medium">Garita MX</th>
              <th className="px-4 py-3 font-medium">Garita US</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted">
                  {c.port_mx || "—"}
                  {c.state_mx ? <div className="text-xs">{c.state_mx}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {c.port_us || "—"}
                  {c.state_us ? <div className="text-xs">{c.state_us}</div> : null}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={c.is_active ? "ok" : "mute"}>{c.is_active ? "Activo" : "Inactivo"}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button type="button" className="cursor-pointer text-xs text-link" onClick={() => openEdit(c)}>
                      Editar
                    </button>
                    <button type="button" className="cursor-pointer text-xs text-danger" onClick={() => void toggleActive(c)}>
                      {c.is_active ? "Desactivar" : "Reactivar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!crossings.loading && !list.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  Sin puntos de cruce.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <Modal title={editing ? `Editar ${editing.name}` : "Nuevo punto de cruce"} onClose={() => { setCreating(false); setEditing(null); }}>
          <form onSubmit={(e) => void save(e)}>
            <div className="grid gap-3">
              <Field label="Punto de cruce">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nogales" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Garita MX">
                  <Input value={form.port_mx} onChange={(e) => setForm({ ...form, port_mx: e.target.value })} />
                </Field>
                <Field label="Garita US">
                  <Input value={form.port_us} onChange={(e) => setForm({ ...form, port_us: e.target.value })} />
                </Field>
                <Field label="Estado MX">
                  <Input value={form.state_mx} onChange={(e) => setForm({ ...form, state_mx: e.target.value })} />
                </Field>
                <Field label="Estado US">
                  <Input value={form.state_us} onChange={(e) => setForm({ ...form, state_us: e.target.value })} />
                </Field>
              </div>
            </div>
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
