import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Modal, PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { createLocation, listLocations } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { DESTINO_DUENO, DESTINO_TIPO, qty } from "@/lib/utils";

export const Route = createFileRoute("/destinos")({ component: Page });

function Page() {
  const t = useT();
  const locs = useAsync(() => listLocations(), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    location_type: "bodega",
    owner_kind: "propia",
    city: "",
    contact_name: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const list = locs.data ?? [];
  const kpis = useMemo(() => {
    const propias = list.filter((l) => l.owner_kind === "propia").length;
    const cliente = list.filter((l) => l.owner_kind === "cliente").length;
    return { propias, cliente, total: list.length };
  }, [list]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await createLocation({
        data: {
          name: form.name,
          location_type: form.location_type,
          owner_kind: form.owner_kind,
          city: form.city || undefined,
          contact_name: form.contact_name || undefined,
          notes: form.notes || undefined,
        },
      });
      setOpen(false);
      setForm({ name: "", location_type: "bodega", owner_kind: "propia", city: "", contact_name: "", notes: "" });
      setMsg(`Ruta ${r.code} creada`);
      await locs.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : t("Could not create"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Delivery Routes"
        subtitle={t("SHIP TO locations: owned warehouse, customer dock, or cross-dock.")}
        action={<Button onClick={() => setOpen(true)}>{t("New destination")}</Button>}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label={t("Destinations")} value={String(kpis.total)} />
        <Kpi label="Owned" value={String(kpis.propias)} />
        <Kpi label="Customer" value={String(kpis.cliente)} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {locs.loading ? <p className="text-sm text-muted">{t("Loading…")}</p> : null}
      {locs.error ? <p className="text-sm text-danger">{locs.error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Code")}</th>
              <th className="px-4 py-3 font-medium">{t("Name")}</th>
              <th className="px-4 py-3 font-medium">{t("Type")}</th>
              <th className="px-4 py-3 font-medium">{t("Owner")}</th>
              <th className="px-4 py-3 font-medium">{t("City")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("On hand")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{l.name}</div>
                  {l.notes ? <div className="text-xs text-muted">{l.notes}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted">{t(DESTINO_TIPO[l.location_type] ?? l.location_type)}</td>
                <td className="px-4 py-3">
                  <Badge tone={l.owner_kind === "propia" ? "ok" : l.owner_kind === "cliente" ? "warn" : "mute"}>
                    {DESTINO_DUENO[l.owner_kind] ?? l.owner_kind}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted">{l.city ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{qty(l.lot_qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal title="New destination" subtitle={t("Used as the receive-to location on inbound POs.")} onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bodega McAllen 2" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.location_type} onChange={(e) => setForm({ ...form, location_type: e.target.value })}>
                  {Object.entries(DESTINO_TIPO).map(([k, v]) => (
                    <option key={k} value={k}>
                      {t(v)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Owner">
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
              <Field label="City">
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
              <Field label={t("Contact")}>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </Field>
            </div>
            <Field label="Nota">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? t("Saving…") : t("Create destination")}
            </Button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
