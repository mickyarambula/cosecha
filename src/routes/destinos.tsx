import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Modal, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { createLocation, listLocations, setLocationActive, updateLocation } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { DESTINO_DUENO, DESTINO_TIPO, formatTempRange, qty } from "@/lib/utils";

export const Route = createFileRoute("/destinos")({ component: Page });

type LocationRow = Awaited<ReturnType<typeof listLocations>>[number];

type LocationForm = {
  name: string;
  code: string;
  location_type: string;
  owner_kind: string;
  city: string;
  contact_name: string;
  notes: string;
  temp: string;
  temp_unit: "C" | "F";
};

const EMPTY_FORM: LocationForm = {
  name: "",
  code: "",
  location_type: "bodega",
  owner_kind: "tercero",
  city: "",
  contact_name: "",
  notes: "",
  temp: "",
  temp_unit: "F",
};

// El tono "warn" del Badge compartido se ve igual que "mute" (mismo color de
// fondo), así que "tercero" — lo que Plein va a usar más, ya que hoy no tiene
// cámaras ni bodega propias — necesita su propia pastilla ámbar para
// distinguirse de un vistazo, en vez de reusar el Badge compartido.
function OwnerBadge({ owner_kind, label }: { owner_kind: string; label: string }) {
  if (owner_kind === "tercero")
    return (
      <span className="rounded bg-warn/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-warn">
        {label}
      </span>
    );
  return <Badge tone={owner_kind === "propia" ? "ok" : "mute"}>{label}</Badge>;
}

function Page() {
  const t = useT();
  const [showInactive, setShowInactive] = useState(false);
  const locs = useAsync(() => listLocations({ data: { include_inactive: showInactive } }), [showInactive]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LocationForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<LocationRow | null>(null);
  const [editForm, setEditForm] = useState<LocationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = locs.data ?? [];
  const kpis = useMemo(() => {
    const activas = list.filter((l) => l.is_active);
    const propias = activas.filter((l) => l.owner_kind === "propia").length;
    const terceros = activas.filter((l) => l.owner_kind === "tercero").length;
    return { total: activas.length, propias, terceros };
  }, [list]);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await createLocation({
        data: {
          name: form.name,
          location_type: form.location_type,
          owner_kind: form.owner_kind,
          city: form.city || undefined,
          contact_name: form.contact_name || undefined,
          notes: form.notes || undefined,
          set_point_temp: form.temp.trim() ? Number(form.temp) : null,
          set_point_unit: form.temp.trim() ? form.temp_unit : null,
        },
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      setMsg(`Ubicación ${r.code} creada`);
      await locs.reload();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(l: LocationRow) {
    setEditing(l);
    setErr(null);
    setEditForm({
      name: l.name,
      code: l.code,
      location_type: l.location_type,
      owner_kind: l.owner_kind,
      city: l.city ?? "",
      contact_name: l.contact_name ?? "",
      notes: l.notes ?? "",
      temp: l.set_point_temp != null ? String(l.set_point_temp) : "",
      temp_unit: (l.set_point_unit as "C" | "F") ?? "F",
    });
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setErr(null);
    try {
      await updateLocation({
        data: {
          id: editing.id,
          name: editForm.name,
          code: editForm.code,
          location_type: editForm.location_type,
          owner_kind: editForm.owner_kind,
          city: editForm.city || undefined,
          contact_name: editForm.contact_name || undefined,
          notes: editForm.notes || undefined,
          set_point_temp: editForm.temp.trim() ? Number(editForm.temp) : null,
          set_point_unit: editForm.temp.trim() ? editForm.temp_unit : null,
        },
      });
      setEditing(null);
      setMsg(`Ubicación ${editForm.code} actualizada`);
      await locs.reload();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(l: LocationRow) {
    setMsg(null);
    try {
      await setLocationActive({ data: { id: l.id, is_active: !l.is_active } });
      setMsg(l.is_active ? `${l.name} desactivada` : `${l.name} reactivada`);
      await locs.reload();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se pudo cambiar el estado");
    }
  }

  return (
    <div>
      <PageHeader
        title="Ubicaciones"
        subtitle="Dónde se recibe, se guarda y se reempaca la fruta: cámaras y bodegas propias o de terceros."
        action={<Button onClick={() => { setForm(EMPTY_FORM); setErr(null); setOpen(true); }}>+ Nueva ubicación</Button>}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Ubicaciones activas" value={String(kpis.total)} />
        <Kpi label="Propias" value={String(kpis.propias)} />
        <Kpi label="De terceros" value={String(kpis.terceros)} />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar inactivas
        </label>
        {msg ? <p className="text-sm text-ok">{msg}</p> : null}
      </div>
      {locs.loading ? <p className="text-sm text-muted">{t("Loading…")}</p> : null}
      {locs.error ? <p className="text-sm text-danger">{locs.error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Code")}</th>
              <th className="px-4 py-3 font-medium">{t("Name")}</th>
              <th className="px-4 py-3 font-medium">{t("Type")}</th>
              <th className="px-4 py-3 font-medium">{t("Owner")}</th>
              <th className="px-4 py-3 font-medium">{t("City")}</th>
              <th className="px-4 py-3 font-medium">Temperatura</th>
              <th className="px-4 py-3 text-right font-medium">{t("On hand")}</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className={`border-b border-border last:border-0 ${l.is_active ? "" : "opacity-60"}`}>
                <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-3">
                  <div className={l.is_active ? "font-medium" : "font-medium line-through"}>{l.name}</div>
                  {l.notes ? <div className="text-xs text-muted">{l.notes}</div> : null}
                  {l.contact_name ? <div className="text-xs text-muted">{l.contact_name}</div> : null}
                  {!l.is_active ? (
                    <Badge tone="mute">Desactivada</Badge>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted">{t(DESTINO_TIPO[l.location_type] ?? l.location_type)}</td>
                <td className="px-4 py-3">
                  <OwnerBadge owner_kind={l.owner_kind} label={t(DESTINO_DUENO[l.owner_kind] ?? l.owner_kind)} />
                </td>
                <td className="px-4 py-3 text-muted">{l.city ?? "—"}</td>
                <td className="px-4 py-3 text-muted">
                  {l.set_point_temp != null ? formatTempRange(l.set_point_temp, l.set_point_temp, l.set_point_unit) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{qty(l.lot_qty)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void toggleActive(l)}>
                      {l.is_active ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal
          title="Nueva ubicación"
          subtitle="Se usa como destino al recibir mercancía y al reempacar."
          onClose={() => setOpen(false)}
        >
          <form className="grid gap-3" onSubmit={submitCreate}>
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <Field label="Nombre">
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bodega McAllen 2"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <Select value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })}>
                  {Object.entries(DESTINO_TIPO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dueño">
                <Select value={form.owner_kind} onChange={(e) => setForm({ ...form, owner_kind: e.target.value })}>
                  {Object.entries(DESTINO_DUENO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ciudad">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label={t("Contact")}>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperatura (opcional)">
                <Input
                  type="number"
                  step="0.1"
                  value={form.temp}
                  onChange={(e) => setForm({ ...form, temp: e.target.value })}
                  placeholder="Sin cámara: déjalo vacío"
                />
              </Field>
              <Field label="Unidad">
                <Select value={form.temp_unit} onChange={(e) => setForm({ ...form, temp_unit: e.target.value as "C" | "F" })}>
                  <option value="F">°F</option>
                  <option value="C">°C</option>
                </Select>
              </Field>
            </div>
            <Field label="Nota">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving…") : "Crear ubicación"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {editing ? (
        <Modal
          title={`Editar ${editing.code}`}
          subtitle="Cambia lo que haga falta; el código sigue siendo único."
          onClose={() => setEditing(null)}
        >
          <form className="grid gap-3" onSubmit={submitEdit}>
            {err ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre">
                <Input required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </Field>
              <Field label="Código">
                <Input required value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <Select value={editForm.location_type} onChange={(e) => setEditForm({ ...editForm, location_type: e.target.value })}>
                  {Object.entries(DESTINO_TIPO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dueño">
                <Select value={editForm.owner_kind} onChange={(e) => setEditForm({ ...editForm, owner_kind: e.target.value })}>
                  {Object.entries(DESTINO_DUENO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ciudad">
                <Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
              </Field>
              <Field label={t("Contact")}>
                <Input value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperatura (opcional)">
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.temp}
                  onChange={(e) => setEditForm({ ...editForm, temp: e.target.value })}
                  placeholder="Sin cámara: déjalo vacío"
                />
              </Field>
              <Field label="Unidad">
                <Select value={editForm.temp_unit} onChange={(e) => setEditForm({ ...editForm, temp_unit: e.target.value as "C" | "F" })}>
                  <option value="F">°F</option>
                  <option value="C">°C</option>
                </Select>
              </Field>
            </div>
            <Field label="Nota">
              <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving…") : "Guardar cambios"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
