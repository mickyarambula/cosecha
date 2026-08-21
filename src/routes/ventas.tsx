import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Modal } from "@/components/app-shell";
import { Badge, orderLabel, orderTone, qualityLabel } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import {
  createInvoiceFromSO,
  createSalesOrder,
  listCustomers,
  listLots,
  listProducts,
  listSalesOrders,
  shipSalesLine,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { money, qty } from "@/lib/utils";

export const Route = createFileRoute("/ventas")({ component: Page });

function Page() {
  const orders = useAsync(() => listSalesOrders(), []);
  const products = useAsync(() => listProducts(), []);
  const customers = useAsync(() => listCustomers(), []);
  const lots = useAsync(() => listLots(), []);
  const [open, setOpen] = useState(false);
  const [ship, setShip] = useState<{ line_id: number; product_id: number; pending: number; unit: string } | null>(null);
  const [form, setForm] = useState({ customer_id: "", product_id: "", lot_id: "", qty: "", unit_price: "", unit: "caja" });
  const [shipForm, setShipForm] = useState({ quantity: "", lot_id: "", location_id: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const allLots = lots.data ?? [];
  const availableLots = allLots.filter(
    (l) => l.asignable && (!form.product_id || l.product_id === Number(form.product_id)),
  );
  const shipPool = allLots.filter((l) => ship && l.product_id === ship.product_id && l.current_qty > 0);
  const shipLots = shipPool.filter((l) => l.asignable);
  const retenidosOcultos = shipPool.length - shipLots.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const r = await createSalesOrder({
        data: {
          customer_id: Number(form.customer_id),
          lines: [
            {
              product_id: Number(form.product_id),
              lot_id: form.lot_id ? Number(form.lot_id) : undefined,
              quantity_ordered: Number(form.qty),
              unit: form.unit,
              unit_price: form.unit_price ? Number(form.unit_price) : undefined,
            },
          ],
        },
      });
      setOpen(false);
      setMsg(`Venta ${r.so_number} creada`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  async function doShip(e: React.FormEvent) {
    e.preventDefault();
    if (!ship) return;
    setSaving(true);
    setMsg(null);
    try {
      await shipSalesLine({
        data: {
          line_id: ship.line_id,
          quantity: Number(shipForm.quantity),
          lot_id: Number(shipForm.lot_id),
          location_id: Number(shipForm.location_id),
        },
      });
      setShip(null);
      setMsg("Despacho registrado");
      await Promise.all([orders.reload(), lots.reload()]);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo despachar");
    } finally {
      setSaving(false);
    }
  }

  async function facturar(soId: number) {
    setSaving(true);
    setMsg(null);
    try {
      const r = await createInvoiceFromSO({ data: { sales_order_id: soId } });
      setMsg(`Factura ${r.invoice_number} por ${money(r.total)} · vence ${r.due_date}`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo facturar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Ventas"
        subtitle="Pedidos, despacho solo de lotes sanos y factura al cliente."
        action={<Button onClick={() => setOpen(true)}>Nueva venta</Button>}
      />
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {orders.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {orders.error ? <p className="text-sm text-danger">{orders.error}</p> : null}
      <div className="grid gap-3">
        {(orders.data ?? []).map((so) => {
          const margin = so.lines.reduce((acc, l) => acc + (l.unit_price - l.unit_cost) * l.quantity_shipped, 0);
          const shipped = so.lines.some((l) => l.quantity_shipped > 0);
          const pendingAny = so.lines.some((l) => l.quantity_ordered - l.quantity_shipped > 0.0001);
          return (
            <Panel key={so.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted">{so.so_number}</p>
                  <h2 className="font-display text-lg font-semibold">{so.customer_name}</h2>
                  <p className="text-xs text-muted">
                    {so.order_date}
                    {so.ship_date ? ` · enviado ${so.ship_date}` : ""}
                    {so.payment_terms ? ` · ${so.payment_terms}` : ""}
                    {margin ? ` · margen despachado ${money(margin)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to="/doc/$tipo/$id"
                    params={{ tipo: "ov", id: String(so.id) }}
                    className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Documento
                  </Link>
                  {so.invoice ? (
                    <Link
                      to="/doc/$tipo/$id"
                      params={{ tipo: "factura", id: String(so.invoice.id) }}
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {so.invoice.invoice_number}
                    </Link>
                  ) : null}
                  <Badge tone={orderTone(so.status)}>{orderLabel(so.status)}</Badge>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {so.lines.map((line) => {
                  const pending = line.quantity_ordered - line.quantity_shipped;
                  return (
                    <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                      <span>
                        {line.product_name}
                        {line.lot_number ? ` · ${line.lot_number}` : ""}
                        {" · "}
                        {qty(line.quantity_shipped, line.unit)} / {qty(line.quantity_ordered, line.unit)}
                        {line.unit_price ? ` · ${money(line.unit_price)}` : ""}
                      </span>
                      {pending > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const first = allLots.find((l) => l.product_id === line.product_id && l.asignable);
                            setShip({ line_id: line.id, product_id: line.product_id, pending, unit: line.unit });
                            setShipForm({
                              quantity: String(pending),
                              lot_id: String(line.lot_id && allLots.find((l) => l.id === line.lot_id)?.asignable ? line.lot_id : first?.id ?? ""),
                              location_id: String(first?.locations[0]?.location_id ?? ""),
                            });
                          }}
                        >
                          Despachar
                        </Button>
                      ) : (
                        <Badge tone="ok">Surtida</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {shipped && !so.invoice ? (
                  <Button size="sm" disabled={saving} onClick={() => void facturar(so.id)}>
                    Facturar
                  </Button>
                ) : null}
                {pendingAny ? (
                  <p className="self-center text-xs text-muted">Open = lo que falta por surtir. Solo lotes sanos.</p>
                ) : null}
              </div>
            </Panel>
          );
        })}
      </div>

      {open ? (
        <Modal title="Nueva orden de venta" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Cliente">
              <Select required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Seleccionar</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Producto">
              <Select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value, lot_id: "" })}>
                <option value="">Seleccionar</option>
                {(products.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Lote sano (opcional)">
              <Select value={form.lot_id} onChange={(e) => setForm({ ...form, lot_id: e.target.value })}>
                <option value="">Asignar al despachar</option>
                {availableLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.lot_number} · {qty(l.current_qty, l.unit)} · {qualityLabel(l.quality_state)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad">
                <Input required type="number" min="0.01" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              </Field>
              <Field label="Precio unitario">
                <Input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
              </Field>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear venta"}
            </Button>
          </form>
        </Modal>
      ) : null}

      {ship ? (
        <Modal title="Despachar línea" onClose={() => setShip(null)}>
          <form className="grid gap-3" onSubmit={doShip}>
            <p className="text-sm text-muted">Pendiente: {qty(ship.pending, ship.unit)}</p>
            {retenidosOcultos > 0 ? (
              <p className="rounded-md bg-warn/12 px-3 py-2 text-xs text-warn">
                {retenidosOcultos} lote(s) de este producto están retenidos y no se ofrecen. Libéralos a Sano en Inventario.
              </p>
            ) : null}
            {shipLots.length === 0 ? (
              <p className="text-sm text-danger">
                No hay lotes sanos disponibles para este producto.
                {retenidosOcultos ? " Hay inventario retenido — no se puede vender hasta liberarlo." : ""}
              </p>
            ) : (
              <>
                <Field label="Lote sano">
                  <Select
                    required
                    value={shipForm.lot_id}
                    onChange={(e) => {
                      const lot = shipLots.find((l) => l.id === Number(e.target.value));
                      setShipForm({
                        ...shipForm,
                        lot_id: e.target.value,
                        location_id: String(lot?.locations[0]?.location_id ?? ""),
                      });
                    }}
                  >
                    <option value="">Seleccionar</option>
                    {shipLots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.lot_number} · {qty(l.current_qty, l.unit)} · {qualityLabel(l.quality_state)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Ubicación">
                  <Select required value={shipForm.location_id} onChange={(e) => setShipForm({ ...shipForm, location_id: e.target.value })}>
                    <option value="">Seleccionar</option>
                    {(shipLots.find((l) => l.id === Number(shipForm.lot_id))?.locations ?? []).map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.location_name} · {qty(loc.quantity, ship.unit)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Cantidad">
                  <Input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={ship.pending}
                    value={shipForm.quantity}
                    onChange={(e) => setShipForm({ ...shipForm, quantity: e.target.value })}
                  />
                </Field>
                <Button type="submit" disabled={saving}>
                  {saving ? "Despachando…" : "Salida de inventario"}
                </Button>
              </>
            )}
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
