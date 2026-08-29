import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Modal } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  createCarrier,
  createCarrierUnit,
  createDriver,
  listCarrierUnits,
  listCarriers,
  listDrivers,
  listSuppliers,
  updateCarrier,
  updateCarrierUnit,
  updateDriver,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transportistas")({ component: Page });

type CarrierUnit = Awaited<ReturnType<typeof listCarrierUnits>>[number];
type Driver = Awaited<ReturnType<typeof listDrivers>>[number];

function Page() {
  const carriers = useAsync(() => listCarriers(), []);
  const units = useAsync(() => listCarrierUnits(), []);
  const drivers = useAsync(() => listDrivers(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({
    name: "",
    country: "",
    scac: "",
    caat: "",
    contact_name: "",
    phone: "",
    supplier_id: "",
    is_active: true,
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (carriers.data ?? [])
      .filter((c) => showInactive || c.is_active)
      .filter((c) => !s || c.name.toLowerCase().includes(s));
  }, [carriers.data, q, showInactive]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof list>();
    for (const c of list) {
      const letter = (c.name[0] || "#").toUpperCase();
      map.set(letter, [...(map.get(letter) ?? []), c]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const current = (carriers.data ?? []).find((c) => c.id === sel) ?? null;

  type CarrierRow = NonNullable<typeof carriers.data>[number];
  function pickRow(c: CarrierRow) {
    setSel(c.id);
    setEdit({
      name: c.name,
      country: c.country ?? "",
      scac: c.scac ?? "",
      caat: c.caat ?? "",
      contact_name: c.contact_name ?? "",
      phone: c.phone ?? "",
      supplier_id: c.supplier_id != null ? String(c.supplier_id) : "",
      is_active: c.is_active,
    });
  }
  function pick(id: number) {
    const c = (carriers.data ?? []).find((x) => x.id === id);
    if (c) pickRow(c);
  }

  async function createNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await createCarrier({ data: { name: newName.trim() } });
      setNewName("");
      setOpen(false);
      // reload() sets state async — carriers.data is still stale right here,
      // so re-fetch directly to find the row we just created and select it.
      const fresh = await listCarriers();
      carriers.setData(fresh);
      const created = fresh.find((c) => c.id === r.id);
      if (created) pickRow(created);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!current) return;
    setSaving(true);
    try {
      await updateCarrier({
        data: {
          id: current.id,
          name: edit.name,
          country: edit.country || undefined,
          scac: edit.scac || undefined,
          caat: edit.caat || undefined,
          contact_name: edit.contact_name || undefined,
          phone: edit.phone || undefined,
          supplier_id: edit.supplier_id ? Number(edit.supplier_id) : null,
          is_active: edit.is_active,
        },
      });
      // SCAC/CAAT se suben a mayúsculas en el servidor; releer y repintar el
      // formulario para que lo que se ve coincida con lo que quedó guardado.
      const fresh = await listCarriers();
      carriers.setData(fresh);
      const updated = fresh.find((c) => c.id === current.id);
      if (updated) pickRow(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)]">
      <aside className="flex w-full max-w-xs shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Transportistas</p>
          <Button size="sm" onClick={() => setOpen(true)}>
            + Agregar
          </Button>
        </div>
        <div className="space-y-2 p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar transportista" />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" className="size-3.5 accent-action" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Ver inactivos
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {carriers.loading ? <p className="p-4 text-sm text-muted">Cargando…</p> : null}
          {groups.map(([letter, rows]) => (
            <div key={letter}>
              <p className="bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">{letter}</p>
              {rows.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 border-b border-border px-3 py-3 text-left text-sm font-medium",
                    sel === c.id ? "bg-action/8 ring-1 ring-inset ring-action" : "hover:bg-surface-2",
                  )}
                >
                  <span>{c.name}</span>
                  {!c.is_active ? <Badge tone="mute">Inactivo</Badge> : null}
                </button>
              ))}
            </div>
          ))}
          {!carriers.loading && !groups.length ? <p className="p-4 text-sm text-muted">Sin transportistas.</p> : null}
        </div>
      </aside>
      <section className="min-w-0 flex-1 overflow-y-auto p-5">
        {!current ? (
          <p className="pt-24 text-center text-muted">Selecciona un transportista para ver su detalle.</p>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-lg font-semibold">{current.name}</h1>
              <Badge tone={edit.is_active ? "ok" : "mute"}>{edit.is_active ? "Activo" : "Inactivo"}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Línea transportista">
                <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
              </Field>
              <Field label="País">
                <Input value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} placeholder="MX" />
              </Field>
              <Field label="Proveedor ligado (opcional)">
                <Select value={edit.supplier_id} onChange={(e) => setEdit({ ...edit, supplier_id: e.target.value })}>
                  <option value="">Sin proveedor ligado</option>
                  {(suppliers.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="SCAC">
                <Input value={edit.scac} onChange={(e) => setEdit({ ...edit, scac: e.target.value })} className="uppercase" />
              </Field>
              <Field label="CAAT">
                <Input value={edit.caat} onChange={(e) => setEdit({ ...edit, caat: e.target.value })} className="uppercase" />
              </Field>
              <Field label="Contacto">
                <Input value={edit.contact_name} onChange={(e) => setEdit({ ...edit, contact_name: e.target.value })} />
              </Field>
              <Field label="Teléfono">
                <Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-action" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} />
              Transportista activo
            </label>
            <div className="mt-4 flex justify-end">
              <Button disabled={saving || !edit.name.trim()} onClick={() => void save()}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>

            <UnitsPanel
              carrierId={current.id}
              units={(units.data ?? []).filter((u) => u.carrier_id === current.id)}
              reload={units.reload}
            />
            <DriversPanel
              carrierId={current.id}
              drivers={(drivers.data ?? []).filter((d) => d.carrier_id === current.id)}
              reload={drivers.reload}
            />
          </div>
        )}
      </section>

      {open ? (
        <Modal title="Nuevo transportista" onClose={() => setOpen(false)}>
          <form onSubmit={createNew}>
            <Field label="Línea transportista">
              <Input required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Cornejos Trucking" />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Agregar"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function UnitsPanel({ carrierId, units, reload }: { carrierId: number; units: CarrierUnit[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ unit_type: "camion", plates: "", economic_number: "", make_model: "", model_year: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ unit_type: "camion", plates: "", economic_number: "", make_model: "", model_year: "" });
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.plates.trim()) return;
    setSaving(true);
    try {
      await createCarrierUnit({
        data: {
          carrier_id: carrierId,
          unit_type: form.unit_type as "camion" | "remolque",
          plates: form.plates,
          economic_number: form.economic_number || undefined,
          make_model: form.make_model || undefined,
          model_year: form.model_year ? Number(form.model_year) : undefined,
        },
      });
      setForm({ unit_type: "camion", plates: "", economic_number: "", make_model: "", model_year: "" });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u: CarrierUnit) {
    setEditId(u.id);
    setEditForm({
      unit_type: u.unit_type,
      plates: u.plates,
      economic_number: u.economic_number ?? "",
      make_model: u.make_model ?? "",
      model_year: u.model_year != null ? String(u.model_year) : "",
    });
  }

  async function saveEdit(u: CarrierUnit) {
    setSaving(true);
    try {
      await updateCarrierUnit({
        data: {
          id: u.id,
          unit_type: editForm.unit_type as "camion" | "remolque",
          plates: editForm.plates,
          economic_number: editForm.economic_number || undefined,
          make_model: editForm.make_model || undefined,
          model_year: editForm.model_year ? Number(editForm.model_year) : undefined,
          is_active: u.is_active,
        },
      });
      setEditId(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: CarrierUnit) {
    await updateCarrierUnit({
      data: {
        id: u.id,
        unit_type: u.unit_type as "camion" | "remolque",
        plates: u.plates,
        economic_number: u.economic_number ?? undefined,
        make_model: u.make_model ?? undefined,
        model_year: u.model_year ?? undefined,
        is_active: !u.is_active,
      },
    });
    await reload();
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="mb-2 text-sm font-semibold">Unidades</p>
      <form onSubmit={add} className="mb-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-5">
        <Select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}>
          <option value="camion">Camión</option>
          <option value="remolque">Remolque</option>
        </Select>
        <Input placeholder="Placas" value={form.plates} onChange={(e) => setForm({ ...form, plates: e.target.value })} />
        <Input placeholder="No. económico" value={form.economic_number} onChange={(e) => setForm({ ...form, economic_number: e.target.value })} />
        <Input placeholder="Marca / modelo" value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} />
        <div className="flex gap-2">
          <Input placeholder="Año" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} />
          <Button type="submit" size="sm" disabled={saving || !form.plates.trim()}>
            + Agregar
          </Button>
        </div>
      </form>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Placas</th>
              <th className="px-3 py-2 font-medium">No. económico</th>
              <th className="px-3 py-2 font-medium">Marca / modelo</th>
              <th className="px-3 py-2 font-medium">Año</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {units.map((u) =>
              editId === u.id ? (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Select value={editForm.unit_type} onChange={(e) => setEditForm({ ...editForm, unit_type: e.target.value })}>
                      <option value="camion">Camión</option>
                      <option value="remolque">Remolque</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.plates} onChange={(e) => setEditForm({ ...editForm, plates: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.economic_number} onChange={(e) => setEditForm({ ...editForm, economic_number: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.make_model} onChange={(e) => setEditForm({ ...editForm, make_model: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.model_year} onChange={(e) => setEditForm({ ...editForm, model_year: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={u.is_active ? "ok" : "mute"}>{u.is_active ? "Activa" : "Inactiva"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" className="cursor-pointer text-xs text-link" disabled={saving} onClick={() => void saveEdit(u)}>
                        Guardar
                      </button>
                      <button type="button" className="cursor-pointer text-xs text-muted" onClick={() => setEditId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">{u.unit_type === "camion" ? "Camión" : "Remolque"}</td>
                  <td className="px-3 py-2 font-medium">{u.plates}</td>
                  <td className="px-3 py-2 text-muted">{u.economic_number || "—"}</td>
                  <td className="px-3 py-2 text-muted">{u.make_model || "—"}</td>
                  <td className="px-3 py-2 text-muted">{u.model_year || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={u.is_active ? "ok" : "mute"}>{u.is_active ? "Activa" : "Inactiva"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" className="cursor-pointer text-xs text-link" onClick={() => startEdit(u)}>
                        Editar
                      </button>
                      <button type="button" className="cursor-pointer text-xs text-danger" onClick={() => void toggleActive(u)}>
                        {u.is_active ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {!units.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-muted">
                  Sin unidades capturadas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriversPanel({ carrierId, drivers, reload }: { carrierId: number; drivers: Driver[]; reload: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", license_number: "", license_state: "", phone: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", license_number: "", license_state: "", phone: "" });
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createDriver({
        data: {
          carrier_id: carrierId,
          name: form.name,
          license_number: form.license_number || undefined,
          license_state: form.license_state || undefined,
          phone: form.phone || undefined,
        },
      });
      setForm({ name: "", license_number: "", license_state: "", phone: "" });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(d: Driver) {
    setEditId(d.id);
    setEditForm({
      name: d.name,
      license_number: d.license_number ?? "",
      license_state: d.license_state ?? "",
      phone: d.phone ?? "",
    });
  }

  async function saveEdit(d: Driver) {
    setSaving(true);
    try {
      await updateDriver({
        data: {
          id: d.id,
          name: editForm.name,
          license_number: editForm.license_number || undefined,
          license_state: editForm.license_state || undefined,
          phone: editForm.phone || undefined,
          is_active: d.is_active,
        },
      });
      setEditId(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(d: Driver) {
    await updateDriver({
      data: {
        id: d.id,
        name: d.name,
        license_number: d.license_number ?? undefined,
        license_state: d.license_state ?? undefined,
        phone: d.phone ?? undefined,
        is_active: !d.is_active,
      },
    });
    await reload();
  }

  return (
    <div className="mt-6 border-t border-border pt-4">
      <p className="mb-2 text-sm font-semibold">Choferes</p>
      <form onSubmit={add} className="mb-3 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-5">
        <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Licencia" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
        <Input placeholder="Estado que emite" value={form.license_state} onChange={(e) => setForm({ ...form, license_state: e.target.value })} />
        <Input placeholder="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <Button type="submit" size="sm" disabled={saving || !form.name.trim()}>
          + Agregar
        </Button>
      </form>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Licencia</th>
              <th className="px-3 py-2 font-medium">Estado emisor</th>
              <th className="px-3 py-2 font-medium">Teléfono</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) =>
              editId === d.id ? (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.license_number} onChange={(e) => setEditForm({ ...editForm, license_number: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.license_state} onChange={(e) => setEditForm({ ...editForm, license_state: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={d.is_active ? "ok" : "mute"}>{d.is_active ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" className="cursor-pointer text-xs text-link" disabled={saving} onClick={() => void saveEdit(d)}>
                        Guardar
                      </button>
                      <button type="button" className="cursor-pointer text-xs text-muted" onClick={() => setEditId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={d.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{d.name}</td>
                  <td className="px-3 py-2 text-muted">{d.license_number || "—"}</td>
                  <td className="px-3 py-2 text-muted">{d.license_state || "—"}</td>
                  <td className="px-3 py-2 text-muted">{d.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={d.is_active ? "ok" : "mute"}>{d.is_active ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-3">
                      <button type="button" className="cursor-pointer text-xs text-link" onClick={() => startEdit(d)}>
                        Editar
                      </button>
                      <button type="button" className="cursor-pointer text-xs text-danger" onClick={() => void toggleActive(d)}>
                        {d.is_active ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {!drivers.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-muted">
                  Sin choferes capturados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
