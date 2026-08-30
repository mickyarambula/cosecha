import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Kpi, Modal, TabActions } from "@/components/app-shell";
import { FilterField, FilterRow } from "@/components/product-picker";
import { Badge, qualityLabel } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useT } from "@/lib/i18n";
import { poShort } from "@/lib/nav";
import {
  closeLot,
  getLotTrace,
  getWarehouse,
  holdLot,
  listLots,
  listProducts,
  setLotQuality,
  updatePalletDef,
  wasteLot,
  type LotRow,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { CALIDAD_LABEL, WASTE_REASONS, errorMessage, fecha, money, pct } from "@/lib/utils";

type Search = { tab?: string };
export const Route = createFileRoute("/inventario")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    tab: typeof s.tab === "string" ? s.tab : "pricing",
  }),
  component: Page,
});

function keyOf(l: LotRow) {
  return `${l.product_name}::${l.pack_name || l.unit}::${l.product_id}`;
}

function Page() {
  const { tab } = Route.useSearch();
  const t = useT();
  const lots = useAsync(() => listLots(), []);
  const warehouse = useAsync(() => getWarehouse(), []);
  const products = useAsync(() => listProducts(), []);
  const [q, setQ] = useState("");
  const [oh, setOh] = useState("all");
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [calidad, setCalidad] = useState<{ id: number; state: string; note: string } | null>(null);
  const [waste, setWaste] = useState<{ id: number; number: string; oh: number; qty: string; reason: string } | null>(null);
  const [price, setPrice] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [calidadErr, setCalidadErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const data = lots.data ?? [];
  const grouped = useMemo(() => {
    const s = q.trim().toLowerCase();
    const map = new Map<string, LotRow[]>();
    for (const l of data) {
      if (oh === "positive" && l.current_qty <= 0) continue;
      if (s && !`${l.product_name} ${l.lot_number} ${l.pack_name ?? ""}`.toLowerCase().includes(s)) continue;
      const key = keyOf(l);
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map.entries()];
  }, [data, q, oh]);

  const incMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of warehouse.data?.incoming ?? []) m.set(`${r.product_id}:${r.pack_style_id ?? 0}`, r.qty);
    return m;
  }, [warehouse.data]);
  const openMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of warehouse.data?.open_sales ?? []) m.set(`${r.product_id}:${r.pack_style_id ?? 0}`, r.qty);
    return m;
  }, [warehouse.data]);

  async function guardarCalidad(e: React.FormEvent) {
    e.preventDefault();
    if (!calidad) return;
    setSaving(true);
    setCalidadErr(null);
    try {
      await setLotQuality({
        data: {
          lot_id: calidad.id,
          quality_state: calidad.state as "sano" | "retenido" | "castigado" | "destruido",
          quality_note: calidad.note || undefined,
        },
      });
      setCalidad(null);
      await lots.reload();
    } catch (e2) {
      setCalidadErr(errorMessage(e2, "No se pudo guardar la calidad del lote."));
    } finally {
      setSaving(false);
    }
  }

  async function doWaste(e: React.FormEvent) {
    e.preventDefault();
    if (!waste) return;
    setSaving(true);
    try {
      await wasteLot({ data: { lot_id: waste.id, quantity: Number(waste.qty), reason: waste.reason } });
      setWaste(null);
      setMsg("Units marked as wasted");
      await lots.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not waste");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "lots") {
    return (
      <>
        <TabActions>
          <Button size="sm" variant="outline" asChild>
            <Link to="/productos" search={{ tab: "catalog" }}>
              New product / SKU
            </Link>
          </Button>
        </TabActions>
        <LotsBoard
          lots={data}
          q={q}
          setQ={setQ}
          onOpen={setDetail}
          onWaste={(l) => setWaste({ id: l.id, number: l.lot_number, oh: l.current_qty, qty: "1", reason: "Quality dump" })}
          onHold={async (l) => {
            await holdLot({ data: { lot_id: l.id, held: !l.held } });
            await lots.reload();
          }}
          onClose={async (l) => {
            await closeLot({ data: { lot_id: l.id } });
            await lots.reload();
          }}
        />
        {waste ? <WasteModal waste={waste} setWaste={setWaste} saving={saving} onSubmit={doWaste} /> : null}
        {detail ? (
          <LotDetailModal
            lot={data.find((l) => l.id === detail) ?? null}
            onClose={() => setDetail(null)}
            onWaste={(l) => {
              setDetail(null);
              setWaste({ id: l.id, number: l.lot_number, oh: l.current_qty, qty: "1", reason: "Quality dump" });
            }}
            onHold={async (l) => {
              await holdLot({ data: { lot_id: l.id, held: !l.held } });
              await lots.reload();
            }}
            onCloseLot={async (l) => {
              await closeLot({ data: { lot_id: l.id } });
              await lots.reload();
              setDetail(null);
            }}
          />
        ) : null}
      </>
    );
  }

  if (tab === "oversold") {
    const oversold = grouped
      .map(([key, rows]) => {
        const first = rows[0];
        const ats = rows.reduce((s, l) => s + (l.asignable ? l.current_qty : 0), 0);
        const demand = openMap.get(`${first.product_id}:${first.pack_style_id ?? 0}`) ?? 0;
        const unl = demand - ats;
        return { key, name: first.product_name, unit: first.pack_name || first.unit, ats, unl };
      })
      .filter((r) => r.unl > 0);
    return (
      <div>
        {oversold.length === 0 ? (
          <p className="p-8 text-center text-muted">No oversold inventory items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Available to sell</th>
                  <th className="px-3 py-2 text-right">Unlinked sales</th>
                </tr>
              </thead>
              <tbody>
                {oversold.map((r) => (
                  <tr key={r.key} className="border-b border-border">
                    <td className="px-3 py-2">
                      {r.name}
                      <div className="text-xs text-muted">{r.unit}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{r.ats}</td>
                    <td className="px-3 py-2 text-right font-semibold text-danger">−{r.unl}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === "fulfillment") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">Open sales orders waiting on lot assignment.</p>
        <Link to="/ventas" className="mt-3 inline-block text-sm text-link">
          Open sales orders
        </Link>
      </div>
    );
  }

  if (tab === "details") {
    return (
      <div>
        <FilterRow>
          <FilterField label="Items" className="min-w-40 flex-1">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
          </FilterField>
        </FilterRow>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">O/H</th>
                <th className="px-3 py-2">Lots</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([key, rows]) => {
                const [name, unit] = key.split("::");
                return (
                  <tr key={key} className="border-b border-border bg-surface">
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <td className="px-3 py-2 text-muted">{unit}</td>
                    <td className="px-3 py-2 text-muted">{rows[0]?.sku}</td>
                    <td className="px-3 py-2 text-right">{rows.reduce((s, l) => s + l.current_qty, 0)}</td>
                    <td className="px-3 py-2 text-muted">{rows.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (tab === "pallet") {
    const packs = (products.data ?? []).flatMap((p) =>
      p.packs.map((k) => ({
        ...k,
        product_name: p.name,
      })),
    );
    return (
      <PalletTab
        packs={packs}
        onSave={async (id, fields) => {
          await updatePalletDef({ data: { pack_style_id: id, ...fields } });
          await products.reload();
        }}
      />
    );
  }

  if (tab === "oh") {
    const withStock = data.filter((l) => l.current_qty > 0 || l.original_qty > 0);
    return (
      <div>
        <p className="px-5 py-3 text-sm text-muted">
          Reconcile on-hand vs physical. If units were lost or damaged, waste them so O/H matches the cooler.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Lot #</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2 text-right">ATS</th>
                <th className="px-3 py-2 text-right">O/H</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {withStock.map((l) => (
                <tr key={l.id} className="border-b border-border">
                  <td className="px-3 py-2 font-medium text-link">{l.lot_number}</td>
                  <td className="px-3 py-2">
                    {l.product_name}
                    <div className="text-xs text-muted">{l.pack_name || l.unit}</div>
                  </td>
                  <td className="px-3 py-2">{l.supplier_name}</td>
                  <td className="px-3 py-2">{fecha(l.received_date)}</td>
                  <td className="px-3 py-2 text-right">{l.asignable ? l.current_qty : 0}</td>
                  <td className="px-3 py-2 text-right">{l.current_qty}</td>
                  <td className="px-3 py-2">{l.po_number ? `PO #${poShort(l.po_number)}` : "—"}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      disabled={l.current_qty <= 0}
                      onClick={() => setWaste({ id: l.id, number: l.lot_number, oh: l.current_qty, qty: "1", reason: "Quality dump" })}
                    >
                      Waste units
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {waste ? <WasteModal waste={waste} setWaste={setWaste} saving={saving} onSubmit={doWaste} /> : null}
      </div>
    );
  }

  if (tab === "inactive") {
    return <div className="p-8 text-center text-sm text-muted">No inactive inventory items.</div>;
  }

  return (
    <div>
      <TabActions>
        <Button size="sm" variant="outline" asChild>
          <Link to="/productos" search={{ tab: "catalog" }}>
            New product / SKU
          </Link>
        </Button>
      </TabActions>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-3">
        <p className="text-sm text-muted">
          {t("Available Units is stock on lots. Create the product × pack × count in")}{" "}
          <Link to="/productos" search={{ tab: "catalog" }} className="text-link">
            {t("Products & SKUs")}
          </Link>
          .
        </p>
        <Button size="sm" asChild>
          <Link to="/productos" search={{ tab: "catalog" }}>
            {t("New product / SKU")}
          </Link>
        </Button>
      </div>
      {msg ? <p className="px-5 py-2 text-sm text-ok">{msg}</p> : null}
      <FilterRow>
        <FilterField label="Items" className="min-w-40 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
        </FilterField>
        <FilterField label="On hand">
          <Select value={oh} onChange={(e) => setOh(e.target.value)}>
            <option value="all">All items</option>
            <option value="positive">Positive</option>
          </Select>
        </FilterField>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline">
            Export
          </Button>
        </div>
      </FilterRow>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-y border-border bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2 text-right">Avail. to sell</th>
              <th className="px-3 py-2 text-right">O/H</th>
              <th className="px-3 py-2 text-right">Inc.</th>
              <th className="px-3 py-2 text-right">Allo.</th>
              <th className="px-3 py-2 text-right">Unl. sales</th>
              <th className="px-3 py-2">B/E</th>
              <th className="px-3 py-2">Price</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(([key, rows]) => {
              const first = rows[0];
              const ats = rows.reduce((s, l) => s + (l.asignable ? l.current_qty : 0), 0);
              const ohQty = rows.reduce((s, l) => s + l.current_qty, 0);
              const inc = incMap.get(`${first.product_id}:${first.pack_style_id ?? 0}`) ?? 0;
              const demand = openMap.get(`${first.product_id}:${first.pack_style_id ?? 0}`) ?? 0;
              const unl = Math.max(0, demand - ats);
              const be = rows.find((r) => r.unit_cost > 0)?.unit_cost || 0;
              const expanded = open != null && rows.some((r) => r.id === open);
              const low = ats <= 0;
              return (
                <Fragment key={key}>
                  <tr className="border-b border-border bg-surface">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setOpen(expanded ? null : first.id)}>
                        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-medium">{first.product_name}</td>
                    <td className="px-3 py-2 text-muted">{first.pack_name || first.unit}</td>
                    <td className="px-3 py-2 text-muted">—</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {ats}
                      {low ? <span className="ml-2 rounded-full bg-danger/12 px-1.5 py-0.5 text-[10px] font-medium text-danger">Low</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right">{ohQty}</td>
                    <td className="px-3 py-2 text-right">{inc}</td>
                    <td className="px-3 py-2 text-right">0</td>
                    <td className={`px-3 py-2 text-right ${unl ? "font-semibold text-danger" : ""}`}>{unl || 0}</td>
                    <td className="px-3 py-2">{be ? money(be) : <span className="text-xs text-danger">PAS</span>}</td>
                    <td className="px-3 py-2">
                      <Input
                        className="w-24"
                        value={price[first.id] ?? (be ? String((be + 3).toFixed(2)) : "0.00")}
                        onChange={(e) => setPrice((p) => ({ ...p, [first.id]: e.target.value }))}
                      />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-bg">
                      <td colSpan={11} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Lots</p>
                        <table className="w-full text-left text-xs">
                          <thead className="text-muted">
                            <tr>
                              <th className="py-1">Vendor</th>
                              <th>Lot #</th>
                              <th>Origin</th>
                              <th>Source</th>
                              <th>Cost/unit</th>
                              <th>Received</th>
                              <th className="text-right">Avail. to sell</th>
                              <th className="text-right">O/H</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((l) => (
                              <tr key={l.id} className="border-t border-border">
                                <td className="py-2">{l.supplier_name}</td>
                                <td>
                                  <button type="button" className="font-medium text-link" onClick={() => setDetail(l.id)}>
                                    {l.lot_number}
                                  </button>
                                </td>
                                <td>{l.origin_country || "MX"}</td>
                                <td>{l.po_number ? `PO #${poShort(l.po_number)}` : "—"}</td>
                                <td>{l.unit_cost ? money(l.unit_cost) : <span className="text-danger">PAS</span>}</td>
                                <td>{fecha(l.received_date)}</td>
                                <td className="text-right font-semibold">{l.asignable ? l.current_qty : 0}</td>
                                <td className="text-right">{l.current_qty}</td>
                                <td className="space-x-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => { setCalidad({ id: l.id, state: l.quality_state, note: l.quality_note ?? "" }); setCalidadErr(null); }}
                                  >
                                    {qualityLabel(l.quality_state)}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setWaste({ id: l.id, number: l.lot_number, oh: l.current_qty, qty: "1", reason: "Quality dump" })}
                                  >
                                    Waste
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {calidad ? (
        <Modal title="Lot quality" onClose={() => setCalidad(null)}>
          <form className="grid gap-3" onSubmit={guardarCalidad}>
            <Field label="State">
              <Select value={calidad.state} onChange={(e) => setCalidad({ ...calidad, state: e.target.value })}>
                {Object.keys(CALIDAD_LABEL).map((c) => (
                  <option key={c} value={c}>
                    {qualityLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Note">
              <Input value={calidad.note} onChange={(e) => setCalidad({ ...calidad, note: e.target.value })} />
            </Field>
            {calidadErr ? <p className="rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">{calidadErr}</p> : null}
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </form>
        </Modal>
      ) : null}
      {waste ? <WasteModal waste={waste} setWaste={setWaste} saving={saving} onSubmit={doWaste} /> : null}
      {detail ? (
        <LotDetailModal
          lot={data.find((l) => l.id === detail) ?? null}
          onClose={() => setDetail(null)}
          onWaste={(l) => {
            setDetail(null);
            setWaste({ id: l.id, number: l.lot_number, oh: l.current_qty, qty: "1", reason: "Quality dump" });
          }}
          onHold={async (l) => {
            await holdLot({ data: { lot_id: l.id, held: !l.held } });
            await lots.reload();
          }}
          onCloseLot={async (l) => {
            await closeLot({ data: { lot_id: l.id } });
            await lots.reload();
            setDetail(null);
          }}
        />
      ) : null}
    </div>
  );
}

function LotsBoard({
  lots,
  q,
  setQ,
  onOpen,
  onWaste,
  onHold,
  onClose,
}: {
  lots: LotRow[];
  q: string;
  setQ: (v: string) => void;
  onOpen: (id: number) => void;
  onWaste: (l: LotRow) => void;
  onHold: (l: LotRow) => Promise<void>;
  onClose: (l: LotRow) => Promise<void>;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { po: string | null; vendor: string | null; received: string | null; lots: LotRow[] }>();
    for (const l of lots) {
      if (q && !`${l.lot_number} ${l.product_name} ${l.supplier_name ?? ""}`.toLowerCase().includes(q.toLowerCase())) continue;
      const key = l.po_number || "unlinked";
      const g = map.get(key) ?? { po: l.po_number, vendor: l.supplier_name, received: l.received_date, lots: [] };
      g.lots.push(l);
      map.set(key, g);
    }
    return [...map.values()];
  }, [lots, q]);

  return (
    <div>
      <FilterRow>
        <FilterField label="Search" className="min-w-40 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lots" />
        </FilterField>
      </FilterRow>
      {groups.map((g) => {
        const sold = g.lots.reduce((s, l) => s + l.sold_qty, 0);
        const revenue = g.lots.reduce((s, l) => s + l.revenue, 0);
        const units = g.lots.reduce((s, l) => s + l.original_qty, 0);
        const expShare = g.lots.reduce((s, l) => s + (l.unit_cost > 0 ? 0 : 0), 0);
        void expShare;
        return (
          <div key={g.po || "x"} className="mb-6 border-b border-border pb-4">
            <div className="flex flex-wrap items-center gap-3 bg-primary px-4 py-2 text-primary-fg">
              <span className="font-semibold">PO {g.po ? `#${poShort(g.po)}` : "—"}</span>
              <span className="text-sm">{g.vendor}</span>
              <span className="text-sm">Received {fecha(g.received)}</span>
              <span className="ml-auto text-sm">Inv. units {units} · T. sales {money(revenue)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 px-4 py-3 sm:grid-cols-5">
              <Kpi label="Lots" value={String(g.lots.length)} />
              <Kpi label="Units received" value={String(units)} />
              <Kpi label="Sold" value={String(sold)} />
              <Kpi label="Total sales" value={money(revenue)} />
              <Kpi label="On hand" value={String(g.lots.reduce((s, l) => s + l.current_qty, 0))} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Lot #</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-right">ATS</th>
                    <th className="px-3 py-2 text-right">O/H</th>
                    <th className="px-3 py-2 text-right">Waste</th>
                    <th className="px-3 py-2 text-right">RTS</th>
                    <th className="px-3 py-2 text-right">Sold</th>
                    <th className="px-3 py-2">Avg $/unit</th>
                    <th className="px-3 py-2">T. sales</th>
                    <th className="px-3 py-2">Cost/U</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {g.lots.map((l) => (
                    <tr key={l.id} className="border-b border-border">
                      <td className="px-3 py-2">
                        <button type="button" className="font-medium text-link" onClick={() => onOpen(l.id)}>
                          {l.lot_number}
                        </button>
                        {l.held ? <Badge tone="warn">Hold</Badge> : null}
                      </td>
                      <td className="px-3 py-2">
                        {l.product_name}
                        <div className="text-xs text-muted">{l.pack_name || l.unit}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{l.original_qty}</td>
                      <td className="px-3 py-2 text-right">{l.asignable ? l.current_qty : 0}</td>
                      <td className={`px-3 py-2 text-right ${l.current_qty <= 0 ? "text-danger" : ""}`}>{l.current_qty}</td>
                      <td className="px-3 py-2 text-right">{l.waste_qty}</td>
                      <td className="px-3 py-2 text-right">{l.rts_qty}</td>
                      <td className="px-3 py-2 text-right">{l.sold_qty}</td>
                      <td className="px-3 py-2">{l.sold_qty ? money(l.revenue / l.sold_qty) : "—"}</td>
                      <td className="px-3 py-2">{money(l.revenue)}</td>
                      <td className="px-3 py-2">{l.unit_cost ? money(l.unit_cost) : <span className="text-xs text-danger">PAS</span>}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => onWaste(l)}>
                            Waste
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void onHold(l)}>
                            {l.held ? "Unhold" : "Hold"}
                          </Button>
                          <Button size="sm" onClick={() => void onClose(l)}>
                            Close lot
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LotDetailModal({
  lot,
  onClose,
  onWaste,
  onHold,
  onCloseLot,
}: {
  lot: LotRow | null;
  onClose: () => void;
  onWaste: (l: LotRow) => void;
  onHold: (l: LotRow) => Promise<void>;
  onCloseLot: (l: LotRow) => Promise<void>;
}) {
  const trace = useAsync(() => (lot ? getLotTrace({ data: { lotId: lot.id } }) : Promise.resolve(null)), [lot?.id]);
  if (!lot) return null;
  const sales = trace.data?.sales ?? [];
  const revenue = sales.reduce((s, r) => s + r.revenue, 0);
  const avg = lot.sold_qty ? revenue / lot.sold_qty : 0;
  const be = lot.unit_cost;
  const profit = revenue - be * lot.original_qty;
  return (
    <Modal wide title={`Lot: ${lot.lot_number}`} onClose={onClose}>
      <div className="mb-3 flex justify-end">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-action" checked={lot.held} onChange={() => void onHold(lot)} />
          Hold lot
        </label>
      </div>
      <div className="grid gap-2 rounded-md border border-border p-3 text-sm sm:grid-cols-4 lg:grid-cols-8">
        <Info label="Source" value={lot.po_number ? `PO #${poShort(lot.po_number)}` : "—"} />
        <Info label="Recvd date" value={fecha(lot.received_date)} />
        <Info label="Product" value={lot.product_name} />
        <Info label="Unit" value={lot.pack_name || lot.unit} />
        <Info label="Vendor" value={lot.supplier_name || "—"} />
        <Info label="Total qty" value={String(lot.original_qty)} />
        <Info label="Available to sell" value={String(lot.asignable ? lot.current_qty : 0)} />
        <Info label="Waste" value={String(lot.waste_qty)} />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-semibold uppercase text-muted">Lot expenses</p>
          <p className="mt-1 text-sm text-muted">Allocated from the purchase order. Open settlement to edit.</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-semibold uppercase text-muted">Performance</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <Info label="Break-even/unit" value={be ? money(be, 4) : "PAS"} />
            <Info label="Qty sold" value={String(lot.sold_qty)} />
            <Info label="Avg price/unit" value={avg ? money(avg) : "—"} />
            <Info label="Revenue total" value={money(revenue)} />
            <Info label="Profit total" value={money(profit)} />
            <Info label="Profit as %" value={revenue ? pct((profit / revenue) * 100) : "—"} />
          </div>
        </div>
      </div>
      <p className="mt-4 mb-2 text-sm font-semibold">Lot Sales</p>
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
          <tr>
            {["SO #", "Inv #", "Customer", "Requested date", "Lot qty", "Price per unit", "Lot revenue"].map((h) => (
              <th key={h} className="px-2 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sales.map((s, i) => (
            <tr key={`${s.so_id}-${i}`} className="border-b border-border">
              <td className="px-2 py-2 text-link">{s.so_number}</td>
              <td className="px-2 py-2">{s.invoice || "—"}</td>
              <td className="px-2 py-2">{s.customer}</td>
              <td className="px-2 py-2">{fecha(s.order_date)}</td>
              <td className="px-2 py-2">{s.qty}</td>
              <td className="px-2 py-2">{money(s.unit_price)}</td>
              <td className="px-2 py-2">{money(s.revenue)}</td>
            </tr>
          ))}
          {sales.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-2 py-4 text-center text-muted">
                No sales from this lot yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onWaste(lot)}>
          Waste from this lot
        </Button>
        <Button size="sm" onClick={() => void onCloseLot(lot)}>
          Close lot
        </Button>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function WasteModal({
  waste,
  setWaste,
  saving,
  onSubmit,
}: {
  waste: { id: number; number: string; oh: number; qty: string; reason: string };
  setWaste: (v: typeof waste | null) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Modal title="Mark units as wasted" onClose={() => setWaste(null)}>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <p className="text-sm text-muted">
          Lot {waste.number} · O/H {waste.oh}
        </p>
        <Field label="Units to waste">
          <Input value={waste.qty} onChange={(e) => setWaste({ ...waste, qty: e.target.value })} />
        </Field>
        <Field label="Waste reason">
          <Select value={waste.reason} onChange={(e) => setWaste({ ...waste, reason: e.target.value })}>
            {WASTE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setWaste(null)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            Waste units
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PalletTab({
  packs,
  onSave,
}: {
  packs: {
    id: number;
    product_name: string;
    name: string;
    sku_code: string | null;
    units_per_pallet: number;
    units_per_layer: number;
    weight_per_pallet: number;
    weight_unit_pallet?: string | null;
  }[];
  onSave: (id: number, fields: { units_per_pallet?: number; units_per_layer?: number; weight_per_pallet?: number }) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<number, { upp: string; upl: string; wpp: string }>>({});
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="border-y border-border bg-surface-2 text-[11px] uppercase text-muted">
          <tr>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2">Units per pallet</th>
            <th className="px-3 py-2">Units per layer</th>
            <th className="px-3 py-2">Weight per pallet</th>
          </tr>
        </thead>
        <tbody>
          {packs.map((p) => {
            const d = draft[p.id] ?? {
              upp: p.units_per_pallet ? String(p.units_per_pallet) : "",
              upl: p.units_per_layer ? String(p.units_per_layer) : "",
              wpp: p.weight_per_pallet ? String(p.weight_per_pallet) : "",
            };
            return (
              <tr key={p.id} className="border-b border-border">
                <td className="px-3 py-2">{p.product_name}</td>
                <td className="px-3 py-2 text-muted">{p.name}</td>
                <td className="px-3 py-2 text-muted">{p.sku_code || "—"}</td>
                <td className="px-3 py-2">
                  <Input
                    className="w-24"
                    value={d.upp}
                    onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...d, upp: e.target.value } }))}
                    onBlur={() => d.upp && void onSave(p.id, { units_per_pallet: Number(d.upp) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    className="w-24"
                    value={d.upl}
                    onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...d, upl: e.target.value } }))}
                    onBlur={() => d.upl && void onSave(p.id, { units_per_layer: Number(d.upl) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Input
                      className="w-24"
                      value={d.wpp}
                      onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...d, wpp: e.target.value } }))}
                      onBlur={() => d.wpp && void onSave(p.id, { weight_per_pallet: Number(d.wpp) })}
                    />
                    <span className="text-xs text-muted">{p.weight_unit_pallet || "lb"}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
