import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal, Kpi } from "@/components/app-shell";
import { Badge, qualityLabel, qualityTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { getLotTrace, listLots, setLotQuality } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { CALIDAD_LABEL, daysUntil, money, qty } from "@/lib/utils";

export const Route = createFileRoute("/inventario")({ component: Page });

const CALIDAD = Object.keys(CALIDAD_LABEL);

function Page() {
  const lots = useAsync(() => listLots(), []);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("");
  const [lotId, setLotId] = useState<number | null>(null);
  const [calidad, setCalidad] = useState<{ id: number; state: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const trace = useAsync(() => (lotId ? getLotTrace({ data: { lotId } }) : Promise.resolve(null)), [lotId]);

  const data = lots.data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.filter((l) => {
      if (filtro && (l.quality_state || "sano") !== filtro) return false;
      if (!s) return true;
      return (
        l.lot_number.toLowerCase().includes(s) ||
        l.product_name.toLowerCase().includes(s) ||
        (l.supplier_name ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, q, filtro]);

  const selected = data.find((l) => l.id === lotId) ?? null;
  const retenidos = data.filter((l) => l.status === "active" && l.current_qty > 0 && !l.asignable).length;
  const disp = data.reduce((s, l) => s + (l.status === "active" ? l.current_qty : 0), 0);

  async function guardarCalidad(e: React.FormEvent) {
    e.preventDefault();
    if (!calidad) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await setLotQuality({
        data: {
          lot_id: calidad.id,
          quality_state: calidad.state as "sano" | "retenido" | "castigado" | "destruido",
          quality_note: calidad.note || undefined,
        },
      });
      setCalidad(null);
      setMsg(`${r.lot_number} → ${qualityLabel(r.quality_state)}`);
      await lots.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo cambiar la calidad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        subtitle="Lotes con calidad PACA. Solo Sano se puede asignar a una venta."
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Lotes" value={String(data.length)} />
        <Kpi label="Disponible" value={qty(disp)} />
        <Kpi label="No asignables" value={String(retenidos)} tone={retenidos ? "warn" : "ok"} hint="Retenido / castigado" />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Buscar lote, producto o grower…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="sm:max-w-48" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Toda la calidad</option>
          {CALIDAD.map((c) => (
            <option key={c} value={c}>
              {qualityLabel(c)}
            </option>
          ))}
        </Select>
      </div>
      {lots.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {lots.error ? <p className="text-sm text-danger">{lots.error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Lote</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Costo</th>
              <th className="px-4 py-3 font-medium">Calidad</th>
              <th className="px-4 py-3 font-medium">Best-by</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const days = daysUntil(l.best_by_date);
              return (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-3 font-mono text-xs">
                    <button type="button" className="text-left font-medium text-primary" onClick={() => setLotId(l.id)}>
                      {l.lot_number}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{l.product_name}</div>
                    <div className="text-xs text-muted">
                      {l.supplier_name ?? "—"} · {l.grade ?? l.pack_name ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{qty(l.current_qty, l.unit)}</td>
                  <td className="px-4 py-3 tabular-nums">{l.unit_cost ? money(l.unit_cost) : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={qualityTone(l.quality_state)}>{qualityLabel(l.quality_state)}</Badge>
                    {!l.asignable && l.current_qty > 0 ? (
                      <p className="mt-1 text-xs text-warn">No asignable</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {days == null ? (
                      "—"
                    ) : (
                      <Badge tone={days < 0 ? "danger" : days <= 4 ? "warn" : "ok"}>
                        {days < 0 ? `Vencido ${-days}d` : `${days}d`}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCalidad({
                          id: l.id,
                          state: l.quality_state || "sano",
                          note: l.quality_note ?? "",
                        })
                      }
                    >
                      Calidad
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <Modal title={selected.lot_number} onClose={() => setLotId(null)}>
          <div className="space-y-4 text-sm">
            <Panel className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{selected.product_name}</p>
                <Badge tone={qualityTone(selected.quality_state)}>{qualityLabel(selected.quality_state)}</Badge>
              </div>
              <p className="text-muted">
                {selected.origin_farm ?? selected.supplier_name} · {qty(selected.current_qty, selected.unit)} de{" "}
                {qty(selected.original_qty, selected.unit)}
              </p>
              {selected.quality_note ? <p className="mt-2 text-xs text-warn">{selected.quality_note}</p> : null}
              <p className="mt-2 text-muted">
                Recibido {selected.received_date ?? "—"} · Best-by {selected.best_by_date ?? "—"} · Costo {money(selected.unit_cost)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.locations.map((loc) => (
                  <span key={loc.location_id} className="rounded-md bg-surface-2 px-2 py-1 text-xs">
                    {loc.location_name}: {qty(loc.quantity, selected.unit)}
                  </span>
                ))}
              </div>
            </Panel>
            <div>
              <h3 className="mb-2 font-medium">Movimientos</h3>
              {trace.loading ? <p className="text-muted">Cargando traza…</p> : null}
              <ul className="space-y-2">
                {(trace.data?.movements ?? []).map((m) => (
                  <li key={m.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="capitalize">{m.movement_type}</span>
                      <span className="tabular-nums">{qty(m.quantity, m.unit)}</span>
                    </div>
                    <p className="text-xs text-muted">
                      {m.location_name} · {m.notes}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            {(trace.data?.sales.length ?? 0) > 0 ? (
              <div>
                <h3 className="mb-2 font-medium">Ventas de este lote</h3>
                <ul className="space-y-2">
                  {trace.data!.sales.map((s) => (
                    <li key={s.so_number} className="flex justify-between rounded-md border border-border px-3 py-2">
                      <span>
                        {s.so_number} · {s.customer}
                      </span>
                      <span className="tabular-nums">
                        {qty(s.qty)} @ {money(s.unit_price)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {calidad ? (
        <Modal title="Estado de calidad" onClose={() => setCalidad(null)}>
          <form className="grid gap-3" onSubmit={guardarCalidad}>
            <p className="text-sm text-muted">
              Liberar = pasar a Sano (queda asignable). Retenido lo saca de la venta. Castigado / Destruido son bajas.
            </p>
            <Field label="Calidad">
              <Select value={calidad.state} onChange={(e) => setCalidad({ ...calidad, state: e.target.value })}>
                {CALIDAD.map((c) => (
                  <option key={c} value={c}>
                    {qualityLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nota">
              <Input
                value={calidad.note}
                placeholder="Motivo del cambio"
                onChange={(e) => setCalidad({ ...calidad, note: e.target.value })}
              />
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
