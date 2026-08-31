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
  productName: string;
  calibre: string | null;
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
  { pad: number; second: number; small: number; gap: number; lineH: number }
> = {
  true: { pad: 14, second: 22, small: 9.5, gap: 8, lineH: 12.5 },
  // "el mismo diseño con menos aire": mismos elementos, calibre y número de
  // pallet/lote se quedan grandes; todo lo demás encoge junto con el relleno.
  compact: { pad: 8, second: 13, small: 6.8, gap: 4, lineH: 8.6 },
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

// Agranda "bold" helvetica hasta el tope que quepa en maxWidth (cada par
// izquierda/derecha debe caber junto, así que esto ya descuenta el ancho
// del bloque derecho antes de decidir el tamaño) — así el CALIBRE siempre
// sale lo más grande posible, sin adivinar anchos de texto a mano.
//
// Invariante del motor: `min` es una preferencia estética, no un piso que
// se pueda cruzar sin que quepa. Si ni el más pequeño de los tamaños
// "cómodos" cabe (nombre de producto largo + cantidad, en una etiqueta
// angosta), se sigue encogiendo hasta ABSOLUTE_FLOOR — nunca se entrega un
// tamaño que dos textos en el mismo renglón no puedan compartir sin
// encimarse.
const ABSOLUTE_FLOOR = 6;
function fitFontSize(
  pdf: jsPDF,
  pairs: [string, string][],
  maxWidth: number,
  start: number,
  min: number,
): number {
  pdf.setFont("helvetica", "bold");
  const fits = (size: number) => {
    pdf.setFontSize(size);
    return pairs.every(([l, r]) => pdf.getTextWidth(l) + pdf.getTextWidth(r) <= maxWidth);
  };
  let size = start;
  while (size > min && !fits(size)) size -= 1;
  while (size > ABSOLUTE_FLOOR && !fits(size)) size -= 1;
  pdf.setFontSize(size);
  return size;
}

type HeroRow = { left: string; right: string; note?: string | null };

/**
 * Motor compartido de las dos etiquetas: renglón chico (OC + badge) arriba,
 * un título "segundo" grande (número de pallet/lote), el bloque HERO
 * (calibre/producto + cantidad) CENTRADO en el espacio que sobra, y el pie
 * chico anclado al fondo del rectángulo. Anclar el pie abajo — en vez de
 * dejarlo pegado al bloque hero — es lo que hace que el contenido llene la
 * etiqueta en lugar de apilarse en el tercio superior con un hueco debajo.
 */
function drawFillableLabel(
  pdf: jsPDF,
  box: Box,
  mode: DrawMode,
  opts: {
    ocText: string;
    badgeText: string | null;
    badgeColor: [number, number, number];
    secondTitle: string;
    // Renglón opcional arriba del hero, tamaño medio (p.ej. nombre de
    // producto) — así el hero de abajo puede quedarse corto y grande
    // (CALIBRE + CANTIDAD) en vez de cargar todo en un solo renglón ancho.
    heroSubtitle?: string | null;
    heroSubtitleMax?: number;
    heroSubtitleMin?: number;
    heroRows: HeroRow[];
    heroMax: number;
    heroMin: number;
    footerLines: string[];
  },
) {
  const s = STYLE[mode];
  const { x, y, w, h } = box;
  const innerW = w - s.pad * 2;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.75);
  pdf.rect(x, y, w, h);

  // Renglón superior: OC + badge, en su propia línea (un badge largo no debe
  // montarse sobre ningún título, sea el segundo o el hero).
  const topY = y + s.pad + s.small * 0.9;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(s.small);
  pdf.setTextColor(...MUTED);
  if (opts.badgeText) {
    pdf.text(opts.ocText, x + s.pad, topY);
    badge(pdf, x + w - s.pad, topY - s.small * 0.32, opts.badgeText, mode, opts.badgeColor);
  } else {
    pdf.text(opts.ocText, x + w - s.pad, topY, { align: "right" });
  }

  // Título "segundo": grande, pero por debajo del hero en jerarquía.
  const secondSize = fitFontSize(pdf, [[opts.secondTitle, ""]], innerW, s.second, 11);
  const secondY = topY + s.gap * 1.6 + secondSize * 0.78;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(secondSize);
  pdf.setTextColor(...INK);
  pdf.text(opts.secondTitle, x + s.pad, secondY, { maxWidth: innerW });

  const dividerTopY = secondY + s.gap * 1.3;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(1);
  pdf.line(x + s.pad, dividerTopY, x + w - s.pad, dividerTopY);

  // Pie anclado al fondo real del rectángulo.
  const footerH = opts.footerLines.length * s.lineH;
  const dividerBottomY = y + h - s.pad - footerH - s.gap * 1.6;
  pdf.setDrawColor(...RULE);
  pdf.setLineWidth(0.75);
  pdf.line(x + s.pad, dividerBottomY, x + w - s.pad, dividerBottomY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(s.small);
  pdf.setTextColor(...MUTED);
  let fy = y + h - s.pad - footerH + s.lineH * 0.8;
  for (const f of opts.footerLines) {
    pdf.text(f, x + s.pad, fy, { maxWidth: innerW });
    fy += s.lineH;
  }

  // Bloque HERO: lo más grande de la etiqueta, centrado en el espacio entre
  // el título segundo y el pie — de ahí sale el "llenado" que pedía Miguel.
  const heroGap = mode === "true" ? 20 : 12;
  const noteSize = mode === "true" ? 11 : 7;
  const heroSize = fitFontSize(
    pdf,
    opts.heroRows.map((r): [string, string] => [r.left, r.right]),
    innerW - heroGap,
    opts.heroMax,
    opts.heroMin,
  );
  const subtitleGap = s.gap * 0.7;
  const subtitleSize = opts.heroSubtitle
    ? fitFontSize(
        pdf,
        [[opts.heroSubtitle, ""]],
        innerW,
        opts.heroSubtitleMax ?? s.second,
        opts.heroSubtitleMin ?? s.small,
      )
    : 0;
  const subtitleBlockH = opts.heroSubtitle ? subtitleSize * 0.95 + subtitleGap : 0;

  const rowGap = s.gap * (opts.heroRows.length > 1 ? 1.2 : 0);
  let heroBlockH = subtitleBlockH;
  opts.heroRows.forEach((r) => {
    heroBlockH += heroSize * 0.95;
    if (r.note) heroBlockH += noteSize * 1.15;
  });
  heroBlockH += rowGap * Math.max(0, opts.heroRows.length - 1);

  const midTop = dividerTopY + s.gap * 1.8;
  const midBottom = dividerBottomY - s.gap * 1.2;
  const midZoneH = Math.max(0, midBottom - midTop);
  let top = midTop + Math.max(0, (midZoneH - heroBlockH) / 2);
  if (opts.heroSubtitle) {
    const subtitleBaseline = top + subtitleSize * 0.78;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(subtitleSize);
    pdf.setTextColor(...INK);
    pdf.text(opts.heroSubtitle, x + s.pad, subtitleBaseline, { maxWidth: innerW });
    top += subtitleBlockH;
  }
  opts.heroRows.forEach((r, i) => {
    const baseline = top + heroSize * 0.78;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(heroSize);
    pdf.setTextColor(...INK);
    pdf.text(r.left, x + s.pad, baseline, { maxWidth: innerW - heroGap });
    if (r.right) pdf.text(r.right, x + w - s.pad, baseline, { align: "right" });
    top += heroSize * 0.95;
    if (r.note) {
      const noteBaseline = top + noteSize * 0.85;
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(noteSize);
      pdf.setTextColor(...MUTED);
      pdf.text(r.note, x + s.pad, noteBaseline);
      top += noteSize * 1.15;
    }
    if (i < opts.heroRows.length - 1) top += rowGap;
  });
}

function drawPalletLabel(pdf: jsPDF, box: Box, item: PalletLabelItem, mode: DrawMode) {
  drawFillableLabel(pdf, box, mode, {
    ocText: `OC ${item.poNumber}`,
    badgeText: item.mixed ? "MIXTO" : null,
    badgeColor: GREEN,
    secondTitle: `PALLET ${item.palletNumber} de ${item.totalPallets}`,
    heroRows: item.lines.map((l) => ({ left: l.label, right: `${l.cases} cajas`, note: l.note })),
    heroMax: mode === "true" ? 42 : 22,
    heroMin: mode === "true" ? 16 : 11,
    footerLines: [
      `Total: ${item.totalCases} cajas`,
      `Proveedor: ${item.supplierName}`,
      item.weight != null
        ? `Peso: ${item.weight.toLocaleString("es-MX", { maximumFractionDigits: 1 })} ${item.weightUnit}`
        : null,
      item.notes ? `Nota: ${item.notes}` : null,
    ].filter((v): v is string => Boolean(v)),
  });
}

function drawLotLabel(pdf: jsPDF, box: Box, item: LotLabelItem, mode: DrawMode) {
  // Mismo patrón que la etiqueta de pallet: el CALIBRE es el hero (grande,
  // se lee de lejos) y el nombre de producto es un subtítulo secundario
  // arriba — así el ancho del nombre de producto (que puede ser largo) ya
  // no compite por espacio en el mismo renglón que la cantidad.
  drawFillableLabel(pdf, box, mode, {
    ocText: `OC ${item.poNumber}`,
    badgeText: item.qualityState === "retenido" ? "RETENIDO" : null,
    badgeColor: WARN,
    secondTitle: `LOTE ${item.lotNumber}`,
    heroSubtitle: item.calibre ? item.productName : null,
    heroSubtitleMax: mode === "true" ? 20 : 11,
    heroSubtitleMin: mode === "true" ? 11 : 7,
    heroRows: [
      {
        left: item.calibre ?? item.productName,
        right: `${item.qty.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${item.unit}`,
      },
    ],
    heroMax: mode === "true" ? 42 : 22,
    heroMin: mode === "true" ? 16 : 11,
    footerLines: [
      item.supplierName ? `Proveedor: ${item.supplierName}` : null,
      item.receivedDate !== "—" ? `Recibido: ${item.receivedDate}` : null,
      item.packDate !== "—" && item.packDate !== item.receivedDate
        ? `Empacado: ${item.packDate}`
        : null,
      item.bestByDate ? `Best by: ${item.bestByDate}` : null,
      item.grade ? `Grado: ${item.grade}` : null,
      item.originCountry ? `Origen: ${item.originCountry}` : null,
      item.qualityState === "retenido" && item.qualityNote ? `Motivo: ${item.qualityNote}` : null,
    ].filter((v): v is string => Boolean(v)),
  });
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
