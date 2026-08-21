import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kpi, Modal, PageHeader, Panel } from "@/components/app-shell";
import { Badge, orderLabel, orderTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import {
  convertCustomerPOToSO,
  createCustomerPO,
  listCustomerPOs,
  listCustomers,
  listProducts,
} from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { fecha, money, qty, todayISO } from "@/lib/utils";

export const Route = createFileRoute("/cpo")({ component: Page });

type LineDraft = { product_id: string; qty: string; unit: string; unit_price: string };

function emptyLine(): LineDraft {
  return { product_id: "", qty: "", unit: "caja", unit_price: "" };
}

function Page() {
  const cpos = useAsync(() => listCustomerPOs(), []);
  const customers = useAsync(() => listCustomers(), []);
  const products = useAsync(() => listProducts(), []);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({
    customer_id: "",
    customer_po_number: "",
    po_date: todayISO(),
    currency: "USD",
    attachment_url: "",
    notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
      if (status === "open" && c.status !== "open") return false;
      if (status === "converted" && c.status !== "converted") return false;
      if (!needle) return true;
      const blob = `${c.cpo_number} ${c.customer_name} ${c.customer_po_number ?? ""}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [list, q, status]);

  const selected = list.find((c) => c.id === detail) ?? null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ready = lines.filter((l) => l.product_id && Number(l.qty) > 0);
    if (!ready.length) {
      setErr("Agrega al menos un producto con cantidad.");
      return;
    }
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await createCustomerPO({
        data: {
          customer_id: Number(form.customer_id),
          customer_po_number: form.customer_po_number || undefined,
          po_date: form.po_date || undefined,
          currency: form.currency,
          attachment_url: form.attachment_url || undefined,
          notes: form.notes || undefined,
          lines: ready.map((l) => ({
            product_id: Number(l.product_id),
            quantity: Number(l.qty),
            unit: l.unit || "caja",
            unit_price: l.unit_price ? Number(l.unit_price) : undefined,
          })),
        },
      });
      setOpen(false);
      setForm({
        customer_id: "",
        customer_po_number: "",
        po_date: todayISO(),
        currency: "USD",
        attachment_url: "",
        notes: "",
      });
      setLines([emptyLine()]);
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
      setMsg(`${r.cpo_number} convertido a venta ${r.so_number}`);
      await cpos.reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "No se pudo convertir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customer PO"
        subtitle="Camino C · captura el PO del cliente y genera su orden de venta."
        action={<Button onClick={() => setOpen(true)}>Nuevo Customer PO</Button>}
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Kpi label="CPOs abiertos" value={String(kpis.abiertos)} tone={kpis.abiertos ? "warn" : "ok"} />
        <Kpi label="Convertidos" value={String(kpis.convertidos)} tone="ok" />
        <Kpi label="Del mes" value={String(kpis.delMes)} />
      </div>
      {msg ? <p className="mb-3 text-sm text-ok">{msg}</p> : null}
      {err && !open && !detail ? <p className="mb-3 text-sm text-danger">{err}</p> : null}
      {cpos.loading ? <p className="text-sm text-muted">Cargando…</p> : null}
      {cpos.error ? <p className="text-sm text-danger">{cpos.error}</p> : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="max-w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="open">Abiertos</option>
          <option value="converted">Convertidos</option>
        </Select>
        <Input
          className="max-w-sm"
          placeholder="Buscar folio, cliente o N° cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="ml-auto text-xs text-subtle">
          {filtered.length} de {list.length} customer PO
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">N° cliente</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Moneda</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Adjunto</th>
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
                <td className="px-4 py-3">{cpo.currency}</td>
                <td className="px-4 py-3">
                  <Badge tone={orderTone(cpo.status)}>{orderLabel(cpo.status)}</Badge>
                </td>
                <td className="px-4 py-3">
                  {cpo.attachment_url ? (
                    <a
                      href={cpo.attachment_url}
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
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">
                  No hay Customer PO con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {open ? (
        <Modal wide title="Nuevo Customer PO" subtitle="Captura el PO que envió el cliente" onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={submit}>
            <Field label="Cliente *">
              <Select required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                <option value="">Seleccionar</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
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
            <Field label="Moneda">
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
              </Select>
            </Field>
            <Field label="Adjunto del PO">
              <Input
                placeholder="Pega una URL de Drive…"
                value={form.attachment_url}
                onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
              />
            </Field>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Líneas</p>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-4">
                    <div className="sm:col-span-2">
                      <Field label="Producto">
                        <Select
                          required
                          value={line.product_id}
                          onChange={(e) => {
                            const product = (products.data ?? []).find((p) => p.id === Number(e.target.value));
                            setLines((prev) =>
                              prev.map((l, idx) =>
                                idx === i
                                  ? { ...l, product_id: e.target.value, unit: product?.default_unit || l.unit }
                                  : l,
                              ),
                            );
                          }}
                        >
                          <option value="">Seleccionar</option>
                          {(products.data ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.variety ?? ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
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
                + Agregar línea
              </button>
            </div>
            <Field label="Nota">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            {err && open ? <p className="text-sm text-danger">{err}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Crear Customer PO"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Modal>
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Cliente</p>
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Moneda</p>
              <p className="mt-1 text-sm">{selected.currency}</p>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Estado</p>
              <div className="mt-1">
                <Badge tone={orderTone(selected.status)}>{orderLabel(selected.status)}</Badge>
              </div>
            </Panel>
            <Panel className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Adjunto</p>
              {selected.attachment_url ? (
                <a
                  href={selected.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Ver adjunto
                </a>
              ) : (
                <p className="mt-1 text-sm text-subtle">—</p>
              )}
            </Panel>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 font-medium">Producto</th>
                  <th className="py-2 text-right font-medium">Cantidad</th>
                  <th className="py-2 text-right font-medium">Precio</th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((l) => (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="py-2">{l.product_name}</td>
                    <td className="py-2 text-right tabular-nums">{qty(l.quantity, l.unit)}</td>
                    <td className="py-2 text-right tabular-nums">{l.unit_price ? money(l.unit_price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected.notes ? <p className="mt-3 text-xs text-muted">{selected.notes}</p> : null}
          {err && detail ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {selected.status === "open" ? (
              <Button disabled={saving} onClick={() => void convertir(selected.id)}>
                {saving ? "Convirtiendo…" : "Convertir a venta"}
              </Button>
            ) : selected.so_number ? (
              <Link to="/ventas" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline">
                Ver venta {selected.so_number}
              </Link>
            ) : null}
            <Button variant="outline" onClick={() => setDetail(null)}>
              Cerrar
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
