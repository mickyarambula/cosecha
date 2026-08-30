import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { listBorderCrossings, listShipments, setShipmentStatus } from "@/lib/produce-server";
import { poShort } from "@/lib/nav";
import { useAsync } from "@/lib/use-async";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABEL,
  errorMessage,
  fecha,
  formatTempRange,
} from "@/lib/utils";

export const Route = createFileRoute("/embarques")({ component: Page });

function Page() {
  const shipments = useAsync(() => listShipments({ data: {} }), []);
  const crossings = useAsync(() => listBorderCrossings(), []);
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [cruce, setCruce] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const list = useMemo(() => {
    return (shipments.data ?? [])
      .filter((s) => !tipo || s.shipment_type === tipo)
      .filter((s) => !estado || s.status === estado)
      .filter((s) => !cruce || String(s.border_crossing_id) === cruce);
  }, [shipments.data, tipo, estado, cruce]);

  async function cambiarEstado(id: number, status: string) {
    setErr(null);
    setSavingId(id);
    try {
      await setShipmentStatus({ data: { id, status } });
      await shipments.reload();
    } catch (e) {
      setErr(errorMessage(e, "No se pudo cambiar el estado del embarque."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="p-5">
      <PageHeader
        title="Embarques"
        subtitle="Entradas desde la orden de compra, salidas desde la orden de venta."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select className="max-w-40" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Entrada y salida</option>
          <option value="entrada">Solo entradas</option>
          <option value="salida">Solo salidas</option>
        </Select>
        <Select className="max-w-40" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {SHIPMENT_STATUSES.entrada.map((s) => (
            <option key={s} value={s}>
              {SHIPMENT_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select className="max-w-52" value={cruce} onChange={(e) => setCruce(e.target.value)}>
          <option value="">Todos los cruces</option>
          {(crossings.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {err ? (
        <p className="mb-3 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
          {err}
        </p>
      ) : null}
      {shipments.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-border text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Contraparte</th>
              <th className="px-4 py-3 font-medium">Transportista</th>
              <th className="px-4 py-3 font-medium">Cruce</th>
              <th className="px-4 py-3 font-medium">Temperatura</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{s.shipment_number}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.shipment_type === "entrada" ? "ok" : "warn"}>
                    {s.shipment_type === "entrada" ? "Entrada" : "Salida"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {s.po_number
                    ? `OC #${poShort(s.po_number)}`
                    : s.so_number
                      ? `OV #${poShort(s.so_number)}`
                      : "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {s.supplier_name || s.customer_name || "—"}
                </td>
                <td className="px-4 py-3 text-muted">
                  {s.carrier_name || "—"}
                  {s.truck_plates ? <div className="text-xs">{s.truck_plates}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted">
                  {s.crossing_name || "—"}
                  {s.crossing_date ? <div className="text-xs">{fecha(s.crossing_date)}</div> : null}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {formatTempRange(s.temp_min, s.temp_max, s.temp_unit)}
                </td>
                <td className="px-4 py-3 text-muted">{s.ship_date ? fecha(s.ship_date) : "—"}</td>
                <td className="px-4 py-3">
                  <Select
                    className="h-8 max-w-36 text-xs"
                    value={s.status}
                    disabled={savingId === s.id}
                    onChange={(e) => void cambiarEstado(s.id, e.target.value)}
                  >
                    {SHIPMENT_STATUSES[s.shipment_type as "entrada" | "salida"].map((st) => (
                      <option key={st} value={st}>
                        {SHIPMENT_STATUS_LABEL[st]}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
            {!shipments.loading && !list.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted">
                  Sin embarques con estos filtros. Se capturan desde el detalle de la orden de
                  compra o de venta.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
