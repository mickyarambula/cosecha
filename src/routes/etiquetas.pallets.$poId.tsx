import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getPalletLabels } from "@/lib/produce-server";
import { downloadPalletLabelsPdf, type PalletLabelItem } from "@/lib/label-pdf";
import { errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/etiquetas/pallets/$poId")({
  loader: ({ params }) => getPalletLabels({ data: { purchase_order_id: Number(params.poId) } }),
  component: Page,
});

function toItems(doc: Awaited<ReturnType<typeof getPalletLabels>>): PalletLabelItem[] {
  return doc.pallets.map((pa) => ({
    palletNumber: pa.pallet_number,
    totalPallets: doc.total_pallets,
    mixed: pa.lines.length > 1,
    lines: pa.lines,
    totalCases: pa.total_cases,
    supplierName: doc.supplier_name,
    poNumber: doc.po_number,
    weight: pa.weight,
    weightUnit: pa.weight_unit,
    notes: pa.notes,
  }));
}

function LabelCard({ item }: { item: PalletLabelItem }) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-paper p-3 text-fg">
      <div className="flex items-start justify-between">
        <p className="font-display text-xl font-bold leading-none">
          Pallet {item.palletNumber} de {item.totalPallets}
        </p>
        {item.mixed ? (
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
            MIXTO
          </span>
        ) : (
          <span className="text-[10px] text-muted">OC {item.poNumber}</span>
        )}
      </div>
      {item.mixed ? (
        <p className="mt-0.5 text-right text-[10px] text-muted">OC {item.poNumber}</p>
      ) : null}
      <div className="mt-2 border-t border-border pt-2 space-y-1">
        {item.lines.map((l, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between text-sm font-semibold">
              <span>{l.label}</span>
              <span>{l.cases} cajas</span>
            </div>
            {l.note ? <p className="text-[11px] italic text-muted">{l.note}</p> : null}
          </div>
        ))}
      </div>
      <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted">
        <p>Total: {item.totalCases} cajas</p>
        <p>Proveedor: {item.supplierName}</p>
        {item.weight != null ? (
          <p>
            Peso: {item.weight.toLocaleString("es-MX", { maximumFractionDigits: 1 })}{" "}
            {item.weightUnit}
          </p>
        ) : null}
        {item.notes ? <p>Nota: {item.notes}</p> : null}
      </div>
    </div>
  );
}

function Page() {
  const doc = Route.useLoaderData();
  const items = toItems(doc);
  const [busy, setBusy] = useState<"true" | "sheet" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function download(mode: "true" | "sheet") {
    if (busy) return;
    setBusy(mode);
    setErr(null);
    try {
      await downloadPalletLabelsPdf(items, mode, `Etiquetas-pallet-${doc.po_number}`);
    } catch (e) {
      setErr(errorMessage(e, "No se pudo generar el PDF de etiquetas."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-5">
      <Link to="/compras" className="text-sm text-link">
        ← Volver a órdenes de compra
      </Link>
      <PageHeader
        title={`Etiquetas de pallet — OC ${doc.po_number}`}
        subtitle={`${doc.supplier_name} · ${items.length} pallet${items.length === 1 ? "" : "s"}`}
      />
      {!items.length ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
          Esta carga no tiene pallets capturados todavía. Captúralos en la sección "Pallets" del
          detalle de la orden.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button disabled={busy !== null} onClick={() => void download("true")}>
              {busy === "true" ? "Generando…" : "Descargar PDF 4×6 (una por página)"}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null}
              onClick={() => void download("sheet")}
            >
              {busy === "sheet" ? "Generando…" : "Descargar PDF carta (6 por hoja, para recortar)"}
            </Button>
          </div>
          {err ? (
            <p className="mb-3 rounded-md border border-danger/40 bg-danger/5 p-2 text-sm text-danger">
              {err}
            </p>
          ) : null}
          <p className="mb-3 text-xs text-muted">
            Así se ve el contenido de cada etiqueta (no es el tamaño real de impresión).
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <LabelCard key={item.palletNumber} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
