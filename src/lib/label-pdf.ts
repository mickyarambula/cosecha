import type { jsPDF } from "jspdf";
import { GREEN, INK, MUTED, RULE, WARN, safeFilename, triggerDownload } from "@/lib/doc-pdf";

/**
 * Etiquetas de pallet y de lote: mismo diseño en dos acomodos, no dos
 * diseños que mantener por separado. "true" = tamaño real 4×6 (para
 * cuando haya impresora térmica, una etiqueta por página). "sheet" = 6
 * compactas por hoja carta (2×3) con líneas de corte, para imprimir hoy
 * en la impresora de oficina. La única diferencia entre acomodos es la
 * escala de fuente/relleno (ver STYLE) — el contenido es idéntico.
 */

export type LabelMode = "true" | "sheet";

export type PalletLabelItem = {
  palletNumber: number;
  totalPallets: number;
  mixed: boolean;
  lines: { label: string; cases: number; note: string | null }[];
  totalCases: number;
  supplierName: string;
  poNumber: string;
  weight: number | null;
  weightUnit: string | null;
  notes: string | null;
};

export type LotLabelItem = {
  lotNumber: string;
  productLabel: string;
  supplierName: string | null;
  poNumber: string;
  qty: number;
  unit: string;
  receivedDate: string | null;
  packDate: string | null;
  bestByDate: string | null;
  grade: string | null;
  originCountry: string | null;
  qualityState: string;
  qualityNote: string | null;
};

const PT = 72;
const TRUE_W = 4 * PT;
const TRUE_H = 6 * PT;
const SHEET_W = 8.5 * PT;
const SHEET_H = 11 * PT;
const SHEET_COLS = 2;
const SHEET_ROWS = 3;
const SHEET_MARGIN = 18;
const SHEET_GUTTER = 10;
const SHEET_PER_PAGE = SHEET_COLS * SHEET_ROWS;

type Box = { x: number; y: number; w: number; h: number };
type DrawMode = "true" | "compact";

const STYLE: Record<
  DrawMode,
  { pad: number; big: number; med: number; small: number; gap: number; lineH: number }
> = {
  true: { pad: 16, big: 30, med: 16, small: 9.5, gap: 7, lineH: 12.5 },
  // "el mismo diseño con menos aire": mismos elementos, número de pallet/lote
  // y calibre se quedan grandes; todo lo demás encoge junto con el relleno.
  compact: { pad: 8, big: 17, med: 10.5, small: 6.6, gap: 3, lineH: 8.4 },
};

function cellW() {
  return (SHEET_W - 2 * SHEET_MARGIN - (SHEET_COLS - 1) * SHEET_GUTTER) / SHEET_COLS;
}
function cellH() {
  return (SHEET_H - 2 * SHEET_MARGIN - (SHEET_ROWS - 1) * SHEET_GUTTER) / SHEET_ROWS;
}
function sheetCell(i: number): Box {
  const r = Math.floor(i / SHEET_COLS);
  const c = i % SHEET_COLS;
  const w = cellW();
  const h = cellH();
  return {
    x: SHEET_MARGIN + c * (w + SHEET_GUTTER),
    y: SHEET_MARGIN + r * (h + SHEET_GUTTER),
    w,
    h,
  };
}

function drawCutLines(pdf: jsPDF) {
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.5);
  pdf.setLineDashPattern([3, 3], 0);
  const w = cellW();
  const h = cellH();
  for (let c = 1; c < SHEET_COLS; c++) {
    const x = SHEET_MARGIN + c * w + (c - 1) * SHEET_GUTTER + SHEET_GUTTER / 2;
    pdf.line(x, SHEET_MARGIN / 2, x, SHEET_H - SHEET_MARGIN / 2);
  }
  for (let r = 1; r < SHEET_ROWS; r++) {
    const y = SHEET_MARGIN + r * h + (r - 1) * SHEET_GUTTER + SHEET_GUTTER / 2;
    pdf.line(SHEET_MARGIN / 2, y, SHEET_W - SHEET_MARGIN / 2, y);
  }
  pdf.setLineDashPattern([], 0);
}

// Ancho automático según el texto real ("RETENIDO" es más largo que "MIXTO"),
// para no repetir el error de que un badge más largo se monte sobre el título.
function badge(
  pdf: jsPDF,
  xRight: number,
  yMid: number,
  text: string,
  mode: DrawMode,
  color: [number, number, number],
) {
  const fontSize = mode === "true" ? 10 : 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fontSize);
  const padX = mode === "true" ? 8 : 5;
  const w = pdf.getTextWidth(text) + padX * 2;
  const h = mode === "true" ? 16 : 11;
  pdf.setFillColor(...color);
  pdf.roundedRect(xRight - w, yMid - h / 2, w, h, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.text(text, xRight - w / 2, yMid + fontSize * 0.35, { align: "center" });
}

function drawPalletLabel(pdf: jsPDF, box: Box, item: PalletLabelItem, mode: DrawMode) {
  const s = STYLE[mode];
  const { x, y, w, h } = box;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.75);
  pdf.rect(x, y, w, h);

  // Renglón superior (OC + badge de mixto) va en SU PROPIA línea, separado del
  // título grande — un pallet mixto con folio largo montaba el badge encima
  // del "PALLET N de M" cuando compartían el mismo renglón.
  let cy = y + s.pad + s.small * 0.9;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(s.small);
  pdf.setTextColor(...MUTED);
  if (item.mixed) {
    pdf.text(`OC ${item.poNumber}`, x + s.pad, cy);
    badge(pdf, x + w - s.pad, cy - s.small * 0.32, "MIXTO", mode, GREEN);
  } else {
    pdf.text(`OC ${item.poNumber}`, x + w - s.pad, cy, { align: "right" });
  }

  cy += s.gap * 1.6 + s.big * 0.75;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(s.big);
  pdf.setTextColor(...INK);
  pdf.text(`PALLET ${item.palletNumber} de ${item.totalPallets}`, x + s.pad, cy, {
    maxWidth: w - s.pad * 2,
  });

  cy += s.gap * 1.4;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(1);
  pdf.line(x + s.pad, cy, x + w - s.pad, cy);
  cy += s.gap * 2.2;

  const lineScale = item.lines.length > 2 ? 0.8 : 1;
  pdf.setTextColor(...INK);
  for (const line of item.lines) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(s.med);
    pdf.text(line.label, x + s.pad, cy, { maxWidth: w - s.pad * 2 - 60 });
    pdf.text(`${line.cases} cajas`, x + w - s.pad, cy, { align: "right" });
    cy += s.med * 0.95 * lineScale;
    if (line.note) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(s.small);
      pdf.setTextColor(...MUTED);
      pdf.text(line.note, x + s.pad, cy);
      pdf.setTextColor(...INK);
      cy += s.small * 1.1 * lineScale;
    }
    cy += s.gap * 0.5 * lineScale;
  }

  cy += s.gap * 0.4;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.75);
  pdf.line(x + s.pad, cy, x + w - s.pad, cy);
  cy += s.gap * 1.8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(s.small);
  pdf.setTextColor(...MUTED);
  const footer = [
    `Total: ${item.totalCases} cajas`,
    `Proveedor: ${item.supplierName}`,
    item.weight != null
      ? `Peso: ${item.weight.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${item.weightUnit}`
      : null,
    item.notes ? `Nota: ${item.notes}` : null,
  ].filter((v): v is string => Boolean(v));
  for (const f of footer) {
    if (cy > y + h - 4) break;
    pdf.text(f, x + s.pad, cy, { maxWidth: w - s.pad * 2 });
    cy += s.lineH;
  }
}

function drawLotLabel(pdf: jsPDF, box: Box, item: LotLabelItem, mode: DrawMode) {
  const s = STYLE[mode];
  const { x, y, w, h } = box;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.75);
  pdf.rect(x, y, w, h);

  let cy = y + s.pad + s.small * 0.9;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(s.small);
  pdf.setTextColor(...MUTED);
  if (item.qualityState === "retenido") {
    pdf.text(`OC ${item.poNumber}`, x + s.pad, cy);
    badge(pdf, x + w - s.pad, cy - s.small * 0.32, "RETENIDO", mode, WARN);
  } else {
    pdf.text(`OC ${item.poNumber}`, x + w - s.pad, cy, { align: "right" });
  }

  cy += s.gap * 1.6 + s.big * 0.75 * 0.75;
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(s.big * 0.75);
  pdf.text(`LOTE ${item.lotNumber}`, x + s.pad, cy, { maxWidth: w - s.pad * 2 });

  cy += s.gap * 1.4;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(1);
  pdf.line(x + s.pad, cy, x + w - s.pad, cy);
  cy += s.gap * 2.2;

  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(s.med);
  pdf.text(item.productLabel, x + s.pad, cy, { maxWidth: w - s.pad * 2 });
  cy += s.med * 1.1;

  cy += s.gap * 0.4;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.75);
  pdf.line(x + s.pad, cy, x + w - s.pad, cy);
  cy += s.gap * 1.8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(s.small);
  pdf.setTextColor(...MUTED);
  const footer = [
    `Cantidad: ${item.qty.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${item.unit}`,
    item.supplierName ? `Proveedor: ${item.supplierName}` : null,
    item.receivedDate ? `Recibido: ${item.receivedDate}` : null,
    item.packDate && item.packDate !== item.receivedDate ? `Empacado: ${item.packDate}` : null,
    item.bestByDate ? `Best by: ${item.bestByDate}` : null,
    item.grade ? `Grado: ${item.grade}` : null,
    item.originCountry ? `Origen: ${item.originCountry}` : null,
    item.qualityState === "retenido" && item.qualityNote ? `Motivo: ${item.qualityNote}` : null,
  ].filter((v): v is string => Boolean(v));
  for (const f of footer) {
    if (cy > y + h - 4) break;
    pdf.text(f, x + s.pad, cy, { maxWidth: w - s.pad * 2 });
    cy += s.lineH;
  }
}

async function buildLabelsPdf<T>(
  items: T[],
  draw: (pdf: jsPDF, box: Box, item: T, mode: DrawMode) => void,
  mode: LabelMode,
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  if (mode === "true") {
    const pdf = new jsPDF({ unit: "pt", format: [TRUE_W, TRUE_H], compress: true });
    items.forEach((item, i) => {
      if (i > 0) pdf.addPage([TRUE_W, TRUE_H]);
      draw(pdf, { x: 0, y: 0, w: TRUE_W, h: TRUE_H }, item, "true");
    });
    return pdf;
  }
  const pdf = new jsPDF({ unit: "pt", format: "letter", compress: true });
  items.forEach((item, i) => {
    const posInPage = i % SHEET_PER_PAGE;
    if (i > 0 && posInPage === 0) pdf.addPage();
    if (posInPage === 0) drawCutLines(pdf);
    draw(pdf, sheetCell(posInPage), item, "compact");
  });
  return pdf;
}

export async function downloadPalletLabelsPdf(
  items: PalletLabelItem[],
  mode: LabelMode,
  filenameBase: string,
): Promise<void> {
  const pdf = await buildLabelsPdf(items, drawPalletLabel, mode);
  triggerDownload(pdf.output("blob"), `${safeFilename(filenameBase)}.pdf`);
}

export async function downloadLotLabelsPdf(
  items: LotLabelItem[],
  mode: LabelMode,
  filenameBase: string,
): Promise<void> {
  const pdf = await buildLabelsPdf(items, drawLotLabel, mode);
  triggerDownload(pdf.output("blob"), `${safeFilename(filenameBase)}.pdf`);
}
