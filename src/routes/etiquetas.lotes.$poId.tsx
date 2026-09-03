import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLotLabels } from "@/lib/produce-server";
import { downloadLotLabelsPdf, type LotLabelItem } from "@/lib/label-pdf";
import { errorMessage, fecha } from "@/lib/utils";

export const Route = createFileRoute("/etiquetas/lotes/$poId")({
  loader: ({ params }) => getLotLabels({ data: { purchase_order_id: Number(params.poId) } }),
  component: Page,
});

function toItems(doc: Awaited<ReturnType<typeof getLotLabels>>): LotLabelItem[] {
  return doc.lots.map((l) => ({
    lotNumber: l.lot_number,
    productName: l.product_name,
    calibre: l.calibre,
    supplierName: doc.supplier_name,
    poNumber: doc.po_number,
    qty: l.qty,
    unit: l.unit,
    receivedDate: fecha(l.received_date),
    packDate: fecha(l.pack_date),
    bestByDate: l.best_by_date ? fecha(l.best_by_date) : null,
    grade: l.grade,
    originCountry: l.origin_country,
    qualityState: l.quality_state,
    qualityNote: l.quality_note,
  }));
}

function LabelCard({ item }: { item: LotLabelItem }) {
  return (
    <div className="flex flex-col rounded-md border border-border bg-paper p-3 text-fg">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-base font-bold leading-tight">Lote {item.lotNumber}</p>
        {item.qualityState === "retenido" ? (
          <Badge tone="danger">RETENIDO</Badge>
        ) : (
          <span className="shrink-0 text-[10px] text-muted">OC {item.poNumber}</span>
        )}
      </div>
      {item.qualityState === "retenido" ? (
        <p className="text-right text-[10px] text-muted">OC {item.poNumber}</p>
      ) : null}
      <div className="mt-2 border-t border-border pt-2">
        <p className="text-sm font-semibold">{item.productName}</p>
        {item.calibre ? <p className="text-lg font-bold leading-tight">{item.calibre}</p> : null}
      </div>
      <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted">
        <p>
          Cantidad: {item.qty.toLocaleString("es-MX", { maximumFractionDigits: 2 })} {item.unit}
        </p>
        {item.supplierName ? <p>Proveedor: {item.supplierName}</p> : null}
        {item.receivedDate !== "—" ? <p>Recibido: {item.receivedDate}</p> : null}
        {item.packDate !== "—" && item.packDate !== item.receivedDate ? (
          <p>Empacado: {item.packDate}</p>
        ) : null}
        {item.bestByDate ? <p>Caduca: {item.bestByDate}</p> : null}
        {item.grade ? <p>Grado: {item.grade}</p> : null}
        {item.originCountry ? <p>Origen: {item.originCountry}</p> : null}
        {item.qualityState === "retenido" && item.qualityNote ? (
          <p>Motivo: {item.qualityNote}</p>
        ) : null}
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
      await downloadLotLabelsPdf(items, mode, `Etiquetas-lote-${doc.po_number}`);
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
        title={`Etiquetas de lote — OC ${doc.po_number}`}
        subtitle={`${doc.supplier_name} · ${items.length} lote${items.length === 1 ? "" : "s"}`}
      />
      {!items.length ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
          Los lotes se crean al recibir la mercancía. Esta carga todavía no se ha recibido, así que
          no hay lotes que etiquetar.
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
              <LabelCard key={item.lotNumber} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
