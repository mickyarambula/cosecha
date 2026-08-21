import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Modal, Kpi } from "@/components/app-shell";
import { Badge, orderLabel, orderTone, qualityLabel, qualityTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  createBillFromPO,
  createPurchaseOrder,
  listLocations,
  listProducts,
  listPurchaseOrders,
  listSuppliers,
  receiveMerchandise,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import {
  DEFECTOS,
  INSPECCION_TIPOS,
  RESULTADOS_REC,
  money,
  qty,
  todayISO,
} from "@/lib/utils";

export const Route = createFileRoute("/compras")({ component: Page });

type RecLine = {
  line_id: number;
  product_name: string;
  unit: string;
  pedido: number;
  recibido: number;
  pendiente: number;
  resultado: string;
  cantidad: string;
  afectada: string;
  defecto: string;
  nota: string;
};

const GRUPOS: [keyof typeof DEFECTOS, string][] = [
  ["calidad", "Defecto de calidad"],
  ["condicion", "Defecto de condición"],
  ["otro", "Otra causa"],
];

function Page() {
  const orders = useAsync(() => listPurchaseOrders(), []);
  const products = useAsync(() => listProducts(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const locations = useAsync(() => listLocations(), []);
  const [open, setOpen] = useState(false);
  const [recvPo, setRecvPo] = useState<number | null>(null);
  const [form, setForm] = useState({
    supplier_id: "",
    expected_date: "",
    notes: "",
    product_id: "",
    qty: "",
    unit_cost: "",
    unit: "caja",
  });
  const [rec, setRec] = useState({
    received_date: todayISO(),
    location_id: "",
    inspection_type: "Ninguna",
    inspection_folio: "",
    unloaded: true,
    notes: "",
  });
  const [recLines, setRecLines] = useState<RecLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const list = orders.data ?? [];
  const kpis = useMemo(() => {
    const abiertas = list.filter((p) => ["draft", "confirmed", "partial"].includes(p.status)).length;
    const recibidas = list.filter((p) => p.status === "completed").length;
    const mes = todayISO().slice(0, 7);
    const delMes = list.filter((p) => (p.order_date || "").startsWith(mes)).length;
    return { abiertas, recibidas, delMes };
  }, [list]);

  const po = list.find((p) => p.id === recvPo) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const product = (products.data ?? []).find((p) => p.id === Number(form.product_id));
      const r = await createPurchaseOrder({
        data: {
          supplier_id: Number(form.supplier_id),
          expected_date: form.expected_date || undefined,
          notes: form.notes || undefined,
          lines: [
            {
              product_id: Number(form.product_id),
              pack_style_id: product?.packs[0]?.id,
              quantity_ordered: Number(form.qty),
              unit: form.unit,
              unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
            },
          ],
        },
      });
      setOpen(false);
      setMsg(`Orden ${r.po_number} creada`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  function openRecepcion(id: number) {
    const order = list.find((p) => p.id === id);
    if (!order) return;
    const pending = order.lines
      .map((l) => {
        const pendiente = Math.max(l.quantity_ordered - l.quantity_received, 0);
        return {
          line_id: l.id,
          product_name: l.product_name,
          unit: l.unit,
          pedido: l.quantity_ordered,
          recibido: l.quantity_received,
          pendiente,
          resultado: "",
          cantidad: String(pendiente),
          afectada: "",
          defecto: "",
          nota: "",
        };
      })
      .filter((l) => l.pendiente > 0.0001);
    if (!pending.length) {
      setMsg("Esta compra ya no tiene líneas pendientes.");
      return;
    }
    setWarn(null);
    setRec({
      received_date: todayISO(),
      location_id: String(locations.data?.[0]?.id ?? ""),
      inspection_type: "Ninguna",
      inspection_folio: "",
      unloaded: true,
      notes: "",
    });
    setRecLines(pending);
    setRecvPo(id);
  }

  function patchLine(i: number, patch: Partial<RecLine>) {
    setRecLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function doReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!po) return;
    const activas = recLines.filter((l) => l.resultado);
    if (!activas.length) {
      setWarn("Elige un resultado en al menos una línea.");
      return;
    }
    for (const l of activas) {
      if (l.resultado !== "Rechazada" && !(Number(l.cantidad) > 0)) {
        setWarn(`La cantidad de ${l.product_name} debe ser mayor a cero.`);
        return;
      }
      if (l.resultado === "Rechazada" && !l.defecto) {
        setWarn(`Elige el motivo del rechazo en ${l.product_name}.`);
        return;
      }
      if (l.resultado === "Aceptada con incidencia") {
        if (!(Number(l.afectada) > 0)) {
          setWarn(`Captura cuánto viene afectado en ${l.product_name}.`);
          return;
        }
        if (Number(l.afectada) > Number(l.cantidad) + 1e-9) {
          setWarn(`Lo afectado no puede ser mayor que lo recibido en ${l.product_name}.`);
          return;
        }
        if (!l.defecto) {
          setWarn(`Elige el motivo del defecto en ${l.product_name}.`);
          return;
        }
      }
    }
    if (!rec.location_id) {
      setWarn("Elige el destino de la mercancía.");
      return;
    }
    setSaving(true);
    setWarn(null);
    try {
      const r = await receiveMerchandise({
        data: {
          purchase_order_id: po.id,
          location_id: Number(rec.location_id),
          received_date: rec.received_date || undefined,
          inspection_type: rec.inspection_type,
          inspection_folio: rec.inspection_folio || undefined,
          unloaded: rec.unloaded,
          notes: rec.notes || undefined,
          lines: activas.map((l) => {
            const [tipo, ...resto] = l.defecto.split("::");
            const tieneDefecto = l.resultado !== "Aceptada";
            return {
              line_id: l.line_id,
              result: l.resultado as (typeof RESULTADOS_REC)[number],
              quantity: l.resultado === "Rechazada" ? l.pendiente : Number(l.cantidad),
              affected_qty: l.resultado === "Aceptada con incidencia" ? Number(l.afectada) : undefined,
              defect_type: tieneDefecto ? tipo || undefined : undefined,
              defect_reason: tieneDefecto ? resto.join("::") || undefined : undefined,
              notes: l.nota || undefined,
            };
          }),
        },
      });
      const partes: string[] = [];
      const nAcep = activas.filter((l) => l.resultado === "Aceptada").length;
      const nInc = activas.filter((l) => l.resultado === "Aceptada con incidencia").length;
      const nRech = activas.filter((l) => l.resultado === "Rechazada").length;
      if (nAcep) partes.push(`${nAcep} aceptada(s)`);
      if (nInc) partes.push(`${nInc} con incidencia`);
      if (nRech) partes.push(`${nRech} rechazada(s)`);
      const detalle = (r.lineas ?? [])
        .map((x) => {
          const b: string[] = [];
          if (x.lot_sano_folio) b.push(`${qty(x.cantidad_sana)} sanas (${x.lot_sano_folio})`);
          if (x.lot_retenido_folio) b.push(`${qty(x.cantidad_retenida)} retenidas (${x.lot_retenido_folio})`);
          return b.join(" · ");
        })
        .filter(Boolean);
      setRecvPo(null);
      setMsg(`Recepción de ${r.po_number}: ${partes.join(", ")}.${detalle.length ? ` ${detalle.join(" | ")}.` : ""}${r.warning ? " Aviso PACA en la ficha." : ""}`);
      await orders.reload();
    } catch (err) {
      setWarn(err instanceof Error ? err.message : "No se pudo recibir");
    } finally {
      setSaving(false);
    }
  }

  async function facturarProv(poId: number) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await createBillFromPO({ data: { purchase_order_id: poId } });
      setMsg(`Factura ${r.bill_number} por ${money(r.total)} — three-way: pedido ${qty(r.ordered)} / recibido ${qty(r.received)}`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo generar la factura");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle="PO al grower. Recibir mercancía es inspección PACA — nunca una línea suelta sin calidad."
        action={<Button onClick={() => setOpen(true)}>Nueva orden</Button>}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Abiertas" value={String(kpis.abiertas)} tone="warn" />
        <Kpi label="Recibidas" value={String(kpis.recibidas)} tone="ok" />
        <Kpi label="Del mes" value={String(kpis.delMes)} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {orders.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {orders.error ? <p className="text-sm text-danger">{orders.error}</p> : null}
      <div className="grid gap-3">
        {list.map((poRow) => {
          const pending = poRow.lines.some((l) => l.quantity_ordered - l.quantity_received > 0.0001);
          const received = poRow.lines.some((l) => l.quantity_received > 0);
          const aviso = poRow.receptions.find((r) => r.warning)?.warning;
          return (
            <Panel key={poRow.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted">{poRow.po_number}</p>
                  <h2 className="font-display text-lg font-semibold">{poRow.supplier_name}</h2>
                  <p className="text-xs text-muted">
                    Pedido {poRow.order_date}
                    {poRow.expected_date ? ` · ETA ${poRow.expected_date}` : ""}
                    {poRow.so_number ? ` · ${poRow.so_number}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {poRow.so_number ? (
                    <Link to="/ventas" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      {poRow.so_number}
                    </Link>
                  ) : null}
                  <Link
                    to="/doc/$tipo/$id"
                    params={{ tipo: "oc", id: String(poRow.id) }}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Documento
                  </Link>
                  {poRow.bill ? (
                    <Link to="/cxp" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
                      {poRow.bill.bill_number}
                    </Link>
                  ) : null}
                  {poRow.so_number ? <Badge tone="ok">Desde OV</Badge> : null}
                  <Badge tone={orderTone(poRow.status)}>{orderLabel(poRow.status)}</Badge>
                </div>
              </div>
              {aviso ? (
                <p className="mt-3 rounded-md bg-warn/12 px-3 py-2 text-xs text-warn">
                  Aviso PACA: {aviso}
                </p>
              ) : null}
              <div className="mt-3 space-y-2">
                {poRow.lines.map((line) => {
                  const rest = line.quantity_ordered - line.quantity_received;
                  return (
                    <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                      <span>
                        {line.product_name} · {qty(line.quantity_received, line.unit)} / {qty(line.quantity_ordered, line.unit)}
                        {line.unit_cost ? ` · ${money(line.unit_cost)}` : ""}
                      </span>
                      {rest > 0.0001 ? (
                        <Badge tone="warn">Pendiente {qty(rest, line.unit)}</Badge>
                      ) : (
                        <Badge tone="ok">Completo</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {poRow.receptions.length ? (
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {poRow.receptions.map((r) => (
                    <li key={r.id}>
                      {r.received_date} · {r.product_name} · {r.result} {qty(r.quantity)}
                      {r.lot_sano ? (
                        <>
                          {" "}
                          · Sano <span className="font-mono text-ok">{r.lot_sano}</span>
                        </>
                      ) : null}
                      {r.lot_retenido ? (
                        <>
                          {" "}
                          · Retenido <span className="font-mono text-warn">{r.lot_retenido}</span>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {pending ? (
                  <Button size="sm" onClick={() => openRecepcion(poRow.id)}>
                    Recibir mercancía
                  </Button>
                ) : null}
                {received && !poRow.bill ? (
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => void facturarProv(poRow.id)}>
                    Capturar factura proveedor
                  </Button>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>

      {open ? (
        <Modal title="Nueva orden de compra" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Proveedor">
              <Select required value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                <option value="">Seleccionar</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Producto">
              <Select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Seleccionar</option>
                {(products.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.variety ?? ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <Input required type="number" min="0.01" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              </Field>
              <Field label="Costo unitario">
                <Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </Field>
            </div>
            <Field label="Fecha esperada">
              <Input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear orden"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {po ? (
        <Modal
          wide
          title="Recibir mercancía"
          subtitle={`${po.po_number} · ${po.supplier_name}`}
          onClose={() => setRecvPo(null)}
        >
          <form className="grid gap-4" onSubmit={doReceive}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de recepción">
                <Input type="date" value={rec.received_date} onChange={(e) => setRec({ ...rec, received_date: e.target.value })} />
              </Field>
              <Field label="Destino">
                <Select required value={rec.location_id} onChange={(e) => setRec({ ...rec, location_id: e.target.value })}>
                  <option value="">Seleccionar</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={rec.unloaded}
                onChange={(e) => setRec({ ...rec, unloaded: e.target.checked })}
              />
              Sí, la mercancía ya bajó del transporte
            </label>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Inspección</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo">
                  <Select value={rec.inspection_type} onChange={(e) => setRec({ ...rec, inspection_type: e.target.value })}>
                    {INSPECCION_TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Folio de inspección">
                  <Input
                    disabled={rec.inspection_type === "Ninguna"}
                    value={rec.inspection_folio}
                    onChange={(e) => setRec({ ...rec, inspection_folio: e.target.value })}
                    placeholder="opcional"
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Líneas — resultado por producto</p>
              <p className="mb-3 text-xs text-muted">
                Aceptada → lote {qualityLabel("sano")}. Incidencia → parte sana + lote {qualityLabel("retenido")} (no se vende hasta liberarlo). Rechazada → no nace lote, línea completa.
              </p>
              <div className="space-y-3">
                {recLines.map((l, i) => {
                  const esInc = l.resultado === "Aceptada con incidencia";
                  const esRech = l.resultado === "Rechazada";
                  return (
                    <div key={l.line_id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{l.product_name}</p>
                          <p className="text-xs text-muted">
                            Pedido {qty(l.pedido)} · recibido {qty(l.recibido)} · pendiente {qty(l.pendiente, l.unit)}
                          </p>
                        </div>
                        <Select
                          className="max-w-56"
                          value={l.resultado}
                          onChange={(e) => {
                            const resultado = e.target.value;
                            patchLine(i, {
                              resultado,
                              cantidad: resultado === "Rechazada" ? String(l.pendiente) : l.cantidad,
                              afectada: resultado === "Aceptada con incidencia" ? l.afectada : "",
                              defecto: resultado ? l.defecto : "",
                            });
                          }}
                        >
                          <option value="">— no recibir ahora —</option>
                          {RESULTADOS_REC.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {l.resultado ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <Field label={esRech ? "Cantidad (línea completa)" : "Cantidad recibida"}>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={esRech}
                              value={l.cantidad}
                              onChange={(e) => patchLine(i, { cantidad: e.target.value })}
                            />
                          </Field>
                          {esInc ? (
                            <Field label="Viene afectada">
                              <Input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={l.afectada}
                                onChange={(e) => patchLine(i, { afectada: e.target.value })}
                              />
                            </Field>
                          ) : null}
                          {esInc || esRech ? (
                            <div className="sm:col-span-2">
                              <Field label={esRech ? "Motivo (obligatorio)" : "Motivo del defecto"}>
                                <Select value={l.defecto} onChange={(e) => patchLine(i, { defecto: e.target.value })}>
                                  <option value="">— elige motivo —</option>
                                  {GRUPOS.map(([tipo, etiqueta]) => (
                                    <optgroup key={tipo} label={etiqueta}>
                                      {DEFECTOS[tipo].map((v) => (
                                        <option key={v} value={`${tipo}::${v}`}>
                                          {v}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                                </Select>
                              </Field>
                            </div>
                          ) : null}
                          <div className="sm:col-span-2">
                            <Field label="Nota">
                              <Input
                                value={l.nota}
                                placeholder={esRech ? "Ej. llegó Formosa en vez de Maradol" : "opcional"}
                                onChange={(e) => patchLine(i, { nota: e.target.value })}
                              />
                            </Field>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <Field label="Nota general">
              <Textarea value={rec.notes} onChange={(e) => setRec({ ...rec, notes: e.target.value })} rows={2} />
            </Field>
            {warn ? <p className="text-sm text-danger">{warn}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Registrando…" : "Registrar recepción"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setRecvPo(null)}>
                Cancelar
              </Button>
            </div>
            <p className="text-xs text-muted">
              Un lote {qualityLabel("retenido")} no se puede asignar a una venta hasta liberarlo a Sano en Inventario.
            </p>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
