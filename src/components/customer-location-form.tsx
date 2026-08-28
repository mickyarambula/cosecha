import { useState } from "react";
import { Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { createCustomerLocation, updateCustomerLocation } from "@/lib/produce-server";

export type CustomerLocationDraft = {
  id?: number;
  label?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  receiving_instructions?: string | null;
  is_default?: boolean;
};

export function CustomerLocationModal({
  customerId,
  initial,
  forceDefault,
  title,
  onClose,
  onSaved,
}: {
  customerId: number;
  initial?: CustomerLocationDraft;
  forceDefault?: boolean;
  title?: string;
  onClose: () => void;
  onSaved: (loc: { id: number }) => void;
}) {
  const [form, setForm] = useState({
    label: initial?.label ?? "",
    address_line: initial?.address_line ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    zip: initial?.zip ?? "",
    receiving_instructions: initial?.receiving_instructions ?? "",
    is_default: initial?.is_default ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isEdit = Boolean(initial?.id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.address_line.trim()) {
      setErr("Captura la dirección.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      if (isEdit && initial?.id) {
        await updateCustomerLocation({
          data: {
            id: initial.id,
            label: form.label || undefined,
            address_line: form.address_line,
            city: form.city || undefined,
            state: form.state || undefined,
            zip: form.zip || undefined,
            receiving_instructions: form.receiving_instructions || undefined,
          },
        });
        onSaved({ id: initial.id });
      } else {
        const r = await createCustomerLocation({
          data: {
            customer_id: customerId,
            label: form.label || undefined,
            address_line: form.address_line,
            city: form.city || undefined,
            state: form.state || undefined,
            zip: form.zip || undefined,
            receiving_instructions: form.receiving_instructions || undefined,
            is_default: forceDefault || form.is_default,
          },
        });
        onSaved({ id: r.id });
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title || (isEdit ? "Editar destino" : "Nuevo destino")} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <Field label="Nombre del destino (opcional)">
          <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ej. Anaheim DC" />
        </Field>
        <Field label="Dirección *">
          <Input
            required
            value={form.address_line}
            onChange={(e) => setForm({ ...form, address_line: e.target.value })}
            placeholder="1201 N Magnolia Ave"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ciudad">
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Field>
          <Field label="Estado">
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </Field>
          <Field label="Zip">
            <Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </Field>
        </div>
        <Field label="Instrucciones de recibo">
          <Textarea
            rows={3}
            value={form.receiving_instructions}
            onChange={(e) => setForm({ ...form, receiving_instructions: e.target.value })}
            placeholder="Cita con anticipación, teléfono de citas, horario de recibo, tipo de tarima, copias de factura…"
          />
        </Field>
        {!isEdit && !forceDefault ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-action"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            Usar como destino habitual
          </label>
        ) : null}
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear destino"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
