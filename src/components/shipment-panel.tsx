import { useMemo, useState } from "react";
import { Modal } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { downloadBolPdf } from "@/lib/bol-pdf";
import {
  createShipment,
  getBolDoc,
  issueBol,
  listBorderCrossings,
  listCarrierUnits,
  listCarriers,
  listCustomsBrokers,
  listDrivers,
  listShipments,
  listValueLists,
  updateShipment,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABEL,
  errorMessage,
  fecha,
  formatTempRange,
} from "@/lib/utils";

type Shipment = Awaited<ReturnType<typeof listShipments>>[number];
type Tipo = "entrada" | "salida";

function statusTone(status: string) {
  if (status === "entregado") return "ok" as const;
  if (status === "pendiente") return "mute" as const;
  return "warn" as const; // en_transito / cruzado: en movimiento
}

/**
 * Sección "Embarques" del detalle de una OC (tipo entrada) o una OV (tipo
 * salida): lista lo capturado + botón para capturar otro. Varios embarques
 * por orden desde el principio — una OC puede llegar en dos camiones.
 */
export function ShipmentsPanel({
  tipo,
  purchaseOrderId,
  salesOrderId,
  bol,
  vendorInvoice,
}: {
  tipo: Tipo;
  purchaseOrderId?: number;
  salesOrderId?: number;
  /** Solo entrada: se muestran de la OC en modo lectura, no se capturan aquí. */
  bol?: string | null;
  vendorInvoice?: string | null;
}) {
  const shipments = useAsync(
    () =>
      listShipments({
        data: purchaseOrderId
          ? { purchase_order_id: purchaseOrderId }
          : { sales_order_id: salesOrderId },
      }),
    [purchaseOrderId, salesOrderId],
  );
  const [editing, setEditing] = useState<Shipment | "new" | null>(null);
  const [bolBusy, setBolBusy] = useState<number | null>(null);
  const [bolErr, setBolErr] = useState<string | null>(null);
  const rows = shipments.data ?? [];

  // El folio se emite y persiste la primera vez; reimprimir baja el mismo BOL.
  async function printBol(s: Shipment) {
    if (bolBusy != null) return;
    setBolBusy(s.id);
    setBolErr(null);
    try {
      await issueBol({ data: { shipment_id: s.id } });
      const doc = await getBolDoc({ data: { shipment_id: s.id } });
      await downloadBolPdf(doc);
      await shipments.reload();
    } catch (e) {
      setBolErr(errorMessage(e, "No se pudo generar el BOL."));
    } finally {
      setBolBusy(null);
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Embarques</p>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          + Capturar embarque
        </Button>
      </div>
      {shipments.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {rows.length ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Folio</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Transportista</th>
                <th className="px-3 py-2 font-medium">Camión / remolque</th>
                <th className="px-3 py-2 font-medium">Chofer</th>
                <th className="px-3 py-2 font-medium">Temperatura</th>
                <th className="px-3 py-2 font-medium">Fecha · hora</th>
                {tipo === "entrada" ? <th className="px-3 py-2 font-medium">Cruce</th> : null}
                {tipo === "entrada" ? <th className="px-3 py-2 font-medium">Manifiesto</th> : null}
                {tipo === "salida" ? <th className="px-3 py-2 font-medium">BOL</th> : null}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-mono text-xs">{s.shipment_number}</td>
                  <td className="px-3 py-2">
                    <Badge tone={statusTone(s.status)}>
                      {SHIPMENT_STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">{s.carrier_name || "—"}</td>
                  <td className="px-3 py-2 text-muted">
                    {s.truck_plates || "—"}
                    {s.truck_economic ? ` · Eco ${s.truck_economic}` : ""}
                    {s.trailer_plates ? (
                      <div className="text-xs">Remolque {s.trailer_plates}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {s.driver_name || "—"}
                    {s.driver_license ? (
                      <div className="text-xs">Lic. {s.driver_license}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatTempRange(s.temp_min, s.temp_max, s.temp_unit)}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {s.ship_date ? fecha(s.ship_date) : "—"}
                    {s.load_time ? <div className="text-xs">{s.load_time}</div> : null}
                  </td>
                  {tipo === "entrada" ? (
                    <td className="px-3 py-2 text-muted">
                      {s.crossing_name || "—"}
                      {s.crossing_date ? (
                        <div className="text-xs">{fecha(s.crossing_date)}</div>
                      ) : null}
                    </td>
                  ) : null}
                  {tipo === "entrada" ? (
                    <td className="px-3 py-2 text-muted">{s.manifest_number || "—"}</td>
                  ) : null}
                  {tipo === "salida" ? (
                    <td className="px-3 py-2 font-mono text-xs">{s.bol_number || "—"}</td>
                  ) : null}
                  <td className="px-3 py-2 text-right">
                    {tipo === "salida" ? (
                      <button
                        type="button"
                        className="mr-3 cursor-pointer text-xs text-link disabled:opacity-50"
                        disabled={bolBusy != null}
                        onClick={() => void printBol(s)}
                      >
                        {bolBusy === s.id
                          ? "Generando…"
                          : s.bol_number
                            ? "Reimprimir BOL"
                            : "Imprimir BOL"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-link"
                      onClick={() => setEditing(s)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !shipments.loading ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted">
          Sin embarques capturados para esta orden.
        </p>
      ) : null}
      {bolErr ? (
        <p className="mt-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
          {bolErr}
        </p>
      ) : null}
      {editing ? (
        <ShipmentModal
          tipo={tipo}
          purchaseOrderId={purchaseOrderId}
          salesOrderId={salesOrderId}
          bol={bol}
          vendorInvoice={vendorInvoice}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await shipments.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function emptyForm() {
  return {
    carrier_id: "",
    truck_unit_id: "",
    trailer_unit_id: "",
    driver_id: "",
    temp_min: "",
    temp_max: "",
    temp_unit: "F",
    load_time: "",
    ship_date: "",
    seals: "",
    pallet_count: "",
    notes: "",
    customs_broker_mx_id: "",
    reference_mx: "",
    customs_broker_us_id: "",
    reference_us: "",
    border_crossing_id: "",
    crossing_date: "",
    incoterm: "",
    incoterm_place: "",
    manifest_number: "",
    status: "pendiente",
  };
}

export function ShipmentModal({
  tipo,
  purchaseOrderId,
  salesOrderId,
  bol,
  vendorInvoice,
  existing,
  onClose,
  onSaved,
}: {
  tipo: Tipo;
  purchaseOrderId?: number;
  salesOrderId?: number;
  bol?: string | null;
  vendorInvoice?: string | null;
  existing: Shipment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const carriers = useAsync(() => listCarriers(), []);
  const units = useAsync(() => listCarrierUnits(), []);
  const drivers = useAsync(() => listDrivers(), []);
  const brokers = useAsync(() => listCustomsBrokers(), []);
  const crossings = useAsync(() => listBorderCrossings(), []);
  const lists = useAsync(() => listValueLists(), []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    existing
      ? {
          carrier_id: existing.carrier_id != null ? String(existing.carrier_id) : "",
          truck_unit_id: existing.truck_unit_id != null ? String(existing.truck_unit_id) : "",
          trailer_unit_id: existing.trailer_unit_id != null ? String(existing.trailer_unit_id) : "",
          driver_id: existing.driver_id != null ? String(existing.driver_id) : "",
          temp_min: existing.temp_min != null ? String(existing.temp_min) : "",
          temp_max: existing.temp_max != null ? String(existing.temp_max) : "",
          temp_unit: existing.temp_unit || "F",
          load_time: existing.load_time || "",
          ship_date: existing.ship_date || "",
          seals: existing.seals || "",
          pallet_count: existing.pallet_count != null ? String(existing.pallet_count) : "",
          notes: existing.notes || "",
          customs_broker_mx_id:
            existing.customs_broker_mx_id != null ? String(existing.customs_broker_mx_id) : "",
          reference_mx: existing.reference_mx || "",
          customs_broker_us_id:
            existing.customs_broker_us_id != null ? String(existing.customs_broker_us_id) : "",
          reference_us: existing.reference_us || "",
          border_crossing_id:
            existing.border_crossing_id != null ? String(existing.border_crossing_id) : "",
          crossing_date: existing.crossing_date || "",
          incoterm: existing.incoterm || "",
          incoterm_place: existing.incoterm_place || "",
          manifest_number: existing.manifest_number || "",
          status: existing.status,
        }
      : emptyForm(),
  );

  const carrierId = form.carrier_id ? Number(form.carrier_id) : null;
  // Filtrados por el transportista elegido. Los inactivos no se ofrecen,
  // salvo el que ya trae un embarque viejo (para no romper su edición).
  // produce-server queries are untyped (Promise<any>) — keep these rows loose
  // like the rest of the repo does, filtering only on the fields we know.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick = (rows: any[] | null | undefined, current: string) =>
    (rows ?? []).filter(
      (u) => u.carrier_id === carrierId && (u.is_active || String(u.id) === current),
    );
  const trucks = useMemo(
    () =>
      pick(
        (units.data ?? []).filter((u) => u.unit_type === "camion"),
        form.truck_unit_id,
      ),
    [units.data, carrierId, form.truck_unit_id],
  );
  const trailers = useMemo(
    () =>
      pick(
        (units.data ?? []).filter((u) => u.unit_type === "remolque"),
        form.trailer_unit_id,
      ),
    [units.data, carrierId, form.trailer_unit_id],
  );
  const carrierDrivers = useMemo(
    () => pick(drivers.data, form.driver_id),
    [drivers.data, carrierId, form.driver_id],
  );
  const brokersMx = (brokers.data ?? []).filter(
    (b) => b.country === "MX" && (b.is_active || String(b.id) === form.customs_broker_mx_id),
  );
  const brokersUs = (brokers.data ?? []).filter(
    (b) => b.country === "US" && (b.is_active || String(b.id) === form.customs_broker_us_id),
  );
  const activeCrossings = (crossings.data ?? []).filter(
    (c) => c.is_active || String(c.id) === form.border_crossing_id,
  );

  function onCarrierChange(value: string) {
    // Cambiar de línea invalida camión, remolque y chofer: son de la otra.
    setForm({ ...form, carrier_id: value, truck_unit_id: "", trailer_unit_id: "", driver_id: "" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const common = {
        carrier_id: form.carrier_id ? Number(form.carrier_id) : null,
        truck_unit_id: form.truck_unit_id ? Number(form.truck_unit_id) : null,
        trailer_unit_id: form.trailer_unit_id ? Number(form.trailer_unit_id) : null,
        driver_id: form.driver_id ? Number(form.driver_id) : null,
        temp_min: form.temp_min !== "" ? Number(form.temp_min) : null,
        temp_max: form.temp_max !== "" ? Number(form.temp_max) : null,
        temp_unit:
          form.temp_min !== "" || form.temp_max !== "" ? (form.temp_unit as "F" | "C") : null,
        load_time: form.load_time || undefined,
        ship_date: form.ship_date || undefined,
        seals: form.seals || undefined,
        notes: form.notes || undefined,
        status: form.status,
        // Solo salida: el conteo manual de pallets que imprime el BOL.
        ...(tipo === "salida"
          ? { pallet_count: form.pallet_count !== "" ? Number(form.pallet_count) : null }
          : {}),
        // Aduana: solo un embarque de entrada los manda.
        ...(tipo === "entrada"
          ? {
              customs_broker_mx_id: form.customs_broker_mx_id
                ? Number(form.customs_broker_mx_id)
                : null,
              reference_mx: form.reference_mx || undefined,
              customs_broker_us_id: form.customs_broker_us_id
                ? Number(form.customs_broker_us_id)
                : null,
              reference_us: form.reference_us || undefined,
              border_crossing_id: form.border_crossing_id ? Number(form.border_crossing_id) : null,
              crossing_date: form.crossing_date || undefined,
              incoterm: form.incoterm || undefined,
              incoterm_place: form.incoterm_place || undefined,
              manifest_number: form.manifest_number || undefined,
            }
          : {}),
      };
      if (existing) {
        await updateShipment({ data: { ...common, id: existing.id } });
      } else {
        await createShipment({
          data: {
            ...common,
            shipment_type: tipo,
            purchase_order_id: purchaseOrderId,
            sales_order_id: salesOrderId,
          },
        });
      }
      await onSaved();
    } catch (e2) {
      setErr(errorMessage(e2, "No se pudo guardar el embarque."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={
        existing
          ? `Editar embarque ${existing.shipment_number}`
          : tipo === "entrada"
            ? "Capturar embarque de entrada"
            : "Capturar embarque de salida"
      }
      onClose={onClose}
    >
      <form onSubmit={(e) => void save(e)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Línea transportista">
            <Select value={form.carrier_id} onChange={(e) => onCarrierChange(e.target.value)}>
              <option value="">Seleccionar</option>
              {(carriers.data ?? [])
                .filter((c) => c.is_active || String(c.id) === form.carrier_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Camión (placas)">
            <Select
              value={form.truck_unit_id}
              onChange={(e) => setForm({ ...form, truck_unit_id: e.target.value })}
              disabled={!carrierId}
            >
              <option value="">{carrierId ? "Seleccionar" : "Elige transportista"}</option>
              {trucks.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.plates}
                  {u.economic_number ? ` · Eco ${u.economic_number}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Remolque (placas)">
            <Select
              value={form.trailer_unit_id}
              onChange={(e) => setForm({ ...form, trailer_unit_id: e.target.value })}
              disabled={!carrierId}
            >
              <option value="">{carrierId ? "Seleccionar" : "Elige transportista"}</option>
              {trailers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.plates}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chofer">
            <Select
              value={form.driver_id}
              onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
              disabled={!carrierId}
            >
              <option value="">{carrierId ? "Seleccionar" : "Elige transportista"}</option>
              {carrierDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.license_number ? ` · ${d.license_number}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Temperatura mín.">
            <Input
              value={form.temp_min}
              onChange={(e) => setForm({ ...form, temp_min: e.target.value })}
              placeholder="45"
            />
          </Field>
          <Field label="Temperatura máx.">
            <Input
              value={form.temp_max}
              onChange={(e) => setForm({ ...form, temp_max: e.target.value })}
              placeholder="48"
            />
          </Field>
          <Field label="Unidad">
            <Select
              value={form.temp_unit}
              onChange={(e) => setForm({ ...form, temp_unit: e.target.value })}
            >
              <option value="F">°F</option>
              <option value="C">°C</option>
            </Select>
          </Field>
          <Field label="Estado del embarque">
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {SHIPMENT_STATUSES[tipo].map((s) => (
                <option key={s} value={s}>
                  {SHIPMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fecha de embarque">
            <Input
              type="date"
              value={form.ship_date}
              onChange={(e) => setForm({ ...form, ship_date: e.target.value })}
            />
          </Field>
          <Field label="Hora de embarque">
            <Input
              type="time"
              value={form.load_time}
              onChange={(e) => setForm({ ...form, load_time: e.target.value })}
            />
          </Field>
          <Field label="Sellos" className="sm:col-span-2">
            <Input
              value={form.seals}
              onChange={(e) => setForm({ ...form, seals: e.target.value })}
              placeholder="Van varios, separados por coma"
            />
          </Field>
          {tipo === "salida" ? (
            <Field label="Pallets">
              <Input
                type="number"
                min="0"
                step="1"
                value={form.pallet_count}
                onChange={(e) => setForm({ ...form, pallet_count: e.target.value })}
                placeholder="Conteo para el BOL"
              />
            </Field>
          ) : null}
        </div>

        {tipo === "entrada" ? (
          <>
            <p className="mt-4 mb-2 text-sm font-semibold">Aduana</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Agencia aduanal MX">
                <Select
                  value={form.customs_broker_mx_id}
                  onChange={(e) => setForm({ ...form, customs_broker_mx_id: e.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {brokersMx.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Referencia MX (pedimento)">
                <Input
                  value={form.reference_mx}
                  onChange={(e) => setForm({ ...form, reference_mx: e.target.value })}
                />
              </Field>
              <Field label="Agencia aduanal US">
                <Select
                  value={form.customs_broker_us_id}
                  onChange={(e) => setForm({ ...form, customs_broker_us_id: e.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {brokersUs.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Referencia US (entry)">
                <Input
                  value={form.reference_us}
                  onChange={(e) => setForm({ ...form, reference_us: e.target.value })}
                />
              </Field>
              <Field label="Punto de cruce">
                <Select
                  value={form.border_crossing_id}
                  onChange={(e) => setForm({ ...form, border_crossing_id: e.target.value })}
                >
                  <option value="">Seleccionar</option>
                  {activeCrossings.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha de cruce">
                <Input
                  type="date"
                  value={form.crossing_date}
                  onChange={(e) => setForm({ ...form, crossing_date: e.target.value })}
                />
              </Field>
              <Field label="Incoterm">
                <Select
                  value={form.incoterm}
                  onChange={(e) => setForm({ ...form, incoterm: e.target.value })}
                >
                  <option value="">Sin incoterm</option>
                  {(lists.data?.incoterm ?? []).map((i) => (
                    <option key={i.id} value={i.value}>
                      {i.value}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Lugar del incoterm">
                <Input
                  value={form.incoterm_place}
                  onChange={(e) => setForm({ ...form, incoterm_place: e.target.value })}
                  placeholder="McAllen, TX"
                />
              </Field>
              <Field label="No. de manifiesto">
                <Input
                  value={form.manifest_number}
                  onChange={(e) => setForm({ ...form, manifest_number: e.target.value })}
                />
              </Field>
            </div>
            <p className="mt-3 rounded-md border border-border bg-surface-2 p-2 text-xs text-muted">
              BOL: <strong>{bol || "—"}</strong> · Factura del productor:{" "}
              <strong>{vendorInvoice || "—"}</strong> — viven en la orden de compra; se corrigen con
              «Edit order», no aquí.
            </p>
          </>
        ) : null}

        <Field label="Notas" className="mt-3">
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        {err ? (
          <p className="mt-3 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
            {err}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : existing ? "Guardar cambios" : "Capturar embarque"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
