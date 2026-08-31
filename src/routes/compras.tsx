import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Copy, MoreHorizontal, Printer, Trash2 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { MetaCard, Modal } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { ConceptSelect } from "@/components/concepts";
import { EmptyOrders, FilterField, FilterRow, ProductPicker } from "@/components/product-picker";
import { PalletsPanel } from "@/components/pallet-panel";
import { ShipmentsPanel } from "@/components/shipment-panel";
import { packsToSkus, type SkuOption } from "@/components/sku-select";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";
import { poShort } from "@/lib/nav";
import {
  applyAdvanceRecovery,
  applySettlement,
  cancelPurchaseOrder,
  createBillFromPO,
  createExpense,
  createPurchaseOrder,
  getSettlement,
  listLocations,
  listProducts,
  listPurchaseOrders,
  listSuppliers,
  receiveMerchandise,
  setExpenseChargedTo,
  setPoCommission,
  setVendorShare,
  updatePurchaseOrder,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import {
  DEFECTOS,
  INSPECCION_TIPOS,
  RESULTADOS_REC,
  fecha,
  money,
  pct,
  qty,
  todayISO,
} from "@/lib/utils";

type Search = { tab?: "all" | "new" };

export const Route = createFileRoute("/compras")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "new" ? "new" : "all",
  }),
  component: Page,
});

type RecLine = {
  line_id: number;
  product_name: string;
  sku_code: string | null;
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

type DraftLine = {
  key: string;
  product_id: number;
  pack_style_id?: number;
  name: string;
  unit: string;
  origin: string;
  qty: string;
  pallets: string;
  unitsPerPallet: string;
  cost: string;
  markup: string;
  netWeight: number | null;
  weightUnit: string;
  skuCode: string | null;
  calibre: string | null;
};

function ceilPallets(qty: string, unitsPerPallet: string): string {
  const q = Number(qty);
  const upp = Number(unitsPerPallet);
  if (!(q > 0) || !(upp > 0)) return "";
  return String(Math.ceil(q / upp));
}

function convertTemp(value: number, from: string, to: string): number {
  if (from === to) return value;
  return from === "C" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}

// Aviso, no bloqueo: la cámara opera a una temperatura fija; el producto
// tiene un rango recomendado. Si no se traslapan, se avisa al recibir.
function tempMismatch(
  setPoint: number | null | undefined,
  setUnit: string | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (setPoint == null || !setUnit || min == null || max == null || !unit) return null;
  const setInProductUnit = convertTemp(setPoint, setUnit, unit);
  if (setInProductUnit >= min - 0.5 && setInProductUnit <= max + 0.5) return null;
  return `necesita ${min}–${max}°${unit}, esta ubicación está a ${setPoint}°${setUnit}`;
}

const DEAL_TYPE_LABEL: Record<string, string> = {
  firme: "Firm",
  consignacion: "Consignment",
  comision: "Pure commission",
};

function commissionSummary(type: string | null | undefined, rate: number | null | undefined) {
  if (!type || rate == null) return null;
  if (type === "per_unit") return `${money(rate, 2)} / caja`;
  if (type === "gross_pct") return `${rate}% venta bruta`;
  return `${rate}% sobre neto`;
}

const GRUPOS: [keyof typeof DEFECTOS, string][] = [
  ["calidad", "Quality defect"],
  ["condicion", "Condition defect"],
  ["otro", "Other"],
];

function Page() {
  const t = useT();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const orders = useAsync(() => listPurchaseOrders(), []);
  const products = useAsync(() => listProducts(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const locations = useAsync(() => listLocations(), []);
  const skus = packsToSkus(products.data ?? []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [vendor, setVendor] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [recvPo, setRecvPo] = useState<number | null>(null);
  const [picker, setPicker] = useState(false);
  const [expenseFor, setExpenseFor] = useState<"draft" | number | null>(null);
  const [expMsg, setExpMsg] = useState<string | null>(null);
  const [shareId, setShareId] = useState<number | null>(null);
  const [shareLevel, setShareLevel] = useState<"po" | "basic" | "detailed">("po");
  const [settleId, setSettleId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [cancelPo, setCancelPo] = useState<{ id: number; po_number: string } | null>(null);
  const [draft, setDraft] = useState({
    supplier_id: "",
    deal_type: "",
    commission_type: "",
    commission_rate: "",
    order_type: "Delivery by vendor",
    expected_date: todayISO(),
    notes: "",
    bol: "",
    vendor_invoice: "",
    shipping_ref: "",
    noteVendor: true,
    print: false,
  });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [expDraft, setExpDraft] = useState({
    category: "Inspection Services",
    supplier_id: "",
    amount: "100",
    invoice: "",
    notes: "",
    payable: true,
    by: "pallet",
    charged_to: "plein",
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
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((p) => {
      if (status && p.status !== status) return false;
      if (vendor && String(p.supplier_id) !== vendor) return false;
      if (!s) return true;
      return (
        p.po_number.toLowerCase().includes(s) ||
        p.supplier_name.toLowerCase().includes(s) ||
        p.lines.some((l) => l.product_name.toLowerCase().includes(s))
      );
    });
  }, [list, q, status, vendor]);

  const po = list.find((p) => p.id === recvPo) ?? null;
  const sharePo = list.find((p) => p.id === shareId) ?? null;
  const units = lines.reduce((s, l) => s + Number(l.qty || 0), 0);
  const pallets = lines.reduce((s, l) => s + Number(l.pallets || 0), 0);
  const merch = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.cost || 0), 0);

  function addSku(sku: SkuOption) {
    const qty = "48";
    const unitsPerPallet = sku.units_per_pallet ? String(sku.units_per_pallet) : "48";
    setLines((prev) => [
      ...prev,
      {
        key: `${sku.id}-${Date.now()}`,
        product_id: sku.product_id,
        pack_style_id: sku.id || undefined,
        name: sku.product_name,
        unit: sku.empaque || sku.unit || sku.name,
        origin: "MX",
        qty,
        pallets: ceilPallets(qty, unitsPerPallet) || "1",
        unitsPerPallet,
        cost: "",
        markup: "",
        netWeight: sku.net_weight,
        weightUnit: sku.weight_unit,
        skuCode: sku.sku_code || null,
        calibre: sku.calibre || null,
      },
    ]);
    setPicker(false);
  }

  async function placeOrder() {
    if (!draft.supplier_id || !draft.deal_type || !lines.length) return;
    const isFirme = draft.deal_type === "firme";
    if (isFirme && lines.some((l) => !(Number(l.cost) > 0))) {
      setMsg("Trato en firme: captura el costo de cada línea.");
      return;
    }
    const withCommission = !isFirme && draft.commission_type && Number(draft.commission_rate) > 0;
    setSaving(true);
    setMsg(null);
    try {
      const r = await createPurchaseOrder({
        data: {
          supplier_id: Number(draft.supplier_id),
          deal_type: draft.deal_type as "firme" | "consignacion" | "comision",
          commission_type: withCommission
            ? (draft.commission_type as "per_unit" | "gross_pct" | "net_pct")
            : undefined,
          commission_rate: withCommission ? Number(draft.commission_rate) : undefined,
          expected_date: draft.expected_date || undefined,
          notes: draft.notes || undefined,
          order_type: draft.order_type,
          bol: draft.bol || undefined,
          vendor_invoice: draft.vendor_invoice || undefined,
          shipping_ref: draft.shipping_ref || undefined,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            pack_style_id: l.pack_style_id,
            quantity_ordered: Number(l.qty),
            unit: l.unit,
            unit_cost: isFirme && l.cost ? Number(l.cost) : undefined,
            pallets: l.pallets ? Number(l.pallets) : undefined,
            units_per_pallet: l.unitsPerPallet ? Number(l.unitsPerPallet) : undefined,
            origin_country: l.origin,
          })),
        },
      });
      setLines([]);
      setMsg(`PO ${r.po_number} placed`);
      await orders.reload();
      navigate({ to: "/compras", search: { tab: "all" } });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense() {
    const poId = expenseFor === "draft" ? undefined : (expenseFor ?? undefined);
    if (!expDraft.supplier_id && !draft.supplier_id) {
      setExpMsg("Escoge a quién se le paga este gasto.");
      return;
    }
    if (!(Number(expDraft.amount) > 0)) {
      setExpMsg("Captura el monto del gasto.");
      return;
    }
    setExpMsg(null);
    setSaving(true);
    try {
      await createExpense({
        data: {
          category: expDraft.category,
          supplier_id: Number(expDraft.supplier_id || draft.supplier_id),
          purchase_order_id: typeof poId === "number" ? poId : undefined,
          amount: Number(expDraft.amount),
          invoice_number: expDraft.invoice || undefined,
          notes: expDraft.notes || undefined,
          payable: expDraft.payable,
          alloc_by: expDraft.by as "pallet" | "unit",
          charged_to: expDraft.charged_to as "grower" | "plein",
        },
      });
      setExpenseFor(null);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create expense");
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
          // Con varias líneas del mismo producto en distinto calibre, el nombre
          // solo no alcanza para saber cuál estás recibiendo.
          product_name: [l.product_name, l.calibre].filter(Boolean).join(" · "),
          sku_code: l.sku_code || null,
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
      setMsg("This purchase has nothing left to receive.");
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

  async function doReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!po) return;
    const activas = recLines.filter((l) => l.resultado);
    if (!activas.length) {
      setWarn("Choose a result on at least one line.");
      return;
    }
    for (const l of activas) {
      if (l.resultado !== "Aceptada con incidencia") continue;
      const afectada = Number(l.afectada);
      if (!l.afectada.trim() || !(afectada > 0)) {
        setWarn(`${l.product_name}: captura cuánto viene afectado.`);
        return;
      }
      if (afectada > Number(l.cantidad) + 1e-9) {
        setWarn(`${l.product_name}: lo afectado no puede ser mayor que lo recibido.`);
        return;
      }
    }
    if (!rec.location_id) {
      setWarn("Choose a destination.");
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
              affected_qty:
                l.resultado === "Aceptada con incidencia" ? Number(l.afectada) : undefined,
              defect_type: tieneDefecto ? tipo || undefined : undefined,
              defect_reason: tieneDefecto ? resto.join("::") || undefined : undefined,
              notes: l.nota || undefined,
            };
          }),
        },
      });
      setRecvPo(null);
      setMsg(`Received ${r.po_number}`);
      await orders.reload();
    } catch (err) {
      setWarn(err instanceof Error ? err.message : "Could not receive");
    } finally {
      setSaving(false);
    }
  }

  async function facturarProv(poId: number) {
    setSaving(true);
    try {
      const r = await createBillFromPO({ data: { purchase_order_id: poId } });
      setMsg(`Vendor bill ${r.bill_number} for ${money(r.total)}`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not bill");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "new") {
    const vendorName = (suppliers.data ?? []).find((s) => String(s.id) === draft.supplier_id)?.name;
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
        {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <MetaCard
            label="Vendor"
            action={
              <Link to="/proveedores" className="text-xs text-link">
                Add new
              </Link>
            }
          >
            <Select
              value={draft.supplier_id}
              onChange={(e) => {
                const supplier_id = e.target.value;
                const sup = (suppliers.data ?? []).find((s) => String(s.id) === supplier_id);
                setDraft({
                  ...draft,
                  supplier_id,
                  // Default del proveedor, editable por carga.
                  commission_type: sup?.commission_type ?? "",
                  commission_rate: sup?.commission_rate != null ? String(sup.commission_rate) : "",
                });
              }}
            >
              <option value="">Search your vendors</option>
              {(suppliers.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </MetaCard>
          <MetaCard label="Deal type">
            <Select
              value={draft.deal_type}
              onChange={(e) => {
                const deal_type = e.target.value;
                setDraft({ ...draft, deal_type });
                if (deal_type !== "firme") setLines((p) => p.map((l) => ({ ...l, cost: "" })));
              }}
            >
              <option value="">Select</option>
              <option value="firme">Firme (precio cerrado)</option>
              <option value="consignacion">Consignación (PAS)</option>
              <option value="comision">Comisión pura</option>
            </Select>
          </MetaCard>
          {draft.deal_type && draft.deal_type !== "firme" ? (
            <MetaCard label="Plein commission">
              <div className="flex gap-2">
                <Select
                  value={draft.commission_type}
                  onChange={(e) => setDraft({ ...draft, commission_type: e.target.value })}
                >
                  <option value="">Select</option>
                  <option value="per_unit">Por caja ($)</option>
                  <option value="gross_pct">% venta bruta</option>
                  <option value="net_pct">% sobre neto</option>
                </Select>
                <Input
                  className="w-20"
                  placeholder={draft.commission_type === "per_unit" ? "$" : "%"}
                  value={draft.commission_rate}
                  onChange={(e) => setDraft({ ...draft, commission_rate: e.target.value })}
                />
              </div>
            </MetaCard>
          ) : null}
          <MetaCard label="Order type">
            <Select
              value={draft.order_type}
              onChange={(e) => setDraft({ ...draft, order_type: e.target.value })}
            >
              <option>Delivery by vendor</option>
              <option>Pickup</option>
              <option>Will-call</option>
            </Select>
          </MetaCard>
          <MetaCard label="Requested date">
            <Input
              type="date"
              value={draft.expected_date}
              onChange={(e) => setDraft({ ...draft, expected_date: e.target.value })}
            />
          </MetaCard>
          <MetaCard
            label="Expenses"
            action={
              <button
                type="button"
                className="text-xs text-link"
                onClick={() => setExpenseFor("draft")}
              >
                Add new
              </button>
            }
          >
            {money(0)}
          </MetaCard>
          <MetaCard label="Order total">
            <div className="flex items-end justify-between">
              <span>{money(merch)}</span>
              <span className="text-[11px] font-normal text-subtle">
                Items: {lines.length}
                <br />
                Units: {units}
              </span>
            </div>
          </MetaCard>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4">
          <Button size="sm" disabled={!draft.supplier_id} onClick={() => setPicker(true)}>
            + Add item
          </Button>
          <Button size="sm" variant="outline" disabled>
            Templates
          </Button>
          <Button size="sm" variant="outline" disabled>
            Previous order
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Field label="Vendor invoice #">
              <Input
                value={draft.vendor_invoice}
                onChange={(e) => setDraft({ ...draft, vendor_invoice: e.target.value })}
                className="w-36"
              />
            </Field>
            <Field label="BOL #">
              <Input
                value={draft.bol}
                onChange={(e) => setDraft({ ...draft, bol: e.target.value })}
                className="w-28"
              />
            </Field>
            <Field label="Shipping reference #">
              <Input
                value={draft.shipping_ref}
                onChange={(e) => setDraft({ ...draft, shipping_ref: e.target.value })}
                className="w-40"
              />
            </Field>
          </div>
        </div>

        {lines.length ? (
          <div className="mt-4 overflow-x-auto px-4">
            <p className="mb-2 text-sm font-semibold">Inventory Items</p>
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Lot detail</th>
                  <th className="px-3 py-2 font-medium">Pallet details</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                  <th className="px-3 py-2 font-medium">B/E</th>
                  {draft.deal_type === "firme" ? (
                    <th className="px-3 py-2 font-medium">$ Markup</th>
                  ) : null}
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const weight =
                    l.netWeight != null && Number(l.qty) > 0 ? Number(l.qty) * l.netWeight : null;
                  return (
                    <tr key={l.key} className="border-b border-border align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium">
                          {i + 1}. {l.name}
                          {l.calibre ? (
                            <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal">
                              {l.calibre}
                            </span>
                          ) : null}
                        </div>
                        {l.skuCode ? <div className="text-xs text-subtle">{l.skuCode}</div> : null}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span>{l.unit}</span>
                          <Input
                            className="h-8 w-14"
                            value={l.origin}
                            onChange={(e) =>
                              setLines((p) =>
                                p.map((x) =>
                                  x.key === l.key ? { ...x, origin: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <label className="flex items-center gap-1">
                            <input type="checkbox" className="size-3.5 accent-action" /> Organic
                          </label>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">Auto-generated</td>
                      <td className="px-3 py-3">
                        <div className="grid w-40 grid-cols-2 gap-1">
                          <Input
                            title="Pallets"
                            placeholder="Pallets"
                            value={l.pallets}
                            onChange={(e) =>
                              setLines((p) =>
                                p.map((x) =>
                                  x.key === l.key ? { ...x, pallets: e.target.value } : x,
                                ),
                              )
                            }
                          />
                          <Input
                            title="Cases per pallet"
                            placeholder="Cases/plt"
                            value={l.unitsPerPallet}
                            onChange={(e) =>
                              setLines((p) =>
                                p.map((x) =>
                                  x.key === l.key
                                    ? {
                                        ...x,
                                        unitsPerPallet: e.target.value,
                                        pallets: ceilPallets(x.qty, e.target.value) || x.pallets,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="mt-1 text-[11px] text-muted">
                          Weight {weight != null ? qty(weight, l.weightUnit) : "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          className="w-20"
                          value={l.qty}
                          onChange={(e) =>
                            setLines((p) =>
                              p.map((x) =>
                                x.key === l.key
                                  ? {
                                      ...x,
                                      qty: e.target.value,
                                      pallets:
                                        ceilPallets(e.target.value, x.unitsPerPallet) || x.pallets,
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          className="w-24"
                          placeholder="$"
                          value={l.cost}
                          disabled={draft.deal_type !== "firme"}
                          onChange={(e) =>
                            setLines((p) =>
                              p.map((x) => (x.key === l.key ? { ...x, cost: e.target.value } : x)),
                            )
                          }
                        />
                        {draft.deal_type !== "firme" ? (
                          <div className="mt-1 text-[11px] text-danger">
                            {draft.deal_type === "comision" ? "Comisión — sin costo" : "PAS"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        {draft.deal_type === "firme" ? "" : "Min: PAS"}
                      </td>
                      {draft.deal_type === "firme" ? (
                        <td className="px-3 py-3">
                          <Input
                            className="w-20"
                            value={l.markup}
                            onChange={(e) =>
                              setLines((p) =>
                                p.map((x) =>
                                  x.key === l.key ? { ...x, markup: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          title="Quitar línea"
                          aria-label={`Quitar ${l.name}`}
                          className="cursor-pointer rounded p-1 text-subtle hover:bg-danger/10 hover:text-danger"
                          onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-auto border-t border-border bg-surface">
          <button
            type="button"
            className="mx-4 mt-3 h-9 rounded-md border border-border px-3 text-sm"
            onClick={() => setPicker(true)}
          >
            + Add non-inventory item
          </button>
          <div className="grid gap-3 p-4 lg:grid-cols-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-action"
                checked={draft.noteVendor}
                onChange={(e) => setDraft({ ...draft, noteVendor: e.target.checked })}
              />
              <span>
                <span className="text-link">Add note to vendor</span>
                <Textarea
                  className="mt-2"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </span>
            </label>
            <div className="space-y-2 text-sm text-muted">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-action" /> Share vendor portal to{" "}
                {vendorName ? "contacts" : "0 contacts"}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-action"
                  checked={draft.print}
                  onChange={(e) => setDraft({ ...draft, print: e.target.checked })}
                />
                Print order when placed
              </label>
            </div>
            <div className="flex flex-col items-end justify-end gap-1 text-sm">
              <div className="text-muted">
                Total items: {lines.length} · Total units: {units} · Total pallets: {pallets}
              </div>
              <div className="flex items-center gap-4">
                <span>
                  Expenses: $0.00 · Order total: <strong>{money(merch)}</strong>
                </span>
                <Button
                  disabled={saving || !draft.supplier_id || !draft.deal_type || !lines.length}
                  onClick={() => void placeOrder()}
                >
                  Place order
                </Button>
              </div>
            </div>
          </div>
        </div>

        {picker ? (
          <ProductPicker skus={skus} onAdd={addSku} onClose={() => setPicker(false)} />
        ) : null}
        {expenseFor ? (
          <ExpenseModal
            suppliers={suppliers.data ?? []}
            form={expDraft}
            setForm={setExpDraft}
            onClose={() => {
              setExpenseFor(null);
              setExpMsg(null);
            }}
            onSave={() => void saveExpense()}
            saving={saving}
            msg={expMsg}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
      <FilterRow>
        <FilterField label="Search" className="min-w-48 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </FilterField>
        <FilterField label="Requested date">
          <Input type="text" readOnly value={todayISO()} />
        </FilterField>
        <FilterField label="Buyer">
          <Select defaultValue="all">
            <option value="all">All users</option>
            <option>{COMPANY.userName}</option>
          </Select>
        </FilterField>
        <FilterField label="Order status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All order statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="partial">Partial</option>
            <option value="completed">Fulfilled</option>
          </Select>
        </FilterField>
        <FilterField label="Vendors">
          <Select value={vendor} onChange={(e) => setVendor(e.target.value)}>
            <option value="">All vendors</option>
            {(suppliers.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <button type="button" className="h-9 rounded-md border border-border px-3 text-sm">
          Filters
        </button>
        <button
          type="button"
          className="text-sm text-link"
          onClick={() => {
            setQ("");
            setStatus("");
            setVendor("");
          }}
        >
          Reset filters
        </button>
      </FilterRow>

      {orders.loading ? <p className="p-6 text-sm text-muted">Loading…</p> : null}
      {orders.error ? <p className="p-6 text-sm text-danger">{orders.error}</p> : null}

      {!orders.loading && filtered.length === 0 ? (
        <EmptyOrders onNew={() => navigate({ to: "/compras", search: { tab: "new" } })} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">PO #</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Requested date</th>
                <th className="px-3 py-2">Received date</th>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">BOL #</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right"># of inv. units</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2">Sign-off</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const open = openId === row.id;
                const unitsN = row.lines.reduce((s, l) => s + l.quantity_ordered, 0);
                const recv = row.receptions[0]?.received_date;
                return (
                  <Fragment key={row.id}>
                    <tr
                      key={row.id}
                      className="border-b border-border bg-surface hover:bg-surface-2/60"
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center rounded hover:bg-surface-2"
                          onClick={() => setOpenId(open ? null : row.id)}
                        >
                          {open ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="font-medium text-link"
                          onClick={() => setOpenId(open ? null : row.id)}
                        >
                          {poShort(row.po_number)}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          tone={orderTone(row.status === "completed" ? "received" : row.status)}
                        >
                          {row.status === "completed" ? "Received" : orderLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{row.supplier_name}</td>
                      <td className="px-3 py-2">{fecha(row.expected_date || row.order_date)}</td>
                      <td className="px-3 py-2">{recv ? fecha(recv) : "—"}</td>
                      <td className="px-3 py-2">
                        {row.vendor_invoice || row.bill?.bill_number || "—"}
                      </td>
                      <td className="px-3 py-2">{row.bol || "—"}</td>
                      <td className="px-3 py-2">
                        {row.order_type === "entrega" ? "Delivery" : row.order_type}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{unitsN}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(row.order_total)}
                      </td>
                      <td className="px-3 py-2 text-muted">—</td>
                    </tr>
                    {open ? (
                      <tr key={`${row.id}-d`} className="border-b border-border bg-bg">
                        <td colSpan={12} className="p-4">
                          <PoDetail
                            row={row}
                            onReceive={() => openRecepcion(row.id)}
                            onEdit={() => setEditId(row.id)}
                            onBill={() => void facturarProv(row.id)}
                            onExpense={() => setExpenseFor(row.id)}
                            onShare={() => {
                              setShareLevel(
                                (row.vendor_share_level as "po" | "basic" | "detailed") || "po",
                              );
                              setShareId(row.id);
                            }}
                            onSettle={() => setSettleId(row.id)}
                            onCancel={() => setCancelPo({ id: row.id, po_number: row.po_number })}
                            saving={saving}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {po ? (
        <Modal
          wide
          title="Receive merchandise"
          subtitle={`${po.po_number} · ${po.supplier_name}`}
          onClose={() => setRecvPo(null)}
        >
          <form className="grid gap-4" onSubmit={doReceive}>
            {warn ? <p className="text-sm text-danger">{warn}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Received date">
                <Input
                  type="date"
                  value={rec.received_date}
                  onChange={(e) => setRec({ ...rec, received_date: e.target.value })}
                />
              </Field>
              <Field label="Destination">
                <Select
                  required
                  value={rec.location_id}
                  onChange={(e) => setRec({ ...rec, location_id: e.target.value })}
                >
                  <option value="">Select</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {(() => {
              const loc = (locations.data ?? []).find((l) => String(l.id) === rec.location_id);
              if (!loc) return null;
              const seen = new Set<string>();
              const mismatches = (po?.lines ?? [])
                .map((l) => ({
                  name: l.product_name,
                  issue: tempMismatch(
                    loc.set_point_temp,
                    loc.set_point_unit,
                    l.storage_temp_min,
                    l.storage_temp_max,
                    l.storage_temp_unit,
                  ),
                }))
                .filter((x) => {
                  if (!x.issue) return false;
                  const key = `${x.name}|${x.issue}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              if (!mismatches.length) return null;
              return (
                <p className="rounded-md border border-warn/40 bg-warn/5 p-2 text-xs text-warn">
                  Temperatura: {mismatches.map((m) => `${m.name} ${m.issue}`).join(" · ")}
                </p>
              );
            })()}
            <Field label="Inspection type">
              <Select
                value={rec.inspection_type}
                onChange={(e) => setRec({ ...rec, inspection_type: e.target.value })}
              >
                {INSPECCION_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-3">
              {recLines.map((l, i) => (
                <div key={l.line_id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">
                    {l.product_name} · pending {qty(l.pendiente, l.unit)}
                  </p>
                  {l.sku_code ? <p className="text-xs text-subtle">{l.sku_code}</p> : null}
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Result">
                      <Select
                        value={l.resultado}
                        onChange={(e) =>
                          setRecLines((p) =>
                            p.map((x, idx) =>
                              idx === i ? { ...x, resultado: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        <option value="">Select</option>
                        {RESULTADOS_REC.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Quantity">
                      <Input
                        value={l.cantidad}
                        onChange={(e) =>
                          setRecLines((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, cantidad: e.target.value } : x)),
                          )
                        }
                      />
                    </Field>
                  </div>
                  {l.resultado === "Aceptada con incidencia" ? (
                    <Field label="Cantidad afectada" className="mt-2">
                      <Input
                        value={l.afectada}
                        onChange={(e) =>
                          setRecLines((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, afectada: e.target.value } : x)),
                          )
                        }
                      />
                    </Field>
                  ) : null}
                  {l.resultado && l.resultado !== "Aceptada" ? (
                    <Field label="Reason" className="mt-2">
                      <Select
                        value={l.defecto}
                        onChange={(e) =>
                          setRecLines((p) =>
                            p.map((x, idx) => (idx === i ? { ...x, defecto: e.target.value } : x)),
                          )
                        }
                      >
                        <option value="">Select</option>
                        {GRUPOS.map(([k, lab]) => (
                          <optgroup key={k} label={lab}>
                            {DEFECTOS[k].map((d) => (
                              <option key={d} value={`${k}::${d}`}>
                                {d}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                </div>
              ))}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : t("Receive")}
            </Button>
          </form>
        </Modal>
      ) : null}

      {expenseFor && expenseFor !== "draft" ? (
        <ExpenseModal
          suppliers={suppliers.data ?? []}
          form={expDraft}
          setForm={setExpDraft}
          onClose={() => {
            setExpenseFor(null);
            setExpMsg(null);
          }}
          onSave={() => void saveExpense()}
          saving={saving}
          msg={expMsg}
        />
      ) : null}

      {sharePo ? (
        <Modal title="Share Vendor Portal to Contacts" onClose={() => setShareId(null)}>
          <p className="text-sm font-medium">{sharePo.supplier_name}</p>
          <div className="mt-2 flex justify-between text-sm text-muted">
            <span>PO {poShort(sharePo.po_number)}</span>
            <span>Order total {money(sharePo.order_total)}</span>
          </div>
          <div className="mt-4 rounded-lg bg-action px-3 py-3 text-action-fg">
            <p className="text-[11px] uppercase tracking-wide text-white/80">
              Share info with selected contacts using link
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-md bg-white/15 px-2 py-1.5">
              <code className="flex-1 truncate text-xs">{`/portal/${sharePo.share_token}`}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void navigator.clipboard?.writeText(
                    `${window.location.origin}/portal/${sharePo.share_token}`,
                  )
                }
              >
                <Copy className="size-3.5" /> Copy link
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-md border border-border p-3 text-sm">
            <p className="mb-2 font-medium">What information do you want to share?</p>
            {(
              [
                ["po", "PO", "PO level information with items, prices, and PO total."],
                [
                  "basic",
                  "PO + Basic sales data",
                  "Includes PO data and adds lot-level total sales, break even, average selling price per unit, incurred expenses, and a P/L summary.",
                ],
                [
                  "detailed",
                  "PO + Detailed sales data",
                  "Includes the same information as PO + Basic sales data and adds in a full sales and price list (without customer information).",
                ],
              ] as const
            ).map(([val, title, body]) => (
              <label key={val} className="mt-2 flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={shareLevel === val}
                  onChange={() => setShareLevel(val)}
                />
                <span>
                  <span className="font-medium">{title}</span>
                  <span className="block text-xs text-muted">{body}</span>
                </span>
              </label>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShareId(null)}>
                Go back
              </Button>
              <Button
                onClick={() => {
                  void setVendorShare({
                    data: { purchase_order_id: sharePo.id, level: shareLevel },
                  }).then(() => {
                    setShareId(null);
                    void orders.reload();
                    window.location.href = `/portal/${sharePo.share_token}`;
                  });
                }}
              >
                Update
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {settleId ? (
        <SettlementModal
          poId={settleId}
          onClose={() => setSettleId(null)}
          onSaved={() => {
            setSettleId(null);
            void orders.reload();
          }}
        />
      ) : null}
      {editId != null && list.find((p) => p.id === editId) ? (
        <EditOrderModal
          key={editId}
          row={list.find((p) => p.id === editId)!}
          suppliers={suppliers.data ?? []}
          skus={skus}
          onClose={() => setEditId(null)}
          onSaved={() => {
            setEditId(null);
            void orders.reload();
          }}
        />
      ) : null}
      {cancelPo ? (
        <CancelDialog
          title={`Cancel order ${poShort(cancelPo.po_number)}`}
          subtitle="Blocked if it already has a vendor invoice, or if a received lot was already sold, wasted or repacked."
          onClose={() => setCancelPo(null)}
          onConfirm={async (reason) => {
            await cancelPurchaseOrder({
              data: { purchase_order_id: cancelPo.id, reason: reason || undefined },
            });
            setCancelPo(null);
            await orders.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function PoDetail({
  row,
  onReceive,
  onEdit,
  onBill,
  onExpense,
  onShare,
  onSettle,
  onCancel,
  saving,
}: {
  row: Awaited<ReturnType<typeof listPurchaseOrders>>[number];
  onReceive: () => void;
  onEdit: () => void;
  onBill: () => void;
  onShare: () => void;
  onExpense: () => void;
  onSettle: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const pending = row.lines.some((l) => l.quantity_ordered - l.quantity_received > 0.0001);
  const received = row.lines.some((l) => l.quantity_received > 0);
  const units = row.lines.reduce((s, l) => s + l.quantity_ordered, 0);
  const pallets = row.lines.reduce((s, l) => s + (l.pallets || 0), 0);
  const totalWeight = row.lines.reduce(
    (s, l) => s + (l.net_weight != null ? l.quantity_ordered * l.net_weight : 0),
    0,
  );
  const weightUnit = row.lines.find((l) => l.net_weight != null)?.weight_unit || "kg";
  const hasWeight = row.lines.some((l) => l.net_weight != null);
  const pendingCost = row.deal_type !== "firme" && row.lines.some((l) => !(l.unit_cost > 0));
  const t = useT();
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">PO #{poShort(row.po_number)}</h2>
            <Badge tone={orderTone(row.status === "completed" ? "received" : row.status)}>
              {row.status === "completed" ? "Received" : orderLabel(row.status)}
            </Badge>
          </div>
          <p className="text-xs text-muted">Placed on {fecha(row.order_date)}</p>
          <CancelledNote by={row.cancelled_by} at={row.cancelled_at} reason={row.cancel_reason} />
        </div>
        <Button size="sm" onClick={onEdit}>
          Edit order
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetaCard label="Vendor">{row.supplier_name}</MetaCard>
        <MetaCard label="Deal type">
          <Badge
            tone={row.deal_type === "firme" ? "ok" : row.deal_type === "comision" ? "warn" : "mute"}
          >
            {t(DEAL_TYPE_LABEL[row.deal_type] ?? row.deal_type)}
          </Badge>
          {row.commission_type ? (
            <div className="mt-1 text-[11px] font-normal text-subtle">
              {commissionSummary(row.commission_type, row.commission_rate)}
            </div>
          ) : null}
        </MetaCard>
        <MetaCard label="Order type">
          {row.order_type === "entrega" ? "Delivery by vendor" : row.order_type}
        </MetaCard>
        <MetaCard label="Requested date">{fecha(row.expected_date || row.order_date)}</MetaCard>
        <MetaCard label="BOL #">{row.bol || ""}</MetaCard>
        <MetaCard label="Vendor invoice #">{row.vendor_invoice || ""}</MetaCard>
        <MetaCard label="Shipping reference #">{row.shipping_ref || ""}</MetaCard>
        <MetaCard
          label="Expenses"
          action={
            <button type="button" className="text-xs text-link" onClick={onExpense}>
              Add new
            </button>
          }
        >
          {money(row.expense_total)}
        </MetaCard>
        <MetaCard label="Order total">
          <div>
            {money(row.order_total)}
            {pendingCost ? (
              <div className="text-[11px] font-normal text-warn">
                Costo de la fruta pendiente (PAS) — solo gastos
              </div>
            ) : (
              <div className="text-[11px] font-normal text-subtle">
                Items: {row.lines.length} · Units: {units}
              </div>
            )}
          </div>
        </MetaCard>
      </div>
      <div className="mt-2 max-w-xs">
        <MetaCard label="Buyer">{COMPANY.userName}</MetaCard>
      </div>

      <p className="mt-5 mb-2 text-sm font-semibold">Inventory Items</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Lot detail</th>
              <th className="px-3 py-2 font-medium">Pallet details</th>
              <th className="px-3 py-2 font-medium">Quantity</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              <th className="px-3 py-2 font-medium">B/E</th>
              {row.deal_type === "firme" ? (
                <th className="px-3 py-2 font-medium">$ Markup</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {row.lines.map((l, i) => {
              const lineWeight = l.net_weight != null ? l.quantity_ordered * l.net_weight : null;
              return (
                <tr key={l.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <div className="font-medium">
                      {i + 1}. {l.product_name}
                      {l.calibre ? (
                        <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal">
                          {l.calibre}
                        </span>
                      ) : null}
                    </div>
                    {l.sku_code ? <div className="text-xs text-subtle">{l.sku_code}</div> : null}
                    <div className="text-xs text-muted">
                      {l.unit} · {l.origin_country || "MX"}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-link">
                    {row.receptions.find((r) => r.purchase_order_line_id === l.id && r.lot_sano)
                      ?.lot_sano || "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">
                    Pallets {l.pallets || 1}
                    <br />
                    Weight {lineWeight != null ? qty(lineWeight, l.weight_unit) : "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{l.quantity_ordered}</td>
                  <td className="px-3 py-3">
                    {l.unit_cost > 0 ? (
                      <div>
                        {money(l.unit_cost)}
                        <div className="text-xs text-muted">
                          Total {money(l.quantity_ordered * l.unit_cost)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xs font-medium text-danger">PAS</div>
                        <div className="text-xs text-muted">Total {money(0)}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs">
                    {l.unit_cost
                      ? money(l.unit_cost + row.expense_total / Math.max(units, 1), 4)
                      : "—"}
                  </td>
                  {row.deal_type === "firme" ? (
                    <td className="px-3 py-3 text-sm text-muted">—</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {row.expenses.length ? (
        <>
          <p className="mt-4 mb-2 text-sm font-semibold">Non-Inventory Items</p>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Quantity</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {row.expenses.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2">{e.quantity || 1}</td>
                    <td className="px-3 py-2">{money(e.amount / Math.max(e.quantity || 1, 1))}</td>
                    <td className="px-3 py-2">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <PalletsPanel purchaseOrderId={row.id} lines={row.lines} />

      <ShipmentsPanel
        tipo="entrada"
        purchaseOrderId={row.id}
        bol={row.bol}
        vendorInvoice={row.vendor_invoice}
      />

      <div className="mt-4 grid gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-border p-3 text-sm">
          <Link
            to="/doc/$tipo/$id"
            params={{ tipo: "oc", id: row.share_token }}
            className="flex items-center gap-2 text-link"
          >
            <Printer className="size-3.5" /> Print purchase order
          </Link>
          <Link
            to="/etiquetas/lotes/$poId"
            params={{ poId: String(row.id) }}
            className="mt-2 block text-link"
          >
            Print lot labels
          </Link>
          <Link
            to="/etiquetas/pallets/$poId"
            params={{ poId: String(row.id) }}
            className="mt-2 block text-link"
          >
            Print pallet labels
          </Link>
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="text-link">Audit log</p>
          <p className="mt-2 text-subtle">Return to shipper</p>
          <button type="button" className="mt-2 text-link" onClick={onShare}>
            Share vendor portal to contacts
          </button>
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Pallets</span>
            <span>{pallets || row.lines.length}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Weight</span>
            <span>{hasWeight ? qty(totalWeight, weightUnit) : "—"}</span>
          </div>
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Inventory item total</span>
            <span>{money(row.merch_total)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Non-inventory item total</span>
            <span>{money(row.expense_total)}</span>
          </div>
          <div className="mt-2 flex justify-between font-semibold">
            <span>Order total</span>
            <span>{money(row.order_total)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pending && row.status !== "cancelled" ? (
          <Button size="sm" onClick={onReceive}>
            {t("Receive merchandise")}
          </Button>
        ) : null}
        {received && !row.bill && row.status !== "cancelled" && row.deal_type !== "comision" ? (
          <Button size="sm" variant="outline" disabled={saving} onClick={onBill}>
            {t("Capture vendor invoice")}
          </Button>
        ) : null}
        {received && row.status !== "cancelled" ? (
          <Button size="sm" onClick={onSettle}>
            Calculate settlement
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={onShare}>
          Share vendor portal
        </Button>
        {row.status !== "cancelled" ? (
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel order
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted">
          Payment status: {row.bill?.status === "paid" ? "Paid" : "Unpaid"}
        </span>
      </div>
      <p className="mt-3 text-xs text-muted">Attachments · No attached files.</p>
    </div>
  );
}

function EditOrderModal({
  row,
  suppliers,
  skus,
  onClose,
  onSaved,
}: {
  row: Awaited<ReturnType<typeof listPurchaseOrders>>[number];
  suppliers: {
    id: number;
    name: string;
    commission_type?: string | null;
    commission_rate?: number | null;
  }[];
  skus: SkuOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const billed = !!row.bill;
  const received = row.lines.some((l) => l.quantity_received > 0);
  const locked = billed;
  const [form, setForm] = useState({
    supplier_id: String(row.supplier_id),
    deal_type: row.deal_type,
    commission_type: row.commission_type ?? "",
    commission_rate: row.commission_rate != null ? String(row.commission_rate) : "",
    expected_date: row.expected_date || row.order_date || "",
    order_type: row.order_type === "entrega" ? "Delivery by vendor" : row.order_type,
    bol: row.bol || "",
    vendor_invoice: row.vendor_invoice || "",
    shipping_ref: row.shipping_ref || "",
    notes: row.notes || "",
  });
  const [lines, setLines] = useState(
    row.lines.map((l) => ({
      id: l.id as number | undefined,
      product_id: l.product_id,
      pack_style_id: l.pack_style_id ?? undefined,
      name: l.product_name,
      calibre: l.calibre || null,
      skuCode: l.sku_code || null,
      unit: l.unit,
      origin: l.origin_country || "MX",
      qty: String(l.quantity_ordered),
      pallets: l.pallets ? String(l.pallets) : "",
      unitsPerPallet: l.units_per_pallet ? String(l.units_per_pallet) : "",
      cost: l.unit_cost ? String(l.unit_cost) : "",
      received: l.quantity_received,
    })),
  );
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const isFirme = form.deal_type === "firme";
  const canEditStructure = !locked && !received;

  function addLine(sku: SkuOption) {
    setLines((p) => [
      ...p,
      {
        id: undefined,
        product_id: sku.product_id,
        pack_style_id: sku.id || undefined,
        name: sku.product_name,
        calibre: sku.calibre || null,
        skuCode: sku.sku_code || null,
        unit: sku.empaque || sku.unit || sku.name,
        origin: "MX",
        qty: "48",
        pallets: sku.units_per_pallet ? String(Math.ceil(48 / sku.units_per_pallet)) : "1",
        unitsPerPallet: sku.units_per_pallet ? String(sku.units_per_pallet) : "48",
        cost: "",
        received: 0,
      },
    ]);
    setPicker(false);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await updatePurchaseOrder({
        data: {
          purchase_order_id: row.id,
          supplier_id: Number(form.supplier_id),
          deal_type: form.deal_type as "firme" | "consignacion" | "comision",
          commission_type:
            !isFirme && form.commission_type
              ? (form.commission_type as "per_unit" | "gross_pct" | "net_pct")
              : undefined,
          commission_rate:
            !isFirme && form.commission_type ? Number(form.commission_rate) : undefined,
          expected_date: form.expected_date || undefined,
          order_type: form.order_type,
          bol: form.bol || undefined,
          vendor_invoice: form.vendor_invoice || undefined,
          shipping_ref: form.shipping_ref || undefined,
          notes: form.notes || undefined,
          lines: lines.map((l) => ({
            id: l.id,
            product_id: l.product_id,
            pack_style_id: l.pack_style_id,
            quantity_ordered: Number(l.qty),
            unit: l.unit,
            unit_cost: isFirme && l.cost ? Number(l.cost) : undefined,
            pallets: l.pallets ? Number(l.pallets) : undefined,
            units_per_pallet: l.unitsPerPallet ? Number(l.unitsPerPallet) : undefined,
            origin_country: l.origin,
          })),
        },
      });
      onSaved();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Edit PO #${poShort(row.po_number)}`}
      subtitle={row.supplier_name}
      onClose={onClose}
      wide
    >
      {locked ? (
        <p className="mb-3 rounded-md border border-warn/40 bg-warn/5 p-2 text-xs text-warn">
          Esta orden ya tiene factura de proveedor — solo puedes corregir referencia y notas.
        </p>
      ) : received ? (
        <p className="mb-3 rounded-md border border-warn/40 bg-warn/5 p-2 text-xs text-warn">
          Esta orden ya tiene mercancía recibida — proveedor, modalidad y líneas quedan fijos.
          Puedes corregir costo, pallets, cajas/pallet, origen y subir cantidades (nunca bajarlas de
          lo ya recibido).
        </p>
      ) : null}
      {msg ? <p className="mb-3 text-sm text-danger">{msg}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Vendor">
          <Select
            disabled={locked || received}
            value={form.supplier_id}
            onChange={(e) => {
              const supplier_id = e.target.value;
              const sup = suppliers.find((s) => String(s.id) === supplier_id);
              setForm({
                ...form,
                supplier_id,
                commission_type: sup?.commission_type ?? "",
                commission_rate: sup?.commission_rate != null ? String(sup.commission_rate) : "",
              });
            }}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deal type">
          <Select
            disabled={locked || received}
            value={form.deal_type}
            onChange={(e) => setForm({ ...form, deal_type: e.target.value })}
          >
            <option value="firme">Firme (precio cerrado)</option>
            <option value="consignacion">Consignación (PAS)</option>
            <option value="comision">Comisión pura</option>
          </Select>
        </Field>
        {!isFirme ? (
          <Field label="Plein commission">
            <div className="flex gap-2">
              <Select
                disabled={locked}
                value={form.commission_type}
                onChange={(e) => setForm({ ...form, commission_type: e.target.value })}
              >
                <option value="">Sin comisión</option>
                <option value="per_unit">Por caja ($)</option>
                <option value="gross_pct">% venta bruta</option>
                <option value="net_pct">% sobre neto</option>
              </Select>
              <Input
                disabled={locked}
                className="w-20"
                placeholder={form.commission_type === "per_unit" ? "$" : "%"}
                value={form.commission_rate}
                onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
              />
            </div>
          </Field>
        ) : null}
        <Field label="Requested date">
          <Input
            type="date"
            value={form.expected_date}
            onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
          />
        </Field>
        <Field label="BOL #">
          <Input value={form.bol} onChange={(e) => setForm({ ...form, bol: e.target.value })} />
        </Field>
        <Field label="Vendor invoice #">
          <Input
            value={form.vendor_invoice}
            onChange={(e) => setForm({ ...form, vendor_invoice: e.target.value })}
          />
        </Field>
        <Field label="Shipping reference #">
          <Input
            value={form.shipping_ref}
            onChange={(e) => setForm({ ...form, shipping_ref: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Notes" className="mt-3">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold">Inventory Items</p>
        {canEditStructure ? (
          <Button size="sm" variant="outline" onClick={() => setPicker(true)}>
            + Add item
          </Button>
        ) : null}
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Origin</th>
              <th className="px-3 py-2 font-medium">Pallets / cases per pallet</th>
              <th className="px-3 py-2 font-medium">Quantity</th>
              <th className="px-3 py-2 font-medium">Cost</th>
              {canEditStructure ? <th className="px-3 py-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border align-top">
                <td className="px-3 py-3">
                  <div className="font-medium">
                    {i + 1}. {l.name}
                    {l.calibre ? (
                      <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal">
                        {l.calibre}
                      </span>
                    ) : null}
                  </div>
                  {l.skuCode ? <div className="text-xs text-subtle">{l.skuCode}</div> : null}
                  <div className="text-xs text-muted">
                    {l.unit}
                    {l.received > 0 ? ` · ${l.received} recibidas` : ""}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Input
                    disabled={locked}
                    className="h-8 w-16"
                    value={l.origin}
                    onChange={(e) =>
                      setLines((p) =>
                        p.map((x, j) => (j === i ? { ...x, origin: e.target.value } : x)),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <div className="grid w-36 grid-cols-2 gap-1">
                    <Input
                      disabled={locked}
                      placeholder="Pallets"
                      value={l.pallets}
                      onChange={(e) =>
                        setLines((p) =>
                          p.map((x, j) => (j === i ? { ...x, pallets: e.target.value } : x)),
                        )
                      }
                    />
                    <Input
                      disabled={locked}
                      placeholder="Cases/plt"
                      value={l.unitsPerPallet}
                      onChange={(e) =>
                        setLines((p) =>
                          p.map((x, j) => (j === i ? { ...x, unitsPerPallet: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Input
                    disabled={locked}
                    className="w-20"
                    value={l.qty}
                    onChange={(e) =>
                      setLines((p) =>
                        p.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)),
                      )
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <Input
                    disabled={locked || !isFirme}
                    className="w-24"
                    placeholder="$"
                    value={l.cost}
                    onChange={(e) =>
                      setLines((p) =>
                        p.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)),
                      )
                    }
                  />
                </td>
                {canEditStructure ? (
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-danger"
                      onClick={() => setLines((p) => p.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-sm font-semibold">Gastos de esta orden</p>
      {row.expenses.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Concepto</th>
                <th className="px-3 py-2 font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Lo paga</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {row.expenses.map((e) => (
                <tr key={e.id} className="border-b border-border">
                  <td className="px-3 py-2">
                    {e.category}
                    <div className="text-xs text-subtle">{e.expense_number}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{money(e.amount)}</td>
                  <td className="px-3 py-2 text-xs">
                    {e.charged_to === "grower" ? "Productor" : "Plein"}
                  </td>
                  <td className="px-3 py-2 text-xs">{e.payable ? "Por pagar" : "Pagado"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/gastos"
                      search={{ tab: "expenses", expense: e.id }}
                      className="text-xs text-link"
                    >
                      Corregir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {billed ? (
            <p className="mt-2 text-xs text-warn">
              Esta orden ya se liquidó — los montos de estos gastos quedaron congelados en la
              liquidación.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">Esta orden no tiene gastos capturados.</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving || !lines.length} onClick={() => void save()}>
          Save changes
        </Button>
      </div>
      {picker ? (
        <ProductPicker skus={skus} onAdd={addLine} onClose={() => setPicker(false)} />
      ) : null}
    </Modal>
  );
}

function ExpenseModal({
  suppliers,
  form,
  setForm,
  onClose,
  onSave,
  saving,
  msg,
}: {
  suppliers: { id: number; name: string }[];
  form: {
    category: string;
    supplier_id: string;
    amount: string;
    invoice: string;
    notes: string;
    payable: boolean;
    by: string;
    charged_to: string;
  };
  setForm: (v: typeof form) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  msg?: string | null;
}) {
  return (
    <Modal title="Create Expense and Connect to Order" onClose={onClose} wide>
      {msg ? <p className="mb-3 text-sm text-danger">{msg}</p> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Type *">
          <ConceptSelect
            kind="gasto"
            value={form.category}
            onChange={(category) => setForm({ ...form, category })}
          />
        </Field>
        <Field label="Requested date">
          <Input type="date" defaultValue={todayISO()} />
        </Field>
        <Field label="Amount">
          <Input
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </Field>
        <Field label="Vendor">
          <Select
            value={form.supplier_id}
            onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
          >
            <option value="">Search vendors</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice #">
          <Input
            value={form.invoice}
            onChange={(e) => setForm({ ...form, invoice: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">¿Ya se pagó este gasto?</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={form.payable}
            onChange={() => setForm({ ...form, payable: true })}
          />
          <span>
            <strong>Por pagar</strong>
            <span className="block text-xs text-muted">
              Todavía se le debe al proveedor — aparece en Cuentas por pagar.
            </span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={!form.payable}
            onChange={() => setForm({ ...form, payable: false })}
          />
          <span>
            <strong>Ya pagado</strong>
            <span className="block text-xs text-muted">
              Se pagó en el momento (efectivo/tarjeta) — no genera CxP.
            </span>
          </span>
        </label>
      </div>
      <Field label="Note" className="mt-3">
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </Field>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">Distribute expense by:</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={form.by === "pallet"}
            onChange={() => setForm({ ...form, by: "pallet" })}
          />
          <span>
            <strong>Pallet</strong>
            <span className="block text-xs text-muted">
              Distributes the expense proportionally among order items based on each item's number
              of pallets.
            </span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={form.by === "unit"}
            onChange={() => setForm({ ...form, by: "unit" })}
          />
          <span>
            <strong>Unit</strong>
            <span className="block text-xs text-muted">
              Distributes the expense proportionally among order items based on each item's
              quantity.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">¿Quién absorbe este gasto?</p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={form.charged_to !== "grower"}
            onChange={() => setForm({ ...form, charged_to: "plein" })}
          />
          <span>
            <strong>Plein</strong>
            <span className="block text-xs text-muted">
              No se le descuenta al productor en la liquidación.
            </span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input
            type="radio"
            className="mt-1"
            checked={form.charged_to === "grower"}
            onChange={() => setForm({ ...form, charged_to: "grower" })}
          />
          <span>
            <strong>Productor</strong>
            <span className="block text-xs text-muted">
              Se descuenta del ingreso antes de calcular la comisión y el neto al productor.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={onSave}>
          Create expense
        </Button>
      </div>
    </Modal>
  );
}

function SettlementModal({
  poId,
  onClose,
  onSaved,
}: {
  poId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const data = useAsync(() => getSettlement({ data: { purchase_order_id: poId } }), [poId]);
  const [target, setTarget] = useState("");
  const [ctype, setCtype] = useState("");
  const [crate, setCrate] = useState("");
  const [recover, setRecover] = useState("");
  const [commissionInit, setCommissionInit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const s = data.data;

  if (s && !commissionInit) {
    setCtype(s.commission_type ?? "");
    setCrate(s.commission_rate != null ? String(s.commission_rate) : "");
    // Propuesta de recuperación: lo que alcance entre el saldo vivo y lo
    // pendiente de la liquidación. Miguel decide el monto final (puede ser 0).
    if (s.bill && s.grower_balance > 0) {
      const proposal = Math.min(s.grower_balance, s.bill.remaining);
      if (proposal > 0) setRecover(proposal.toFixed(2));
    }
    setCommissionInit(true);
  }

  async function applyRecovery() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await applyAdvanceRecovery({
        data: { purchase_order_id: poId, amount: Number(recover) },
      });
      setRecover("");
      await data.reload();
      setMsg(`Recuperados ${money(r.applied)} contra ${r.bill_number}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not apply recovery");
    } finally {
      setSaving(false);
    }
  }

  async function apply(pctVal?: number) {
    setSaving(true);
    setMsg(null);
    try {
      await applySettlement({
        data: {
          purchase_order_id: poId,
          target_profit_pct: pctVal,
        },
      });
      await data.reload();
      setMsg("Lot costs updated");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not settle");
    } finally {
      setSaving(false);
    }
  }

  async function saveCommission() {
    setSaving(true);
    setMsg(null);
    try {
      await setPoCommission({
        data: {
          purchase_order_id: poId,
          commission_type: ctype ? (ctype as "per_unit" | "gross_pct" | "net_pct") : null,
          commission_rate: crate ? Number(crate) : undefined,
        },
      });
      await data.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save commission");
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpense(expenseId: number, current: string) {
    setSaving(true);
    setMsg(null);
    try {
      await setExpenseChargedTo({
        data: { expense_id: expenseId, charged_to: current === "grower" ? "plein" : "grower" },
      });
      await data.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not update expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={`Settlement Calculator for PO #${s ? poShort(s.po_number) : poId}`}
      subtitle={
        s ? `${s.supplier_name} · ${DEAL_TYPE_LABEL[s.deal_type] ?? s.deal_type}` : undefined
      }
      onClose={onClose}
    >
      {data.loading ? <p className="text-sm text-muted">Loading…</p> : null}
      {data.error ? <p className="text-sm text-danger">{data.error}</p> : null}
      {s ? (
        <>
          {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <MiniKpi label="Total revenue" value={money(s.revenue)} />
            <MiniKpi label="Inventory total" value={money(s.inventory_total)} hint={money(0)} />
            <MiniKpi label="Expenses" value={money(s.expenses)} />
            <MiniKpi label="Profit $" value={money(s.profit)} tone="ok" hint={pct(s.profit_pct)} />
            <MiniKpi
              label="Total paid"
              value={money(s.paid)}
              tone={s.paid ? undefined : "danger"}
            />
            <MiniKpi label="Balance due" value={money(s.balance_due)} />
          </div>
          {s.deal_type === "firme" ? (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-2 p-3">
              <Field label="Target profit %">
                <Input
                  className="w-24"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder={s.target_profit_pct != null ? String(s.target_profit_pct) : ""}
                />
              </Field>
              <Button
                size="sm"
                disabled={saving || !target}
                onClick={() => void apply(Number(target))}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void apply(undefined)}
              >
                Clear target
              </Button>
              <p className="ml-auto max-w-sm text-xs text-muted">
                Trato en firme: el costo ya está cerrado. El target % es solo una herramienta de
                análisis.
              </p>
            </div>
          ) : (
            <>
              {s.deal_type === "comision" ? (
                <div className="mt-3 rounded-md border border-warn/40 bg-warn/5 p-3 text-xs text-warn">
                  Comisión pura: Plein no compra la fruta ni toma título. El costo del lote se queda
                  en $0 y no nace CxP por el valor de la fruta — la liquidación de abajo es el
                  estado de cuenta para el productor.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-2 p-3">
                <Field label="Plein commission">
                  <Select value={ctype} onChange={(e) => setCtype(e.target.value)} className="w-44">
                    <option value="">Sin comisión</option>
                    <option value="per_unit">Por caja ($)</option>
                    <option value="gross_pct">% venta bruta</option>
                    <option value="net_pct">% sobre neto</option>
                  </Select>
                </Field>
                <Field label={ctype === "per_unit" ? "$ / caja" : "%"}>
                  <Input
                    className="w-24"
                    value={crate}
                    onChange={(e) => setCrate(e.target.value)}
                  />
                </Field>
                <Button
                  size="sm"
                  disabled={saving || (!!ctype && !(Number(crate) > 0))}
                  onClick={() => void saveCommission()}
                >
                  Save
                </Button>
                <p className="ml-auto max-w-sm text-xs text-muted">
                  Ingreso − gastos del productor − comisión de Plein = neto al productor.
                </p>
              </div>
              {s.breakdown ? (
                <div className="mt-3 rounded-md border border-border bg-surface p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Liquidación al productor
                  </p>
                  <div className="max-w-xl text-sm">
                    <div className="flex justify-between border-b border-border py-1.5">
                      <span>
                        Ingreso de la venta
                        <span className="ml-2 text-xs text-muted">
                          {s.breakdown.sold_units} cajas vendidas
                        </span>
                      </span>
                      <span className="tabular-nums">{money(s.breakdown.revenue)}</span>
                    </div>
                    {s.expense_rows.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between border-b border-border py-1.5"
                      >
                        <span>
                          {e.category}
                          {e.notes ? (
                            <span className="ml-2 text-xs text-muted">{e.notes}</span>
                          ) : null}
                          <button
                            type="button"
                            disabled={saving}
                            className="ml-2 cursor-pointer text-[11px] text-link underline-offset-2 hover:underline"
                            onClick={() => void toggleExpense(e.id, e.charged_to)}
                          >
                            {e.charged_to === "grower"
                              ? "se descuenta al productor"
                              : "lo absorbe Plein"}
                          </button>
                        </span>
                        <span
                          className={`tabular-nums ${e.charged_to === "grower" ? "" : "text-subtle"}`}
                        >
                          {e.charged_to === "grower" ? `−${money(e.amount)}` : money(0)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between border-b border-border py-1.5">
                      <span>
                        Comisión Plein
                        <span className="ml-2 text-xs text-muted">
                          {s.breakdown.commission_type === "per_unit"
                            ? `${money(s.breakdown.commission_rate, 2)} × ${s.breakdown.sold_units} cajas`
                            : s.breakdown.commission_type === "gross_pct"
                              ? `${s.breakdown.commission_rate}% de ${money(s.breakdown.commission_base)} (venta bruta)`
                              : `${s.breakdown.commission_rate}% de ${money(s.breakdown.commission_base)} (neto tras gastos)`}
                        </span>
                      </span>
                      <span className="tabular-nums">−{money(s.breakdown.commission)}</span>
                    </div>
                    <div
                      className={`flex justify-between py-2 font-semibold ${s.recovered_total > 0 ? "border-b border-border text-sm" : "text-base"}`}
                    >
                      <span>Neto al productor</span>
                      <span
                        className={`tabular-nums ${s.breakdown.net_to_grower < 0 ? "text-danger" : "text-ok"}`}
                      >
                        {money(s.breakdown.net_to_grower)}
                      </span>
                    </div>
                    {s.recovered_total > 0 ? (
                      <>
                        <div className="flex justify-between border-b border-border py-1.5">
                          <span>
                            Recuperación de adelantos
                            <span className="ml-2 text-xs text-muted">
                              saldo de adelantos: {money(s.grower_balance + s.recovered_total)}{" "}
                              antes → {money(s.grower_balance)} después
                            </span>
                          </span>
                          <span className="tabular-nums">−{money(s.recovered_total)}</span>
                        </div>
                        {s.recoveries.map((r, i) => (
                          <div key={i} className="flex justify-between py-1 text-xs text-muted">
                            <span>
                              {r.advance_number} — {r.concept}
                            </span>
                            <span className="tabular-nums">−{money(r.amount)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between py-2 text-base font-semibold">
                          <span>Pago al productor</span>
                          <span className="tabular-nums text-ok">
                            {money(Math.max(s.breakdown.net_to_grower - s.recovered_total, 0))}
                          </span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Define la comisión de Plein para calcular la liquidación al productor.
                </p>
              )}
            </>
          )}
          {s.grower_balance > 0 ? (
            s.bill && s.bill.remaining > 0.009 ? (
              <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-2 p-3">
                <Field label="Recuperar adelantos ($)">
                  <Input
                    className="w-28"
                    value={recover}
                    onChange={(e) => setRecover(e.target.value)}
                  />
                </Field>
                <Button
                  size="sm"
                  disabled={saving || !(Number(recover) > 0)}
                  onClick={() => void applyRecovery()}
                >
                  Aplicar
                </Button>
                <p className="ml-auto max-w-md text-xs text-muted">
                  El productor tiene {money(s.grower_balance)} en adelantos vivos. Tú decides cuánto
                  se recupera en esta carga — puede ser cero. Máximo: lo pendiente de{" "}
                  {s.bill.bill_number} ({money(s.bill.remaining)}).
                </p>
              </div>
            ) : s.deal_type === "comision" ? (
              <p className="mt-3 text-xs text-muted">
                El productor tiene {money(s.grower_balance)} en adelantos vivos. En comisión pura no
                nace CxP por la fruta, así que no hay liquidación contra la cual recuperar en esta
                carga.
              </p>
            ) : !s.bill ? (
              <p className="mt-3 text-xs text-warn">
                El productor tiene {money(s.grower_balance)} en adelantos vivos. Captura la factura
                de la liquidación para poder recuperar contra esta carga.
              </p>
            ) : null
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {[
                    "Lot #",
                    "Status",
                    "Rev. status",
                    "Inventory item",
                    "Total",
                    "RTS",
                    "Sold",
                    "Waste",
                    "Remaining",
                    "Revenue",
                    "T. cost",
                    "Expenses",
                    "Profit $",
                    "Cost/unit",
                    "Profit %",
                  ].map((h) => (
                    <th key={h} className="px-2 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.lots.map((l) => (
                  <tr key={l.id} className="border-b border-border">
                    <td className="px-2 py-2 font-medium text-link">{l.lot_number}</td>
                    <td className="px-2 py-2">
                      <Badge>
                        {l.status === "depleted" || l.remaining <= 0
                          ? "OPEN"
                          : l.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-2 py-2 text-xs text-danger">Unpaid</td>
                    <td className="px-2 py-2">
                      {l.product_name}
                      {l.pack_name ? ` — ${l.pack_name}` : ""}
                      {l.origin ? ` · ${l.origin}` : ""}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{l.total}</td>
                    <td className="px-2 py-2 tabular-nums">{l.rts}</td>
                    <td className="px-2 py-2 tabular-nums">{l.sold}</td>
                    <td className="px-2 py-2 tabular-nums">{l.waste}</td>
                    <td className="px-2 py-2 tabular-nums">{l.remaining}</td>
                    <td className="px-2 py-2 tabular-nums">{money(l.revenue)}</td>
                    <td className="px-2 py-2 tabular-nums">{l.pas ? "—" : money(l.t_cost)}</td>
                    <td className="px-2 py-2 tabular-nums">{money(l.expenses)}</td>
                    <td className="px-2 py-2 tabular-nums">{money(l.profit)}</td>
                    <td className="px-2 py-2">
                      {l.pas ? (
                        <span className="text-xs font-medium text-danger">PAS</span>
                      ) : (
                        money(l.cost_unit, 2)
                      )}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{pct(l.profit_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Go back
            </Button>
            {s.deal_type !== "comision" ? (
              <Button
                disabled={saving || (s.deal_type !== "firme" && !s.breakdown)}
                onClick={() =>
                  void apply(
                    s.breakdown
                      ? undefined
                      : target
                        ? Number(target)
                        : (s.target_profit_pct ?? undefined),
                  ).then(onSaved)
                }
              >
                Update lot costs
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

function MiniKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : ""}`}
      >
        {value}
      </p>
      {hint ? <p className="text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
}
