import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Copy, MoreHorizontal, Printer } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { MetaCard, Modal } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { ConceptSelect } from "@/components/concepts";
import { EmptyOrders, FilterField, FilterRow, ProductPicker } from "@/components/product-picker";
import { packsToSkus, type SkuOption } from "@/components/sku-select";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";
import { poShort } from "@/lib/nav";
import {
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
  setVendorShare,
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
};

const DEAL_TYPE_LABEL: Record<string, string> = {
  firme: "Firm",
  consignacion: "Consignment",
  comision: "Pure commission",
};

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
  const [shareId, setShareId] = useState<number | null>(null);
  const [shareLevel, setShareLevel] = useState<"po" | "basic" | "detailed">("po");
  const [settleId, setSettleId] = useState<number | null>(null);
  const [cancelPo, setCancelPo] = useState<{ id: number; po_number: string } | null>(null);
  const [draft, setDraft] = useState({
    supplier_id: "",
    deal_type: "",
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
    payable: false,
    by: "pallet",
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
    setLines((prev) => [
      ...prev,
      {
        key: `${sku.id}-${Date.now()}`,
        product_id: sku.product_id,
        pack_style_id: sku.id || undefined,
        name: sku.product_name,
        unit: sku.empaque || sku.unit || sku.name,
        origin: "MX",
        qty: "48",
        pallets: "1",
        unitsPerPallet: "48",
        cost: "",
        markup: "30",
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
    setSaving(true);
    setMsg(null);
    try {
      const r = await createPurchaseOrder({
        data: {
          supplier_id: Number(draft.supplier_id),
          deal_type: draft.deal_type as "firme" | "consignacion" | "comision",
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
    const poId = expenseFor === "draft" ? undefined : expenseFor ?? undefined;
    if (!expDraft.supplier_id && !draft.supplier_id) return;
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
              affected_qty: l.resultado === "Aceptada con incidencia" ? Number(l.afectada) : undefined,
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
            <Select value={draft.supplier_id} onChange={(e) => setDraft({ ...draft, supplier_id: e.target.value })}>
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
          <MetaCard label="Order type">
            <Select value={draft.order_type} onChange={(e) => setDraft({ ...draft, order_type: e.target.value })}>
              <option>Delivery by vendor</option>
              <option>Pickup</option>
              <option>Will-call</option>
            </Select>
          </MetaCard>
          <MetaCard label="Requested date">
            <Input type="date" value={draft.expected_date} onChange={(e) => setDraft({ ...draft, expected_date: e.target.value })} />
          </MetaCard>
          <MetaCard
            label="Expenses"
            action={
              <button type="button" className="text-xs text-link" onClick={() => setExpenseFor("draft")}>
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
          <Button size="sm" variant="outline" disabled={!lines.length}>
            Split into pallets
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Field label="Vendor invoice #">
              <Input value={draft.vendor_invoice} onChange={(e) => setDraft({ ...draft, vendor_invoice: e.target.value })} className="w-36" />
            </Field>
            <Field label="BOL #">
              <Input value={draft.bol} onChange={(e) => setDraft({ ...draft, bol: e.target.value })} className="w-28" />
            </Field>
            <Field label="Shipping reference #">
              <Input value={draft.shipping_ref} onChange={(e) => setDraft({ ...draft, shipping_ref: e.target.value })} className="w-40" />
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
                  <th className="px-3 py-2 font-medium">$ Markup</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.key} className="border-b border-border align-top">
                    <td className="px-3 py-3">
                      <div className="font-medium">{i + 1}. {l.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{l.unit}</span>
                        <Input
                          className="h-8 w-14"
                          value={l.origin}
                          onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, origin: e.target.value } : x)))}
                        />
                        <label className="flex items-center gap-1">
                          <input type="checkbox" className="size-3.5 accent-action" /> Organic
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">Auto-generated</td>
                    <td className="px-3 py-3">
                      <div className="grid w-36 grid-cols-2 gap-1">
                        <Input value={l.pallets} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, pallets: e.target.value } : x)))} />
                        <Input value={l.unitsPerPallet} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, unitsPerPallet: e.target.value } : x)))} />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        className="w-20"
                        value={l.qty}
                        onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        className="w-24"
                        placeholder="$"
                        value={l.cost}
                        disabled={draft.deal_type !== "firme"}
                        onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, cost: e.target.value } : x)))}
                      />
                      {draft.deal_type !== "firme" ? (
                        <div className="mt-1 text-[11px] text-danger">{draft.deal_type === "comision" ? "Comisión — sin costo" : "PAS"}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted">{draft.deal_type === "firme" ? "" : "Min: PAS"}</td>
                    <td className="px-3 py-3">
                      <Input
                        className="w-20"
                        value={l.markup}
                        onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, markup: e.target.value } : x)))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-auto border-t border-border bg-surface">
          <button type="button" className="mx-4 mt-3 h-9 rounded-md border border-border px-3 text-sm" onClick={() => setPicker(true)}>
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
                <Textarea className="mt-2" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </span>
            </label>
            <div className="space-y-2 text-sm text-muted">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-action" /> Share vendor portal to {vendorName ? "contacts" : "0 contacts"}
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
                <Button disabled={saving || !draft.supplier_id || !draft.deal_type || !lines.length} onClick={() => void placeOrder()}>
                  Place order
                </Button>
              </div>
            </div>
          </div>
        </div>

        {picker ? <ProductPicker skus={skus} onAdd={addSku} onClose={() => setPicker(false)} /> : null}
        {expenseFor ? (
          <ExpenseModal
            suppliers={suppliers.data ?? []}
            form={expDraft}
            setForm={setExpDraft}
            onClose={() => setExpenseFor(null)}
            onSave={() => void saveExpense()}
            saving={saving}
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
                    <tr key={row.id} className="border-b border-border bg-surface hover:bg-surface-2/60">
                      <td className="px-3 py-2">
                        <button type="button" className="flex size-8 items-center justify-center rounded hover:bg-surface-2" onClick={() => setOpenId(open ? null : row.id)}>
                          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" className="font-medium text-link" onClick={() => setOpenId(open ? null : row.id)}>
                          {poShort(row.po_number)}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={orderTone(row.status === "completed" ? "received" : row.status)}>
                          {row.status === "completed" ? "Received" : orderLabel(row.status)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{row.supplier_name}</td>
                      <td className="px-3 py-2">{fecha(row.expected_date || row.order_date)}</td>
                      <td className="px-3 py-2">{recv ? fecha(recv) : "—"}</td>
                      <td className="px-3 py-2">{row.vendor_invoice || row.bill?.bill_number || "—"}</td>
                      <td className="px-3 py-2">{row.bol || "—"}</td>
                      <td className="px-3 py-2">{row.order_type === "entrega" ? "Delivery" : row.order_type}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{unitsN}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(row.order_total)}</td>
                      <td className="px-3 py-2 text-muted">—</td>
                    </tr>
                    {open ? (
                      <tr key={`${row.id}-d`} className="border-b border-border bg-bg">
                        <td colSpan={12} className="p-4">
                          <PoDetail
                            row={row}
                            onReceive={() => openRecepcion(row.id)}
                            onBill={() => void facturarProv(row.id)}
                            onExpense={() => setExpenseFor(row.id)}
                            onShare={() => {
                              setShareLevel((row.vendor_share_level as "po" | "basic" | "detailed") || "po");
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
        <Modal wide title="Receive merchandise" subtitle={`${po.po_number} · ${po.supplier_name}`} onClose={() => setRecvPo(null)}>
          <form className="grid gap-4" onSubmit={doReceive}>
            {warn ? <p className="text-sm text-danger">{warn}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Received date">
                <Input type="date" value={rec.received_date} onChange={(e) => setRec({ ...rec, received_date: e.target.value })} />
              </Field>
              <Field label="Destination">
                <Select required value={rec.location_id} onChange={(e) => setRec({ ...rec, location_id: e.target.value })}>
                  <option value="">Select</option>
                  {(locations.data ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Inspection type">
              <Select value={rec.inspection_type} onChange={(e) => setRec({ ...rec, inspection_type: e.target.value })}>
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
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Result">
                      <Select value={l.resultado} onChange={(e) => setRecLines((p) => p.map((x, idx) => (idx === i ? { ...x, resultado: e.target.value } : x)))}>
                        <option value="">Select</option>
                        {RESULTADOS_REC.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Quantity">
                      <Input value={l.cantidad} onChange={(e) => setRecLines((p) => p.map((x, idx) => (idx === i ? { ...x, cantidad: e.target.value } : x)))} />
                    </Field>
                  </div>
                  {l.resultado && l.resultado !== "Aceptada" ? (
                    <Field label="Reason" className="mt-2">
                      <Select value={l.defecto} onChange={(e) => setRecLines((p) => p.map((x, idx) => (idx === i ? { ...x, defecto: e.target.value } : x)))}>
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
          onClose={() => setExpenseFor(null)}
          onSave={() => void saveExpense()}
          saving={saving}
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
            <p className="text-[11px] uppercase tracking-wide text-white/80">Share info with selected contacts using link</p>
            <div className="mt-2 flex items-center gap-2 rounded-md bg-white/15 px-2 py-1.5">
              <code className="flex-1 truncate text-xs">{`/portal/${sharePo.share_token}`}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}/portal/${sharePo.share_token}`)}
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
                ["basic", "PO + Basic sales data", "Includes PO data and adds lot-level total sales, break even, average selling price per unit, incurred expenses, and a P/L summary."],
                ["detailed", "PO + Detailed sales data", "Includes the same information as PO + Basic sales data and adds in a full sales and price list (without customer information)."],
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
                  void setVendorShare({ data: { purchase_order_id: sharePo.id, level: shareLevel } }).then(() => {
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
      {cancelPo ? (
        <CancelDialog
          title={`Cancel order ${poShort(cancelPo.po_number)}`}
          subtitle="Blocked if it already has a vendor invoice, or if a received lot was already sold, wasted or repacked."
          onClose={() => setCancelPo(null)}
          onConfirm={async (reason) => {
            await cancelPurchaseOrder({ data: { purchase_order_id: cancelPo.id, reason: reason || undefined } });
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
  onBill,
  onExpense,
  onShare,
  onSettle,
  onCancel,
  saving,
}: {
  row: Awaited<ReturnType<typeof listPurchaseOrders>>[number];
  onReceive: () => void;
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
        <Button size="sm" onClick={onReceive}>
          Edit order
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <MetaCard label="Vendor">{row.supplier_name}</MetaCard>
        <MetaCard label="Deal type">
          <Badge tone={row.deal_type === "firme" ? "ok" : row.deal_type === "comision" ? "warn" : "mute"}>
            {t(DEAL_TYPE_LABEL[row.deal_type] ?? row.deal_type)}
          </Badge>
        </MetaCard>
        <MetaCard label="Order type">{row.order_type === "entrega" ? "Delivery by vendor" : row.order_type}</MetaCard>
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
            <div className="text-[11px] font-normal text-subtle">
              Items: {row.lines.length} · Units: {units}
            </div>
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
              <th className="px-3 py-2 font-medium">$ Markup</th>
            </tr>
          </thead>
          <tbody>
            {row.lines.map((l, i) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <div className="font-medium">
                    {i + 1}. {l.product_name}
                  </div>
                  <div className="text-xs text-muted">
                    {l.unit} · {l.origin_country || "MX"}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-link">
                  {row.receptions.find((r) => r.lot_sano)?.lot_sano || "—"}
                </td>
                <td className="px-3 py-3 text-xs text-muted">
                  Pallets {l.pallets || 1}
                  <br />
                  Weight —
                </td>
                <td className="px-3 py-3 tabular-nums">{l.quantity_ordered}</td>
                <td className="px-3 py-3">
                  {l.unit_cost > 0 ? (
                    <div>
                      {money(l.unit_cost)}
                      <div className="text-xs text-muted">Total {money(l.quantity_ordered * l.unit_cost)}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-medium text-danger">PAS</div>
                      <div className="text-xs text-muted">Total {money(0)}</div>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">{l.unit_cost ? money(l.unit_cost + row.expense_total / Math.max(units, 1), 4) : "—"}</td>
                <td className="px-3 py-3 text-sm">$30.00</td>
              </tr>
            ))}
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

      <div className="mt-4 grid gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-border p-3 text-sm">
          <Link to="/doc/$tipo/$id" params={{ tipo: "oc", id: row.share_token }} className="flex items-center gap-2 text-link">
            <Printer className="size-3.5" /> Print purchase order
          </Link>
          <p className="mt-2 text-link">Print lot labels</p>
          <p className="mt-2 text-link">Print pallet labels</p>
          <p className="mt-2 text-link">Print PO label</p>
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
            <span>{pallets || 1}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted">Weight</span>
            <span>0 lb</span>
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

function ExpenseModal({
  suppliers,
  form,
  setForm,
  onClose,
  onSave,
  saving,
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
  };
  setForm: (v: typeof form) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <Modal title="Create Expense and Connect to Order" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Type *">
          <ConceptSelect kind="gasto" value={form.category} onChange={(category) => setForm({ ...form, category })} />
        </Field>
        <Field label="Requested date">
          <Input type="date" defaultValue={todayISO()} />
        </Field>
        <Field label="Amount">
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-action"
            checked={form.payable}
            onChange={(e) => setForm({ ...form, payable: e.target.checked })}
          />
          Yes, add to AP
        </label>
        <Field label="Vendor">
          <Select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
            <option value="">Search vendors</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Invoice #">
          <Input value={form.invoice} onChange={(e) => setForm({ ...form, invoice: e.target.value })} />
        </Field>
      </div>
      <Field label="Note" className="mt-3">
        <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium">Distribute expense by:</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" className="mt-1" checked={form.by === "pallet"} onChange={() => setForm({ ...form, by: "pallet" })} />
          <span>
            <strong>Pallet</strong>
            <span className="block text-xs text-muted">Distributes the expense proportionally among order items based on each item's number of pallets.</span>
          </span>
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm">
          <input type="radio" className="mt-1" checked={form.by === "unit"} onChange={() => setForm({ ...form, by: "unit" })} />
          <span>
            <strong>Unit</strong>
            <span className="block text-xs text-muted">Distributes the expense proportionally among order items based on each item's quantity.</span>
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
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const s = data.data;

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

  return (
    <Modal
      wide
      title={`Settlement Calculator for PO #${s ? poShort(s.po_number) : poId}`}
      subtitle={s ? `${s.supplier_name} · ${DEAL_TYPE_LABEL[s.deal_type] ?? s.deal_type}` : undefined}
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
            <MiniKpi label="Total paid" value={money(s.paid)} tone={s.paid ? undefined : "danger"} />
            <MiniKpi label="Balance due" value={money(s.balance_due)} />
          </div>
          {s.deal_type === "comision" ? (
            <div className="mt-3 rounded-md border border-warn/40 bg-warn/5 p-3 text-xs text-warn">
              Comisión pura: Plein no compra la fruta. El costo del lote se queda en $0 permanentemente — no hay compra que
              liquidar aquí.
            </div>
          ) : (
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
              <Button size="sm" variant="outline" disabled={saving} onClick={() => void apply(undefined)}>
                Clear target
              </Button>
              <p className="ml-auto max-w-sm text-xs text-muted">
                PAS: grower cost is $0 until you settle. A target % backs into cost/unit from sold revenue minus expenses.
              </p>
            </div>
          )}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  {["Lot #", "Status", "Rev. status", "Inventory item", "Total", "RTS", "Sold", "Waste", "Remaining", "Revenue", "T. cost", "Expenses", "Profit $", "Cost/unit", "Profit %"].map(
                    (h) => (
                      <th key={h} className="px-2 py-2 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {s.lots.map((l) => (
                  <tr key={l.id} className="border-b border-border">
                    <td className="px-2 py-2 font-medium text-link">{l.lot_number}</td>
                    <td className="px-2 py-2">
                      <Badge>{l.status === "depleted" || l.remaining <= 0 ? "OPEN" : l.status.toUpperCase()}</Badge>
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
                      {l.pas ? <span className="text-xs font-medium text-danger">PAS</span> : money(l.cost_unit, 2)}
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
                disabled={saving}
                onClick={() =>
                  void apply(target ? Number(target) : s.target_profit_pct ?? undefined).then(onSaved)
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
      <p className={`text-lg font-semibold tabular-nums ${tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : ""}`}>
        {value}
      </p>
      {hint ? <p className="text-[11px] text-subtle">{hint}</p> : null}
    </div>
  );
}
