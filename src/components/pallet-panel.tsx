import { useMemo, useState } from "react";
import { Modal } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { addPallets, deletePallet, listPallets, updatePallet } from "@/lib/produce-server";
import { useAsync } from "@/lib/use-async";
import { errorMessage } from "@/lib/utils";

type Pallet = Awaited<ReturnType<typeof listPallets>>[number];

// produce-server queries are untyped (Promise<any>) — keep the PO lines loose
// like the rest of the repo does, reading only the fields we know.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PoLine = any;

/**
 * Sección "Pallets" del detalle de una OC: qué pallets componen la carga y
 * qué lleva cada uno. El renglón apunta a la línea de la OC (el calibre vive
 * en el SKU de la línea), así el cuadre contra las cajas de la carga es
 * aritmética exacta. Pallet mixto = pallet con 2+ renglones (manifiesto real
 * de Cornejos: pallet 25 = LARGE 18 + MEDIUM 29).
 *
 * El cuadre no bloquea el guardado (la captura es incremental), pero jamás
 * calla: banner ámbar mientras descuadra, línea verde cuando cuadra, nada
 * mientras no se ha capturado ningún pallet.
 */
export function PalletsPanel({
  purchaseOrderId,
  lines,
}: {
  purchaseOrderId: number;
  lines: PoLine[];
}) {
  const pallets = useAsync(
    () => listPallets({ data: { purchase_order_id: purchaseOrderId } }),
    [purchaseOrderId],
  );
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Pallet | null>(null);
  const [quick, setQuick] = useState({ lineId: "", cases: "", count: "1" });

  const rows = pallets.data ?? [];

  // Etiqueta por línea: el calibre solo si no se repite; si dos líneas
  // comparten calibre (productos distintos), se antepone el producto.
  const labelFor = useMemo(() => {
    const byCalibre = new Map<string, number>();
    for (const l of lines) {
      const c = l.calibre || "";
      byCalibre.set(c, (byCalibre.get(c) ?? 0) + 1);
    }
    return (line: PoLine) => {
      if (!line) return "—";
      if (!line.calibre) return line.product_name;
      return (byCalibre.get(line.calibre) ?? 0) > 1
        ? `${line.product_name} ${line.calibre}`
        : line.calibre;
    };
  }, [lines]);
  const lineById = useMemo(() => {
    const m = new Map<number, PoLine>();
    for (const l of lines) m.set(l.id, l);
    return m;
  }, [lines]);

  // Cuadre por línea: cajas asignadas en pallets vs cajas de la carga.
  const cuadre = useMemo(() => {
    const assigned = new Map<number, number>();
    for (const pa of rows)
      for (const pl of pa.lines)
        assigned.set(
          pl.purchase_order_line_id,
          (assigned.get(pl.purchase_order_line_id) ?? 0) + pl.cases,
        );
    const porLinea = lines.map((l: PoLine) => ({
      line: l,
      expected: Number(l.quantity_ordered) || 0,
      got: assigned.get(l.id) ?? 0,
    }));
    const totalExpected = porLinea.reduce((s, r) => s + r.expected, 0);
    const totalGot = porLinea.reduce((s, r) => s + r.got, 0);
    const missing = porLinea.filter((r) => Math.abs(r.got - r.expected) > 0.001);
    return { porLinea, totalExpected, totalGot, missing, square: missing.length === 0 };
  }, [rows, lines]);

  function onQuickLine(lineId: string) {
    const line = lineId ? lineById.get(Number(lineId)) : null;
    setQuick({
      lineId,
      // Prellenar con cajas/pallet de la línea: el caso común ("56 del mismo
      // calibre" repetido) queda en elegir calibre + cuántos pallets.
      cases: line?.units_per_pallet ? String(line.units_per_pallet) : quick.cases,
      count: quick.count,
    });
  }

  const quickReady =
    quick.lineId &&
    Number(quick.cases) > 0 &&
    Number.isInteger(Number(quick.count)) &&
    Number(quick.count) >= 1;

  async function quickAdd() {
    if (!quickReady || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await addPallets({
        data: {
          purchase_order_id: purchaseOrderId,
          count: Number(quick.count),
          lines: [{ purchase_order_line_id: Number(quick.lineId), cases: Number(quick.cases) }],
        },
      });
      setQuick({ lineId: "", cases: "", count: "1" });
      await pallets.reload();
    } catch (e) {
      setErr(errorMessage(e, "No se pudieron agregar los pallets."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setErr(null);
    try {
      await deletePallet({ data: { id } });
      await pallets.reload();
    } catch (e) {
      setErr(errorMessage(e, "No se pudo eliminar el pallet."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Pallets</p>
        {rows.length ? (
          <span className="text-xs text-muted">
            {rows.length} pallet{rows.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface-2 p-2">
        <Field label="Calibre">
          <Select
            className="w-56"
            value={quick.lineId}
            onChange={(e) => onQuickLine(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {lines.map((l: PoLine) => (
              <option key={l.id} value={l.id}>
                {labelFor(l)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cajas por pallet">
          <Input
            className="w-28"
            value={quick.cases}
            onChange={(e) => setQuick({ ...quick, cases: e.target.value })}
            placeholder="56"
          />
        </Field>
        <Field label="Cuántos pallets">
          <Input
            className="w-28"
            value={quick.count}
            onChange={(e) => setQuick({ ...quick, count: e.target.value })}
          />
        </Field>
        <Button size="sm" disabled={!quickReady || busy} onClick={() => void quickAdd()}>
          {busy
            ? "Guardando…"
            : `+ Agregar ${Number(quick.count) > 1 ? `${quick.count} pallets` : "pallet"}`}
        </Button>
        <p className="basis-full text-[11px] text-muted">
          Para un pallet mixto: agrégalo con su primer calibre y usa «Editar» para sumarle el
          segundo.
        </p>
      </div>

      {err ? (
        <p className="mt-2 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
          {err}
        </p>
      ) : null}

      {rows.length ? (
        cuadre.square ? (
          <p className="mt-2 rounded-md border border-ok/40 bg-ok/5 p-2 text-sm text-ok">
            Cuadra: {cuadre.totalGot} cajas en {rows.length} pallets, igual que la carga. ✓
          </p>
        ) : (
          <div className="mt-2 rounded-md border border-warn/50 bg-warn/10 p-2 text-sm text-warn">
            <p>
              Sin cuadrar: {cuadre.totalGot} de {cuadre.totalExpected} cajas asignadas a pallets.
            </p>
            <p className="mt-1 text-xs">
              {cuadre.missing
                .map((r) => {
                  const diff = r.got - r.expected;
                  return `${labelFor(r.line)}: ${diff < 0 ? `faltan ${-diff}` : `sobran ${diff}`}`;
                })
                .join(" · ")}
            </p>
          </div>
        )
      ) : null}

      {pallets.loading ? <p className="mt-2 text-sm text-muted">Cargando…</p> : null}
      {rows.length ? (
        <div className="mt-2 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-surface-2 text-xs text-muted">
              <tr>
                <th className="w-12 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Contenido</th>
                <th className="w-20 px-3 py-2 font-medium">Cajas</th>
                <th className="w-32 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pa) => (
                <tr key={pa.id} className="border-t border-border">
                  <td className="px-3 py-2 tabular-nums">{pa.pallet_number}</td>
                  <td className="px-3 py-2">
                    {pa.lines
                      .map(
                        (pl) =>
                          `${labelFor(lineById.get(pl.purchase_order_line_id))} · ${pl.cases}${pl.note ? ` (${pl.note})` : ""}`,
                      )
                      .join("  +  ")}
                    {pa.lines.length > 1 ? (
                      <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                        mixto
                      </span>
                    ) : null}
                    {pa.notes ? <div className="text-xs text-muted">{pa.notes}</div> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {pa.lines.reduce((s, pl) => s + pl.cases, 0)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-link"
                      onClick={() => setEditing(pa)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="ml-3 cursor-pointer text-xs text-danger"
                      disabled={busy}
                      onClick={() => void remove(pa.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !pallets.loading ? (
        <p className="mt-2 rounded-md border border-dashed border-border p-3 text-sm text-muted">
          Sin pallets capturados para esta carga.
        </p>
      ) : null}

      {editing ? (
        <PalletModal
          pallet={editing}
          lines={lines}
          labelFor={labelFor}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await pallets.reload();
          }}
        />
      ) : null}
    </div>
  );
}

function PalletModal({
  pallet,
  lines,
  labelFor,
  onClose,
  onSaved,
}: {
  pallet: Pallet;
  lines: PoLine[];
  labelFor: (line: PoLine) => string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notes, setNotes] = useState(pallet.notes || "");
  const [items, setItems] = useState(
    pallet.lines.map((pl) => ({
      key: String(pl.id),
      lineId: String(pl.purchase_order_line_id),
      cases: String(pl.cases),
      note: pl.note || "",
    })),
  );

  const ready = items.length > 0 && items.every((it) => it.lineId && Number(it.cases) > 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSaving(true);
    setErr(null);
    try {
      await updatePallet({
        data: {
          id: pallet.id,
          lines: items.map((it) => ({
            purchase_order_line_id: Number(it.lineId),
            cases: Number(it.cases),
            note: it.note || undefined,
          })),
          notes: notes || undefined,
        },
      });
      await onSaved();
    } catch (e2) {
      setErr(errorMessage(e2, "No se pudo guardar el pallet."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Editar pallet ${pallet.pallet_number}`} onClose={onClose}>
      <form onSubmit={(e) => void save(e)}>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={it.key} className="flex flex-wrap items-end gap-2">
              <Field label="Calibre">
                <Select
                  className="w-52"
                  value={it.lineId}
                  onChange={(e) =>
                    setItems((p) =>
                      p.map((x) => (x.key === it.key ? { ...x, lineId: e.target.value } : x)),
                    )
                  }
                >
                  <option value="">Seleccionar</option>
                  {lines.map((l: PoLine) => (
                    <option key={l.id} value={l.id}>
                      {labelFor(l)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cajas">
                <Input
                  className="w-24"
                  value={it.cases}
                  onChange={(e) =>
                    setItems((p) =>
                      p.map((x) => (x.key === it.key ? { ...x, cases: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <Field label="Nota">
                <Input
                  className="w-32"
                  value={it.note}
                  placeholder="COLOR"
                  onChange={(e) =>
                    setItems((p) =>
                      p.map((x) => (x.key === it.key ? { ...x, note: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              <button
                type="button"
                className="mb-2 cursor-pointer text-xs text-danger disabled:opacity-40"
                disabled={items.length === 1}
                title={
                  items.length === 1 ? "Un pallet lleva al menos un calibre" : "Quitar renglón"
                }
                onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          onClick={() =>
            setItems((p) => [
              ...p,
              { key: `new-${Date.now()}-${p.length}`, lineId: "", cases: "", note: "" },
            ])
          }
        >
          + Agregar calibre (pallet mixto)
        </Button>
        <Field label="Notas del pallet" className="mt-3">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          <Button type="submit" disabled={!ready || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
