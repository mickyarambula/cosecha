import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { MetaCard, Modal, TabOverride } from "@/components/app-shell";
import { CancelDialog, CancelledNote } from "@/components/cancel-dialog";
import { EmptyOrders, FilterField, FilterRow, ProductPicker } from "@/components/product-picker";
import { SendButton } from "@/components/send-doc";
import { packsToSkus, type SkuOption } from "@/components/sku-select";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { COMPANY } from "@/lib/company";
import { useT } from "@/lib/i18n";
import { poShort } from "@/lib/nav";
import {
  cancelSalesOrder,
  createCreditInvoice,
  createInvoiceFromSO,
  createPurchaseFromSO,
  createSalesOrder,
  listCustomers,
  listLots,
  listProducts,
  listSalesOrders,
  listSuppliers,
  shipSalesLine,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, qty, todayISO } from "@/lib/utils";

type Search = { tab?: "all" | "new" };

export const Route = createFileRoute("/ventas")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: s.tab === "new" ? "new" : "all",
  }),
  component: Page,
});

type DraftLine = {
  key: string;
  product_id: number;
  pack_style_id?: number;
  lot_id?: number;
  name: string;
  unit: string;
  qty: string;
  price: string;
};

function Page() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const t = useT();
  const orders = useAsync(() => listSalesOrders(), []);
  const products = useAsync(() => listProducts(), []);
  const customers = useAsync(() => listCustomers(), []);
  const lots = useAsync(() => listLots(), []);
  const suppliers = useAsync(() => listSuppliers(), []);
  const skus = packsToSkus(products.data ?? []);
  const [openId, setOpenId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [picker, setPicker] = useState(false);
  const [ship, setShip] = useState<{ line_id: number; product_id: number; pending: number; unit: string } | null>(null);
  const [buy, setBuy] = useState<{ so_id: number; so_number: string; openQty: number } | null>(null);
  const [credit, setCredit] = useState<number | null>(null);
  const [cancelSo, setCancelSo] = useState<{ id: number; so_number: string } | null>(null);
  const [placed, setPlaced] = useState<{
    id: number;
    so_number: string;
    share_token: string;
    customer_name: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    lines: { qty: number; unit: string; name: string; sku?: string | null }[];
    total: number;
  } | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printDocs, setPrintDocs] = useState({ bol: false, invoice: false, pick: true, confirm: false });
  const [draft, setDraft] = useState({ customer_id: "", notes: "", requested: todayISO(), type: "Delivery to customer" });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [shipForm, setShipForm] = useState({ quantity: "", lot_id: "", location_id: "" });
  const [buyForm, setBuyForm] = useState({ supplier_id: "", unit_cost: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const list = orders.data ?? [];
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((o) => o.so_number.toLowerCase().includes(s) || o.customer_name.toLowerCase().includes(s));
  }, [list, q]);

  const selected = list.find((o) => o.id === openId) ?? list.find((o) => o.id === credit) ?? null;
  const allLots = lots.data ?? [];

  function addSku(sku: SkuOption) {
    const lot = allLots.find((l) => l.product_id === sku.product_id && l.asignable);
    setLines((p) => [
      ...p,
      {
        key: `${sku.id}-${Date.now()}`,
        product_id: sku.product_id,
        pack_style_id: sku.id || undefined,
        lot_id: lot?.id,
        name: sku.product_name,
        unit: sku.empaque || sku.unit,
        qty: lot ? String(lot.current_qty) : "1",
        price: "35",
      },
    ]);
    setPicker(false);
  }

  async function place() {
    if (!draft.customer_id || !lines.length) return;
    setSaving(true);
    try {
      const r = await createSalesOrder({
        data: {
          customer_id: Number(draft.customer_id),
          notes: draft.notes || undefined,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            pack_style_id: l.pack_style_id,
            lot_id: l.lot_id,
            quantity_ordered: Number(l.qty),
            unit: l.unit,
            unit_price: l.price ? Number(l.price) : undefined,
          })),
        },
      });
      const cust = (customers.data ?? []).find((c) => c.id === Number(draft.customer_id));
      setLines([]);
      setPlaced({
        id: r.id,
        so_number: r.so_number,
        share_token: r.share_token,
        customer_name: cust?.name || "",
        customer_email: cust?.email,
        customer_phone: cust?.phone,
        lines: lines.map((l) => ({ qty: Number(l.qty), unit: l.unit, name: l.name })),
        total: lines.reduce((s, l) => s + Number(l.qty) * Number(l.price || 0), 0),
      });
      setMsg(`SO ${r.so_number} placed`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not place");
    } finally {
      setSaving(false);
    }
  }

  async function doShip(e: React.FormEvent) {
    e.preventDefault();
    if (!ship) return;
    setSaving(true);
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
      setMsg("Fulfilled");
      await Promise.all([orders.reload(), lots.reload()]);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not fulfill");
    } finally {
      setSaving(false);
    }
  }

  async function facturar(soId: number) {
    setSaving(true);
    try {
      const r = await createInvoiceFromSO({ data: { sales_order_id: soId } });
      setMsg(`Invoice ${r.invoice_number} for ${money(r.total)}`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not invoice");
    } finally {
      setSaving(false);
    }
  }

  async function generarCompra(e: React.FormEvent) {
    e.preventDefault();
    if (!buy) return;
    setSaving(true);
    try {
      const r = await createPurchaseFromSO({
        data: {
          sales_order_id: buy.so_id,
          supplier_id: Number(buyForm.supplier_id),
          unit_cost: Number(buyForm.unit_cost),
        },
      });
      setBuy(null);
      setMsg(`PO ${r.po_number} generated from ${r.so_number}`);
      await orders.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not generate PO");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "new") {
    const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.price || 0), 0);
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
        {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaCard label="Customer">
            <Select value={draft.customer_id} onChange={(e) => setDraft({ ...draft, customer_id: e.target.value })}>
              <option value="">Search customers</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </MetaCard>
          <MetaCard label="Requested date">
            <Input type="date" value={draft.requested} onChange={(e) => setDraft({ ...draft, requested: e.target.value })} />
          </MetaCard>
          <MetaCard label="Pickup date">
            <Input type="date" />
          </MetaCard>
          <MetaCard label="Order type">
            <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option>Delivery to customer</option>
              <option>Pickup</option>
              <option>Will-call</option>
            </Select>
          </MetaCard>
          <MetaCard label="Delivery route">
            <Select defaultValue="">
              <option value="">Type to search</option>
            </Select>
          </MetaCard>
          <MetaCard label="Destination">Select a customer first</MetaCard>
          <MetaCard label="Expenses">{money(0)}</MetaCard>
          <MetaCard label="Sales rep">{COMPANY.userName}</MetaCard>
        </div>
        <div className="px-4">
          <Button size="sm" disabled={!draft.customer_id} onClick={() => setPicker(true)}>
            + Add item
          </Button>
        </div>
        {lines.length ? (
          <div className="mt-4 overflow-x-auto px-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-b border-border">
                    <td className="px-3 py-2">
                      {l.name} · {l.unit}
                    </td>
                    <td className="px-3 py-2">
                      <Input className="w-20" value={l.qty} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="w-24" value={l.price} onChange={(e) => setLines((p) => p.map((x) => (x.key === l.key ? { ...x, price: e.target.value } : x)))} />
                    </td>
                    <td className="px-3 py-2">{money(Number(l.qty || 0) * Number(l.price || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <div className="mt-auto flex justify-end gap-3 border-t border-border bg-surface p-4">
          <Button disabled={saving || !draft.customer_id || !lines.length} onClick={() => void place()}>
            Place order
          </Button>
        </div>
        {picker ? (
          <ProductPicker
            skus={skus}
            onAdd={addSku}
            onClose={() => setPicker(false)}
            extra={<span>{t("{n} lots available to sell", { n: allLots.filter((l) => l.asignable).length })}</span>}
            stock={Object.fromEntries(
              skus.map((s) => {
                const mine = allLots.filter((l) => l.product_id === s.product_id);
                return [
                  s.product_id,
                  {
                    ats: mine.reduce((n, l) => n + (l.asignable ? l.current_qty : 0), 0),
                    oh: mine.reduce((n, l) => n + l.current_qty, 0),
                    price: 35,
                  },
                ];
              }),
            )}
          />
        ) : null}
        {placed ? (
          <div className="fixed bottom-4 right-4 z-40 flex overflow-hidden rounded-md shadow-lg">
            <div className="flex items-center gap-3 bg-seller px-5 py-4 text-seller-fg">
              <div>
                <p className="font-semibold">{t("Order placed!")}</p>
                <p className="mt-1 inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs">{placed.so_number}</p>
              </div>
              <button type="button" className="ml-2 text-lg leading-none" onClick={() => setPlaced(null)}>
                ×
              </button>
            </div>
            <button type="button" className="w-28 bg-surface px-3 py-2 text-center text-sm hover:bg-surface-2" onClick={() => setPrintOpen(true)}>
              {t("Print documents")}
            </button>
            <SendButton
              className="w-28 rounded-none"
              title="Sales Order"
              number={placed.so_number}
              partyName={placed.customer_name}
              email={placed.customer_email}
              phone={placed.customer_phone}
              docs={[{ tipo: "ov", id: placed.id, label: "Sales Order" }]}
              lines={placed.lines}
              total={placed.total}
              variant="outline"
              label={t("Send / WhatsApp")}
            />
            <button
              type="button"
              className="w-28 bg-surface px-3 py-2 text-center text-sm hover:bg-surface-2"
              onClick={() => {
                setPlaced(null);
                navigate({ to: "/ventas", search: { tab: "all" } });
                setOpenId(placed.id);
              }}
            >
              {t("Go to order")}
            </button>
          </div>
        ) : null}
        {printOpen && placed ? (
          <Modal title="Print documents?" onClose={() => setPrintOpen(false)}>
            <p className="text-sm text-muted">{t("Select the documents you'd like to print.")}</p>
            <div className="mt-4 grid gap-2 text-sm">
              {(
                [
                  ["bol", "BOL"],
                  ["invoice", "Invoice"],
                  ["pick", "Pick ticket"],
                  ["confirm", "Sales confirmation"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={printDocs[k]}
                    onChange={(e) => setPrintDocs({ ...printDocs, [k]: e.target.checked })}
                  />
                  {t(label)}
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintOpen(false)}>
                No, go back
              </Button>
              <Button
                onClick={() => {
                  const tipo = printDocs.pick ? "pick" : printDocs.confirm ? "confirm" : printDocs.bol ? "bol" : "ov";
                  window.open(`/doc/${tipo}/${placed.share_token}`, "_blank");
                  setPrintOpen(false);
                }}
              >
                Yes, print
              </Button>
            </div>
          </Modal>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {openId ? (
        <TabOverride>
          <div className="flex h-11 items-center gap-3 bg-seller px-3 text-sm text-seller-fg">
            <button type="button" className="font-medium hover:underline" onClick={() => setOpenId(null)}>
              ← {t("Go back to All Orders")}
            </button>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto border-white/30 bg-white text-seller"
              onClick={() => navigate({ to: "/ventas", search: { tab: "new" } })}
            >
              + {t("New order")}
            </Button>
          </div>
        </TabOverride>
      ) : null}
      {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
      <FilterRow>
        <FilterField label="Search" className="min-w-48 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </FilterField>
        <FilterField label="Customer">
          <Select defaultValue="">
            <option value="">{t("All customers")}</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </Select>
        </FilterField>
      </FilterRow>
      {orders.loading ? <p className="p-6 text-sm text-muted">Loading…</p> : null}
      {!orders.loading && filtered.length === 0 ? (
        <EmptyOrders kind="sales" onNew={() => navigate({ to: "/ventas", search: { tab: "new" } })} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="w-10 px-3 py-2" />
                <th className="px-3 py-2">{t("SO #")}</th>
                <th className="px-3 py-2">{t("Status")}</th>
                <th className="px-3 py-2">{t("Customer")}</th>
                <th className="px-3 py-2">{t("Requested date")}</th>
                <th className="px-3 py-2">{t("Type")}</th>
                <th className="px-3 py-2 text-right">{t("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const open = openId === row.id;
                const total = row.lines.reduce((s, l) => s + l.quantity_ordered * l.unit_price, 0);
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-border bg-surface">
                      <td className="px-3 py-2">
                        <button type="button" className="flex size-8 items-center justify-center" onClick={() => setOpenId(open ? null : row.id)}>
                          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button type="button" className="font-medium text-link" onClick={() => setOpenId(open ? null : row.id)}>
                            {poShort(row.so_number)}
                          </button>
                          <SendButton
                            title="Sales Order"
                            number={row.so_number}
                            partyName={row.customer_name}
                            email={row.customer_email}
                            phone={row.customer_phone}
                            docs={[
                              { tipo: "ov", id: row.id, label: "Sales Order" },
                              ...(row.invoice ? [{ tipo: "factura", id: row.invoice.id, label: "Invoice" }] : []),
                            ]}
                            lines={row.lines.map((l) => ({
                              qty: l.quantity_ordered,
                              unit: l.unit,
                              name: l.product_name,
                              sku: l.sku_code,
                            }))}
                            total={total}
                            size="sm"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={orderTone(row.status)}>{orderLabel(row.status)}</Badge>
                      </td>
                      <td className="px-3 py-2">{row.customer_name}</td>
                      <td className="px-3 py-2">{fecha(row.order_date)}</td>
                      <td className="px-3 py-2">Delivery to customer</td>
                      <td className="px-3 py-2 text-right">{money(total)}</td>
                    </tr>
                    {open ? (
                      <tr className="bg-bg">
                        <td colSpan={7} className="p-4">
                          <SoDetail
                            row={row}
                            onShip={(line) => {
                              setShip({
                                line_id: line.id,
                                product_id: line.product_id,
                                pending: line.open,
                                unit: line.unit,
                              });
                              setShipForm({ quantity: String(line.open), lot_id: "", location_id: "" });
                            }}
                            onInvoice={() => void facturar(row.id)}
                            onBuy={() => setBuy({ so_id: row.id, so_number: row.so_number, openQty: row.lines.reduce((s, l) => s + l.open, 0) })}
                            onCredit={() => setCredit(row.id)}
                            onCancel={() => setCancelSo({ id: row.id, so_number: row.so_number })}
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

      {ship ? (
        <Modal title="Fulfill line" onClose={() => setShip(null)}>
          <form className="grid gap-3" onSubmit={doShip}>
            <Field label="Quantity">
              <Input value={shipForm.quantity} onChange={(e) => setShipForm({ ...shipForm, quantity: e.target.value })} />
            </Field>
            <Field label="Lot">
              <Select value={shipForm.lot_id} onChange={(e) => setShipForm({ ...shipForm, lot_id: e.target.value })}>
                <option value="">Select lot</option>
                {allLots
                  .filter((l) => l.product_id === ship.product_id && l.asignable)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lot_number} · {qty(l.current_qty, l.unit)}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Location">
              <Select value={shipForm.location_id} onChange={(e) => setShipForm({ ...shipForm, location_id: e.target.value })}>
                <option value="">Select</option>
                {allLots
                  .find((l) => String(l.id) === shipForm.lot_id)
                  ?.locations.map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.location_name}
                    </option>
                  ))}
              </Select>
              <p className="mt-1 text-xs text-muted">{t("Cold room in the warehouse this fruit leaves from.")}</p>
            </Field>
            <Button type="submit" disabled={saving}>
              Fulfill
            </Button>
          </form>
        </Modal>
      ) : null}

      {buy ? (
        <Modal title="Generate purchase from SO" subtitle={buy.so_number} onClose={() => setBuy(null)}>
          <form className="grid gap-3" onSubmit={generarCompra}>
            <Field label="Vendor">
              <Select required value={buyForm.supplier_id} onChange={(e) => setBuyForm({ ...buyForm, supplier_id: e.target.value })}>
                <option value="">Select</option>
                {(suppliers.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unit cost">
              <Input required value={buyForm.unit_cost} onChange={(e) => setBuyForm({ ...buyForm, unit_cost: e.target.value })} />
            </Field>
            <Button type="submit" disabled={saving}>
              Create PO
            </Button>
          </form>
        </Modal>
      ) : null}

      {credit && selected ? (
        <Modal title="Create Credit Invoice" wide onClose={() => setCredit(null)}>
          <div className="grid gap-3 sm:grid-cols-4">
            <MetaCard label="Customer">{selected.customer_name}</MetaCard>
            <MetaCard label="SO #">{poShort(selected.so_number)}</MetaCard>
            <MetaCard label="Order total">{money(selected.lines.reduce((s, l) => s + l.quantity_ordered * l.unit_price, 0))}</MetaCard>
            <MetaCard label="Customer PO #">{selected.customer_po_number || ""}</MetaCard>
          </div>
          <p className="mt-4 text-sm text-muted">Select the items to credit, the credit type, and the amount to credit per unit.</p>
          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Sold</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Qty to credit</th>
                  <th className="px-3 py-2">Credit/unit</th>
                  <th className="px-3 py-2">Credit total</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-3 py-2">{l.product_name}</td>
                    <td className="px-3 py-2">{l.quantity_ordered}</td>
                    <td className="px-3 py-2">
                      <Select defaultValue="Restock">
                        <option>Restock</option>
                        <option>Loss</option>
                        <option>Price Adjustment</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input defaultValue={String(-l.quantity_ordered)} />
                    </td>
                    <td className="px-3 py-2">{money(l.unit_price)}</td>
                    <td className="px-3 py-2 text-danger">{money(-l.quantity_ordered * l.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Internal note">
              <Textarea placeholder="Add your internal note…" />
            </Field>
            <Field label="Note to customer">
              <Textarea placeholder="Add your customer note…" />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCredit(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selected) return;
                setSaving(true);
                try {
                  await createCreditInvoice({
                    data: {
                      sales_order_id: selected.id,
                      lines: selected.lines.map((l) => ({
                        product_id: l.product_id,
                        description: l.product_name,
                        qty: l.quantity_ordered,
                        credit_per_unit: l.unit_price,
                      })),
                    },
                  });
                  setCredit(null);
                  setMsg("Credit invoice created");
                  await orders.reload();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "Could not create credit");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Create credit
            </Button>
          </div>
        </Modal>
      ) : null}
      {cancelSo ? (
        <CancelDialog
          title={`Cancel order ${poShort(cancelSo.so_number)}`}
          subtitle="If anything was shipped from a lot, it returns to inventory. Blocked if this order already has an invoice."
          onClose={() => setCancelSo(null)}
          onConfirm={async (reason) => {
            await cancelSalesOrder({ data: { sales_order_id: cancelSo.id, reason: reason || undefined } });
            setCancelSo(null);
            await Promise.all([orders.reload(), lots.reload()]);
          }}
        />
      ) : null}
    </div>
  );
}

function SoDetail({
  row,
  onShip,
  onInvoice,
  onBuy,
  onCredit,
  onCancel,
  saving,
}: {
  row: Awaited<ReturnType<typeof listSalesOrders>>[number];
  onShip: (line: Awaited<ReturnType<typeof listSalesOrders>>[number]["lines"][number]) => void;
  onInvoice: () => void;
  onBuy: () => void;
  onCredit: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const total = row.lines.reduce((s, l) => s + l.quantity_ordered * l.unit_price, 0);
  const cost = row.lines.reduce((s, l) => s + l.quantity_ordered * (l.unit_cost || 0), 0);
  const profit = total - cost;
  const margin = total ? (profit / total) * 100 : 0;
  const markup = cost ? (profit / cost) * 100 : 0;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">SO #{poShort(row.so_number)}</h2>
            <Badge tone={orderTone(row.status)}>{orderLabel(row.status)}</Badge>
          </div>
          <p className="text-xs text-muted">Placed on {fecha(row.order_date)}</p>
          <CancelledNote by={row.cancelled_by} at={row.cancelled_at} reason={row.cancel_reason} />
        </div>
        <div className="flex gap-2">
          <SendButton
            title="Sales Order"
            number={row.so_number}
            partyName={row.customer_name}
            email={row.customer_email}
            phone={row.customer_phone}
            docs={[
              { tipo: "ov", id: row.id, label: "Sales Order" },
              ...(row.invoice ? [{ tipo: "factura", id: row.invoice.id, label: "Invoice" }] : []),
            ]}
            lines={row.lines.map((l) => ({
              qty: l.quantity_ordered,
              unit: l.unit,
              name: l.product_name,
              sku: l.sku_code,
            }))}
            total={total}
          />
          <Button size="sm" variant="outline" asChild>
            <Link to="/ventas" search={{ tab: "new" }}>
              + New order
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetaCard label="Customer">
          {row.customer_name}
          <div className="text-[11px] font-normal text-subtle">Price sheet: Default</div>
        </MetaCard>
        <MetaCard label="Requested date">{fecha(row.order_date)}</MetaCard>
        <MetaCard label="Pickup date">{row.ship_date ? fecha(row.ship_date) : "—"}</MetaCard>
        <MetaCard label="Order type">Delivery to customer</MetaCard>
        <MetaCard label="Destination" />
        <MetaCard label="SO invoice #">{row.invoice?.invoice_number || "—"}</MetaCard>
        <MetaCard label="Customer PO #">{row.customer_po_number || "—"}</MetaCard>
        <MetaCard label="Order total">
          {money(total)}
          <div className="text-[11px] font-normal text-subtle">
            Items: {row.lines.length} · Units: {row.lines.reduce((s, l) => s + l.quantity_ordered, 0)}
          </div>
        </MetaCard>
        <MetaCard label="Sales rep">{COMPANY.userName}</MetaCard>
        <MetaCard label="Fulfilled by">{row.status === "completed" ? `Auto-fulfilled ${fecha(row.order_date)}` : "—"}</MetaCard>
      </div>
      <p className="mt-5 mb-2 text-sm font-semibold">Inventory Items</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qty ordered</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {row.lines.map((l, i) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-3">
                  <div className="font-medium">
                    {i + 1}. {l.product_name} {l.empaque ? `· ${l.empaque}` : ""} {l.calibre ? `· ${l.calibre}` : ""}
                  </div>
                  {l.lot_number ? (
                    <div className="text-xs text-muted">
                      {l.lot_number} — {l.quantity_shipped} received / {l.open} ATS
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-3">{l.quantity_ordered}</td>
                <td className="px-3 py-3">{money(l.unit_price)}</td>
                <td className="px-3 py-3">{money(l.quantity_ordered * l.unit_price)}</td>
                <td className="px-3 py-3">
                  {l.open > 0 && row.status !== "cancelled" ? (
                    <Button size="sm" onClick={() => onShip(l)}>
                      Fulfill
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-2 lg:grid-cols-4">
        <div className="rounded-md border border-border p-3 text-sm">
          <Link className="text-link" to="/doc/$tipo/$id" params={{ tipo: "ov", id: row.share_token }}>
            Print documents
          </Link>
          <div className="mt-2">
            <SendButton
              title="Sales Order"
              number={row.so_number}
              partyName={row.customer_name}
              email={row.customer_email}
              phone={row.customer_phone}
              docs={[
                { tipo: "ov", id: row.id, label: "Sales Order" },
                ...(row.invoice ? [{ tipo: "factura", id: row.invoice.id, label: "Invoice" }] : []),
              ]}
              lines={row.lines.map((l) => ({
                qty: l.quantity_ordered,
                unit: l.unit,
                name: l.product_name,
                sku: l.sku_code,
              }))}
              total={total}
              variant="outline"
            />
          </div>
          <p className="mt-2 text-link">Print SO label</p>
          <p className="mt-2 text-link">Print pallet labels</p>
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <p className="text-link">Audit log</p>
          <button type="button" className="mt-2 block text-link" onClick={onCredit}>
            Create credit invoice
          </button>
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex justify-between text-muted">
            <span>Inventory items</span>
            <span>{row.lines.length}</span>
          </div>
          <div className="mt-1 flex justify-between text-muted">
            <span>Inventory units</span>
            <span>{row.lines.reduce((s, l) => s + l.quantity_ordered, 0)}</span>
          </div>
        </div>
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Inventory item total</span>
            <span>{money(total)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>Order total</span>
            <span>{money(total)}</span>
          </div>
          <div className="mt-1 flex justify-between text-muted">
            <span>Blended margin (est.)</span>
            <span>
              {margin.toFixed(0)}% · markup {markup.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!row.invoice && row.status !== "cancelled" ? (
          <Button size="sm" disabled={saving} onClick={onInvoice}>
            Invoice
          </Button>
        ) : null}
        {row.status !== "cancelled" ? (
          <>
            <Button size="sm" variant="outline" onClick={onBuy}>
              Generate purchase
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancel order
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
