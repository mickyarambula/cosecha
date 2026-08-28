import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Modal, PageHeader, Panel } from "@/components/app-shell";
import { packsToSkus, SkuSelect } from "@/components/sku-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SendButton } from "@/components/send-doc";
import { CustomerLocationModal, type CustomerLocationDraft } from "@/components/customer-location-form";
import {
  convertCustomerPOToSO,
  createCustomerPO,
  extractCustomerPO,
  listCustomerLocations,
  listCustomerPOs,
  listCustomers,
  listProducts,
  rejectCustomerPO,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, qty, skuLabel, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/cpo")({ component: Page });

type LineDraft = { product_id: string; pack_style_id: string; qty: string; unit: string; unit_price: string };

// El CPO tiene su propio ciclo (abierto/confirmado/rechazado) — nunca el de
// factura ("Unpaid"), aunque ambos compartan el string interno "open".
function cpoLabel(status: string) {
  if (status === "open") return "Open";
  if (status === "converted") return "Confirmed";
  if (status === "rejected") return "Rejected";
  return status;
}
function cpoTone(status: string) {
  if (status === "open") return "warn" as const;
  if (status === "converted") return "ok" as const;
  if (status === "rejected") return "danger" as const;
  return "mute" as const;
}

function emptyLine(): LineDraft {
  return { product_id: "", pack_style_id: "", qty: "", unit: "caja", unit_price: "" };
}

function emptyForm() {
  return {
    customer_id: "",
    customer_po_number: "",
    po_date: todayISO(),
    requested_date: "",
    currency: "USD",
    payment_terms: "",
    ship_to_location_id: "",
    notes: "",
  };
}

function RejectDialog({
  cpoNumber,
  onClose,
  onConfirm,
}: {
  cpoNumber: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr("Escribe el motivo del rechazo.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(trimmed);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo rechazar");
      setBusy(false);
    }
  }

  return (
    <Modal title={`Rechazar ${cpoNumber}`} subtitle="Plein no tiene abasto para este PO" onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Motivo *">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-24"
            placeholder="Ej. Sin producto disponible en esta calidad/fecha"
          />
        </Field>
        {err ? <p className="text-sm text-danger">{err}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            No, regresar
          </Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {busy ? "Rechazando…" : "Sí, rechazar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Page() {
  const cpos = useAsync(() => listCustomerPOs(), []);
  const customers = useAsync(() => listCustomers(), []);
  const products = useAsync(() => listProducts(), []);
  const locations = useAsync(() => listCustomerLocations({ data: {} }), []);
  const skus = packsToSkus(products.data ?? []);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState(emptyForm());
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);
  const [extractErr, setExtractErr] = useState<string | null>(null);
  const [detectedShipTo, setDetectedShipTo] = useState<CustomerLocationDraft | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const customerLocations = useMemo(
    () => (locations.data ?? []).filter((l) => l.customer_id === Number(form.customer_id)),
    [locations.data, form.customer_id],
  );
  const selectedLocation = customerLocations.find((l) => l.id === Number(form.ship_to_location_id)) ?? null;

  const list = cpos.data ?? [];
  const kpis = useMemo(() => {
    const abiertos = list.filter((c) => c.status === "open").length;
    const convertidos = list.filter((c) => c.status === "converted").length;
    const mes = todayISO().slice(0, 7);
    const delMes = list.filter((c) => (c.po_date || "").startsWith(mes)).length;
    return { abiertos, convertidos, delMes };
  }, [list]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!needle) return true;
      const blob = `${c.cpo_number} ${c.customer_name} ${c.customer_po_number ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [list, q, status]);

  const selected = list.find((c) => c.id === detail) ?? null;
  const selectedCustomer = selected ? (customers.data ?? []).find((c) => c.id === selected.customer_id) : null;

  function closeCreate() {
    setOpen(false);
    setForm(emptyForm());
    setLines([emptyLine()]);
    setFile(null);
    setFileInputKey((k) => k + 1);
    setExtractMsg(null);
    setExtractErr(null);
    setDetectedShipTo(null);
  }

  function onCustomerChange(customerId: string) {
    const custLocs = (locations.data ?? []).filter((l) => l.customer_id === Number(customerId));
    const def = custLocs.find((l) => l.is_default) ?? (custLocs.length === 1 ? custLocs[0] : null);
    setDetectedShipTo(null);
    setForm((prev) => ({ ...prev, customer_id: customerId, ship_to_location_id: def ? String(def.id) : "" }));
  }

  async function onFile(f: File | null) {
    setFile(f);
    setExtractMsg(null);
    setExtractErr(null);
    if (!f) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await extractCustomerPO({ data: fd });
      if (!r.ok) {
        setExtractErr(r.reason);
        return;
      }
      const d = r.data;
      setForm((prev) => ({
        ...prev,
        customer_id: d.customer_id ? String(d.customer_id) : prev.customer_id,
        customer_po_number: d.customer_po_number || prev.customer_po_number,
        po_date: d.po_date || prev.po_date,
        requested_date: d.requested_date || prev.requested_date,
        currency: d.currency || prev.currency,
        payment_terms: d.payment_terms || prev.payment_terms,
        ship_to_location_id: d.ship_to_location_id ? String(d.ship_to_location_id) : prev.ship_to_location_id,
        notes: d.notes || prev.notes,
      }));
      if (d.lines.length) {
        setLines(
          d.lines.map((l) => ({
            product_id: l.product_id ? String(l.product_id) : "",
            pack_style_id: l.pack_style_id ? String(l.pack_style_id) : "",
            qty: l.quantity != null ? String(l.quantity) : "",
            unit: l.unit || "caja",
            unit_price: l.unit_price != null ? String(l.unit_price) : "",
          })),
        );
      }
      if (!d.ship_to_location_id && d.ship_to_address_line) {
        setDetectedShipTo({
          address_line: d.ship_to_address_line,
          city: d.ship_to_city,
          state: d.ship_to_state,
          zip: d.ship_to_zip,
        });
      } else {
        setDetectedShipTo(null);
      }
      const sinCoincidencia = d.lines.filter((l) => !l.pack_style_id).length;
      const notas: string[] = ["Leído automáticamente — revisa los datos antes de guardar."];
      if (!d.customer_id && d.customer_name) notas.push(`Cliente en el PO: "${d.customer_name}" — no coincide con el catálogo, selecciónalo a mano.`);
      if (sinCoincidencia) notas.push(`${sinCoincidencia} línea(s) sin SKU reconocido — complétalas a mano.`);
      if (!d.ship_to_location_id && d.ship_to_address_line) notas.push("El PO trae un destino de entrega que no está en la lista — revisa abajo.");
      setExtractMsg(notas.join(" "));
    } catch (e) {
      setExtractErr(e instanceof Error ? e.message : "No se pudo leer el archivo");
    } finally {
      setExtracting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ready = lines.filter((l) => l.product_id && Number(l.qty) > 0);
    if (!ready.length) {
      setErr("Agrega al menos un producto con cantidad.");
      return;
    }
    if (!form.requested_date) {
      setErr("Captura la fecha de entrega solicitada por el cliente.");
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append(
        "payload",
        JSON.stringify({
          customer_id: Number(form.customer_id),
          customer_po_number: form.customer_po_number || undefined,
          po_date: form.po_date || undefined,
          requested_date: form.requested_date || undefined,
          currency: form.currency,
          payment_terms: form.payment_terms || undefined,
          ship_to_location_id: form.ship_to_location_id ? Number(form.ship_to_location_id) : undefined,
          notes: form.notes || undefined,
          lines: ready.map((l) => ({
            product_id: Number(l.product_id),
            pack_style_id: l.pack_style_id ? Number(l.pack_style_id) : undefined,
            quantity: Number(l.qty),
            unit: l.unit || "caja",
            unit_price: l.unit_price ? Number(l.unit_price) : undefined,
          })),
        }),
      );
      if (file) fd.append("file", file);
      const r = await createCustomerPO({ data: fd });
      closeCreate();
      setMsg(`Customer PO ${r.cpo_number} capturado`);
      await cpos.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo crear");
    } finally {
      setSaving(false);
    }
  }

  async function convertir(id: number) {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await convertCustomerPOToSO({ data: { customer_po_id: id } });
      setDetail(null);
      setMsg(`${r.cpo_number} converted to ${r.so_number}`);
      await cpos.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Could not convert");
    } finally {
      setSaving(false);
    }
  }

  async function rechazar(id: number, reason: string) {
    const r = await rejectCustomerPO({ data: { customer_po_id: id, reason } });
    setRejecting(false);
    setDetail(null);
    setMsg(`${r.cpo_number} rechazado`);
    await cpos.reload();
  }

  return (
    <div>
      <PageHeader
        title="Online orders"
        subtitle="Capture the customer PO and convert it to a sales order."
        action={<Button onClick={() => setOpen(true)}>New customer PO</Button>}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="Open CPOs" value={String(kpis.abiertos)} tone={kpis.abiertos ? "warn" : "ok"} />
        <Kpi label="Converted" value={String(kpis.convertidos)} tone="ok" />
        <Kpi label="This month" value={String(kpis.delMes)} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {err && !open && !detail ? <p className="mb-3 text-sm text-danger">{err}</p> : null}
      {cpos.loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {cpos.error ? <p className="text-sm text-danger">{cpos.error}</p> : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="max-w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="converted">Converted</option>
          <option value="rejected">Rejected</option>
        </Select>
        <Input
          className="max-w-sm"
          placeholder="Search folio, customer or PO #…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="ml-auto text-xs text-subtle">
          {filtered.length} de {list.length} customer PO
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Customer PO #</th>
              <th className="px-4 py-3 font-medium">PO date</th>
              <th className="px-4 py-3 font-medium">Delivery</th>
              <th className="px-4 py-3 font-medium">Currency</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Attachment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cpo) => (
              <tr key={cpo.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="font-mono text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setErr(null);
                      setDetail(cpo.id);
                    }}
                  >
                    {cpo.cpo_number}
                  </button>
                </td>
                <td className="px-4 py-3 font-medium">{cpo.customer_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{cpo.customer_po_number ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{fecha(cpo.po_date)}</td>
                <td className="px-4 py-3 text-muted">{cpo.requested_date ? fecha(cpo.requested_date) : "—"}</td>
                <td className="px-4 py-3">{cpo.currency}</td>
                <td className="px-4 py-3">
                  <Badge tone={cpoTone(cpo.status)}>{cpoLabel(cpo.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  {cpo.has_attachment ? (
                    <a
                      href={`/api/cpo-attachment/${cpo.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Ver adjunto
                    </a>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !cpos.loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                  No hay Customer PO con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal wide title="New customer PO" subtitle="Capture the PO the customer sent" onClose={closeCreate}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Archivo del PO (PDF o foto)">
              <Input
                key={fileInputKey}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </Field>
            {extracting ? <p className="text-xs text-muted">Leyendo el archivo…</p> : null}
            {extractMsg ? <p className="text-xs text-ok">{extractMsg}</p> : null}
            {extractErr ? <p className="text-xs text-danger">No pude leerlo: {extractErr} Captura los datos a mano.</p> : null}
            <Field label="Customer *">
              <Select required value={form.customer_id} onChange={(e) => onCustomerChange(e.target.value)}>
                <option value="">Seleccionar</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            {form.customer_id ? (
              <Field label="Destino de entrega">
                <Select
                  value={form.ship_to_location_id}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setAddingLocation(true);
                      return;
                    }
                    setForm({ ...form, ship_to_location_id: e.target.value });
                  }}
                >
                  <option value="">Sin destino capturado</option>
                  {customerLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {[l.label, l.address_line, l.city].filter(Boolean).join(" · ")}
                      {l.is_default ? " (habitual)" : ""}
                    </option>
                  ))}
                  <option value="__new__">+ Nuevo destino…</option>
                </Select>
              </Field>
            ) : null}
            {selectedLocation?.receiving_instructions ? (
              <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
                <p className="mb-1 font-semibold uppercase tracking-wide text-muted">Instrucciones de recibo en este destino</p>
                <p className="whitespace-pre-wrap">{selectedLocation.receiving_instructions}</p>
              </div>
            ) : null}
            {detectedShipTo ? (
              <div className="rounded-md border border-danger/40 bg-danger/5 p-3 text-xs">
                <p className="mb-1 font-semibold uppercase tracking-wide text-danger">Destino detectado en el PO — no está en la lista</p>
                <p>
                  {[detectedShipTo.address_line, detectedShipTo.city, detectedShipTo.state, detectedShipTo.zip].filter(Boolean).join(", ")}
                </p>
                <button
                  type="button"
                  className="mt-2 font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setAddingLocation(true)}
                >
                  Agregar este destino
                </button>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="N° de PO del cliente">
                <Input
                  placeholder="Ej. NGM247514"
                  value={form.customer_po_number}
                  onChange={(e) => setForm({ ...form, customer_po_number: e.target.value })}
                />
              </Field>
              <Field label="Fecha del PO">
                <Input type="date" value={form.po_date} onChange={(e) => setForm({ ...form, po_date: e.target.value })} />
              </Field>
            </div>
            <Field label="Fecha de entrega solicitada *">
              <Input
                required
                type="date"
                value={form.requested_date}
                onChange={(e) => setForm({ ...form, requested_date: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Moneda">
                <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </Select>
              </Field>
              <Field label="Condiciones de pago">
                <Input
                  placeholder="Ej. Net 21"
                  value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lines</p>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <SkuSelect
                        required
                        value={line.pack_style_id}
                        skus={skus}
                        onPick={(sku) => {
                          setLines((prev) =>
                            prev.map((l, idx) =>
                              idx === i
                                ? {
                                    ...l,
                                    pack_style_id: sku ? String(sku.id) : "",
                                    product_id: sku ? String(sku.product_id) : "",
                                    unit: sku?.unit || l.unit,
                                  }
                                : l,
                            ),
                          );
                        }}
                      />
                    </div>
                    <Field label="Cantidad">
                      <Input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.qty}
                        onChange={(e) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, qty: e.target.value } : l)))}
                      />
                    </Field>
                    <Field label="Precio unitario">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) =>
                          setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, unit_price: e.target.value } : l)))
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                + Add line
              </button>
            </div>
            <Field label="Nota">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {err && open ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create customer PO"}
              </Button>
              <Button type="button" variant="outline" onClick={closeCreate}>
                Cancelar
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {addingLocation && form.customer_id ? (
        <CustomerLocationModal
          customerId={Number(form.customer_id)}
          initial={detectedShipTo ?? undefined}
          forceDefault={customerLocations.length === 0}
          onClose={() => setAddingLocation(false)}
          onSaved={async ({ id }) => {
            setAddingLocation(false);
            setDetectedShipTo(null);
            await locations.reload();
            setForm((prev) => ({ ...prev, ship_to_location_id: String(id) }));
          }}
        />
      ) : null}

      {selected ? (
        <Modal
          wide
          title={`Customer PO ${selected.cpo_number}`}
          subtitle={selected.customer_name}
          onClose={() => setDetail(null)}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Customer</p>
              <p className="mt-1 text-sm font-medium">{selected.customer_name}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">N° cliente</p>
              <p className="mt-1 font-mono text-sm">{selected.customer_po_number ?? "—"}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Fecha PO</p>
              <p className="mt-1 text-sm">{fecha(selected.po_date)}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Fecha de entrega solicitada</p>
              <p className="mt-1 text-sm">{selected.requested_date ? fecha(selected.requested_date) : "—"}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Moneda</p>
              <p className="mt-1 text-sm">{selected.currency}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Condiciones de pago</p>
              <p className="mt-1 text-sm">{selected.payment_terms || "—"}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Estado</p>
              <div className="mt-1">
                <Badge tone={cpoTone(selected.status)}>{cpoLabel(selected.status)}</Badge>
              </div>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Adjunto</p>
              {selected.has_attachment ? (
                <a
                  href={`/api/cpo-attachment/${selected.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver adjunto{selected.attachment_filename ? ` (${selected.attachment_filename})` : ""}
                </a>
              ) : (
                <p className="mt-1 text-sm text-subtle">—</p>
              )}
            </Panel>
            <Panel className="p-3 sm:col-span-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Destino de entrega</p>
              {selected.ship_to_address_line ? (
                <>
                  <p className="mt-1 text-sm font-medium">
                    {[selected.ship_to_label, selected.ship_to_address_line].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted">
                    {[selected.ship_to_city, selected.ship_to_state, selected.ship_to_zip].filter(Boolean).join(", ")}
                  </p>
                  {selected.ship_to_instructions ? (
                    <p className="mt-2 whitespace-pre-wrap text-xs text-warn">{selected.ship_to_instructions}</p>
                  ) : null}
                </>
              ) : (
                <p className="mt-1 text-sm text-subtle">Sin destino capturado</p>
              )}
            </Panel>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 font-medium">SKU</th>
                  <th className="py-2 text-right font-medium">Cantidad</th>
                  <th className="py-2 text-right font-medium">Precio</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <span className="font-mono text-xs">{l.sku_code || l.product_name}</span>
                      {l.calibre || l.empaque ? (
                        <span className="block text-xs text-muted">{skuLabel({ name: l.product_name, variety: l.variety, empaque: l.empaque, calibre: l.calibre })}</span>
                      ) : (
                        <span className="block text-xs text-muted">{l.product_name}</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">{qty(l.quantity, l.unit)}</td>
                    <td className="py-2 text-right tabular-nums">{l.unit_price ? money(l.unit_price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected.notes ? <p className="mt-3 text-xs text-muted">{selected.notes}</p> : null}
          {selected.status === "rejected" ? (
            <p className="mt-3 text-xs text-danger">
              Rechazado por {selected.rejected_by || "—"} · {selected.rejected_at ? new Date(selected.rejected_at).toLocaleString() : ""}
              {selected.rejected_reason ? ` · ${selected.rejected_reason}` : ""}
            </p>
          ) : null}
          {err && detail ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.status === "open" ? (
              <>
                <Button disabled={saving} onClick={() => void convertir(selected.id)}>
                  {saving ? "Converting…" : "Convert to sales order"}
                </Button>
                <Button variant="outline" disabled={saving} onClick={() => setRejecting(true)}>
                  Rechazar
                </Button>
              </>
            ) : selected.so_number ? (
              <Link to="/ventas" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline">
                Ver venta {selected.so_number}
              </Link>
            ) : null}
            {selected.status === "converted" || selected.status === "rejected" ? (
              <SendButton
                title={selected.status === "rejected" ? "Rechazo de PO" : "Confirmación de pedido"}
                number={selected.status === "rejected" ? selected.cpo_number : selected.so_number || selected.cpo_number}
                partyName={selected.customer_name}
                email={selectedCustomer?.email}
                phone={selectedCustomer?.phone}
                docs={[]}
                lines={selected.lines.map((l) => ({
                  qty: l.quantity,
                  unit: l.unit,
                  name: l.product_name,
                  sku: l.sku_code,
                  unit_price: l.unit_price ?? undefined,
                  amount: l.unit_price ? l.quantity * l.unit_price : undefined,
                }))}
                total={selected.lines.reduce((s, l) => s + l.quantity * (l.unit_price || 0), 0)}
                pdf={{
                  kindLabel: selected.status === "rejected" ? "Customer PO — Rejected" : "Customer PO — Confirmed",
                  number: selected.cpo_number,
                  date: selected.po_date,
                  due: selected.requested_date,
                  dueLabel: "Delivery",
                  terms: null,
                  reference: selected.so_number,
                  partyTitle: "Customer",
                  party: { name: selected.customer_name, lines: [selectedCustomer?.email, selectedCustomer?.phone].filter((x): x is string => Boolean(x)) },
                  shipTitle: null,
                  ship: null,
                  lines: selected.lines.map((l) => ({
                    sku: l.sku_code || "",
                    description: l.product_name,
                    qty: l.quantity,
                    unit: l.unit,
                    unit_price: l.unit_price || 0,
                    amount: l.unit_price ? l.quantity * l.unit_price : 0,
                  })),
                  subtotal: selected.lines.reduce((s, l) => s + l.quantity * (l.unit_price || 0), 0),
                  total: selected.lines.reduce((s, l) => s + l.quantity * (l.unit_price || 0), 0),
                  notes: selected.status === "rejected" ? selected.rejected_reason : selected.notes,
                  showPaca: false,
                }}
              />
            ) : null}
            <Button variant="outline" onClick={() => setDetail(null)}>
              Cerrar
            </Button>
          </div>
        </Modal>
      ) : null}

      {rejecting && selected ? (
        <RejectDialog cpoNumber={selected.cpo_number} onClose={() => setRejecting(false)} onConfirm={(reason) => rechazar(selected.id, reason)} />
      ) : null}
    </div>
  );
}
